import os
import sys
import sqlite3
import zlib
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

OFFSET_STEP = 10000

_METADATA_DDL = """
CREATE TABLE IF NOT EXISTS paths (
    id                  INTEGER PRIMARY KEY,
    path_author_id      TEXT    NOT NULL,
    path_collection_id  TEXT    NOT NULL,
    path_url_slug       TEXT,
    path_title          TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    scraped_at          TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id              INTEGER PRIMARY KEY,
    type            TEXT    NOT NULL DEFAULT 'Course',
    path_id         INTEGER,
    url             TEXT    NOT NULL,
    structure_hash  TEXT    NOT NULL,
    slug            TEXT    NOT NULL,
    author_id       TEXT,
    collection_id   TEXT,
    title           TEXT,
    toc_json        TEXT,
    cloudlab_id     INTEGER,
    project_id      INTEGER,
    is_active       INTEGER NOT NULL DEFAULT 1,
    scraped_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id                    INTEGER PRIMARY KEY,
    project_author_id     TEXT    NOT NULL,
    project_collection_id TEXT    NOT NULL,
    project_work_id       TEXT    NOT NULL,
    project_title         TEXT,
    project_url_slug      TEXT,
    is_active             INTEGER NOT NULL DEFAULT 1,
    scraped_at            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS cloudlabs (
    id                     INTEGER PRIMARY KEY,
    cloudlab_author_id     TEXT    NOT NULL,
    cloudlab_collection_id TEXT    NOT NULL,
    cloudlab_work_id       TEXT    NOT NULL,
    cloudlab_title         TEXT,
    cloudlab_url_slug      TEXT,
    is_active              INTEGER NOT NULL DEFAULT 1,
    scraped_at             TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
    id              INTEGER PRIMARY KEY,
    course_id       INTEGER NOT NULL,
    topic_index     INTEGER NOT NULL,
    topic_name      TEXT    NOT NULL,
    topic_slug      TEXT    NOT NULL DEFAULT '',
    topic_url       TEXT    NOT NULL,
    api_url         TEXT    NOT NULL,
    page_id         TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'pending',
    scraped_at      TEXT,
    error_msg       TEXT
);

-- Empty structure for compatibility with global searches
CREATE TABLE IF NOT EXISTS components (
    id              INTEGER PRIMARY KEY,
    course_id       INTEGER NOT NULL,
    topic_index     INTEGER NOT NULL,
    component_index INTEGER NOT NULL,
    type            TEXT    NOT NULL,
    content_json    TEXT,
    scraped_at      TEXT    NOT NULL
);
"""

def get_db_files(base_dir):
    db_files = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith((".db", ".sqlite", ".sqlite3")):
                # Exclude the metadata output db itself if it's in the same folder
                db_files.append(os.path.join(root, file))
    db_files.sort()
    return db_files

def calculate_offset(path, offset_step, existing_offsets):
    basename = os.path.basename(path)
    crc = zlib.crc32(basename.encode('utf-8')) & 0xffffffff
    while (crc * offset_step) in existing_offsets:
        crc += 1
    return crc * offset_step

def merge_databases(db_files, output_db):
    if os.path.exists(output_db):
        try:
            os.remove(output_db)
        except OSError as e:
            log.error(f"Could not remove existing catalog database: {e}")
            sys.exit(1)

    out_conn = sqlite3.connect(output_db)
    out_conn.executescript(_METADATA_DDL)
    out_cursor = out_conn.cursor()

    existing_offsets = set()
    total_merged = 0

    log.info(f"Merging metadata from {len(db_files)} files...")

    for path in db_files:
        if os.path.abspath(path) == os.path.abspath(output_db):
            continue

        offset = calculate_offset(path, OFFSET_STEP, existing_offsets)
        existing_offsets.add(offset)

        log.info(f"Processing shard: {os.path.basename(path)} (Offset: {offset})")

        in_conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        in_conn.row_factory = sqlite3.Row
        in_cursor = in_conn.cursor()

        try:
            # 1. Merge paths
            in_cursor.execute("SELECT * FROM paths")
            for row in in_cursor.fetchall():
                d = dict(row)
                d["id"] += offset
                out_cursor.execute(
                    "INSERT INTO paths (id, path_author_id, path_collection_id, path_url_slug, path_title, is_active, scraped_at) "
                    "VALUES (:id, :path_author_id, :path_collection_id, :path_url_slug, :path_title, :is_active, :scraped_at)",
                    d
                )

            # 2. Merge projects
            in_cursor.execute("SELECT * FROM projects")
            for row in in_cursor.fetchall():
                d = dict(row)
                d["id"] += offset
                out_cursor.execute(
                    "INSERT INTO projects (id, project_author_id, project_collection_id, project_work_id, project_title, project_url_slug, is_active, scraped_at) "
                    "VALUES (:id, :project_author_id, :project_collection_id, :project_work_id, :project_title, :project_url_slug, :is_active, :scraped_at)",
                    d
                )

            # 3. Merge cloudlabs
            in_cursor.execute("SELECT * FROM cloudlabs")
            for row in in_cursor.fetchall():
                d = dict(row)
                d["id"] += offset
                out_cursor.execute(
                    "INSERT INTO cloudlabs (id, cloudlab_author_id, cloudlab_collection_id, cloudlab_work_id, cloudlab_title, cloudlab_url_slug, is_active, scraped_at) "
                    "VALUES (:id, :cloudlab_author_id, :cloudlab_collection_id, :cloudlab_work_id, :cloudlab_title, :cloudlab_url_slug, :is_active, :scraped_at)",
                    d
                )

            # 4. Merge courses
            in_cursor.execute("SELECT * FROM courses")
            for row in in_cursor.fetchall():
                d = dict(row)
                d["id"] += offset
                if d.get("path_id") is not None:
                    d["path_id"] += offset
                if d.get("cloudlab_id") is not None:
                    d["cloudlab_id"] += offset
                if d.get("project_id") is not None:
                    d["project_id"] += offset
                
                out_cursor.execute(
                    "INSERT INTO courses (id, type, path_id, url, structure_hash, slug, author_id, collection_id, title, toc_json, cloudlab_id, project_id, is_active, scraped_at) "
                    "VALUES (:id, :type, :path_id, :url, :structure_hash, :slug, :author_id, :collection_id, :title, :toc_json, :cloudlab_id, :project_id, :is_active, :scraped_at)",
                    d
                )

            # 5. Merge topics
            in_cursor.execute("SELECT * FROM topics")
            for row in in_cursor.fetchall():
                d = dict(row)
                d["id"] += offset
                d["course_id"] += offset
                out_cursor.execute(
                    "INSERT INTO topics (id, course_id, topic_index, topic_name, topic_slug, topic_url, api_url, page_id, status, scraped_at, error_msg) "
                    "VALUES (:id, :course_id, :topic_index, :topic_name, :topic_slug, :topic_url, :api_url, :page_id, :status, :scraped_at, :error_msg)",
                    d
                )

            total_merged += 1
        except sqlite3.OperationalError as e:
            log.warning(f"Skipping database schema check for {os.path.basename(path)}: {e}")
        finally:
            in_conn.close()

    out_conn.commit()
    out_conn.close()
    log.info(f"Successfully generated centralized catalog database '{output_db}' from {total_merged} course databases.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aggregates metadata from split course databases to a central catalog")
    parser.add_argument("--dir", required=True, help="Directory containing split course databases")
    parser.add_argument("--out", default="metadata.db", help="Path to the output metadata catalog database")
    args = parser.parse_args()

    db_files = get_db_files(args.dir)
    if not db_files:
        log.error(f"No database files found in '{args.dir}'")
        sys.exit(1)

    merge_databases(db_files, args.out)
