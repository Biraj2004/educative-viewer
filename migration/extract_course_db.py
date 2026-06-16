import sqlite3
import argparse
import sys
import os

SCHEMA = """
CREATE TABLE IF NOT EXISTS paths (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        path_author_id      TEXT    NOT NULL,
        path_collection_id  TEXT    NOT NULL,
        path_url_slug       TEXT,
        path_title          TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        scraped_at          TEXT    NOT NULL,
        UNIQUE(path_author_id, path_collection_id)
    );

CREATE TABLE IF NOT EXISTS courses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        type            TEXT    NOT NULL DEFAULT 'Course',
        path_id         INTEGER REFERENCES paths(id),
        url             TEXT    NOT NULL,
        structure_hash  TEXT    NOT NULL,
        slug            TEXT    NOT NULL,
        author_id       TEXT,
        collection_id   TEXT,
        title           TEXT,
        toc_json        TEXT,
        cloudlab_id     TEXT,
        project_id      INTEGER REFERENCES projects(id),
        is_active       INTEGER NOT NULL DEFAULT 1,
        scraped_at      TEXT    NOT NULL,
        UNIQUE(url, structure_hash)
    );

CREATE TABLE IF NOT EXISTS projects (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        project_author_id     TEXT    NOT NULL,
        project_collection_id TEXT    NOT NULL,
        project_work_id       TEXT    NOT NULL,
        project_title         TEXT,
        project_url_slug      TEXT,
        is_active             INTEGER NOT NULL DEFAULT 1,
        scraped_at            TEXT    NOT NULL,
        UNIQUE(project_author_id, project_collection_id, project_work_id)
    );

CREATE TABLE IF NOT EXISTS topics (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        topic_index     INTEGER NOT NULL,
        topic_name      TEXT    NOT NULL,
        topic_slug      TEXT    NOT NULL DEFAULT '',
        topic_url       TEXT    NOT NULL,
        api_url         TEXT    NOT NULL,
        page_id         TEXT    NOT NULL DEFAULT '',
        status          TEXT    NOT NULL DEFAULT 'pending',
        scraped_at      TEXT,
        error_msg       TEXT,
        UNIQUE(course_id, topic_index),
        UNIQUE(course_id, api_url)
    );

CREATE TABLE IF NOT EXISTS components (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        topic_index     INTEGER NOT NULL,
        component_index INTEGER NOT NULL,
        type            TEXT    NOT NULL,
        content_json    TEXT,
        scraped_at      TEXT    NOT NULL,
        FOREIGN KEY (course_id, topic_index)
            REFERENCES topics(course_id, topic_index) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS static_assets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        topic_index INTEGER NOT NULL,
        assets_json TEXT    NOT NULL DEFAULT '{}',
        created_at  TEXT    NOT NULL,
        UNIQUE(course_id, topic_index)
    );

CREATE TABLE IF NOT EXISTS cloudlabs (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        cloudlab_author_id     TEXT    NOT NULL,
        cloudlab_collection_id TEXT    NOT NULL,
        cloudlab_work_id       TEXT    NOT NULL,
        cloudlab_title         TEXT,
        cloudlab_url_slug      TEXT,
        is_active              INTEGER NOT NULL DEFAULT 1,
        scraped_at             TEXT    NOT NULL,
        UNIQUE(cloudlab_author_id, cloudlab_collection_id, cloudlab_work_id)
    );
"""

def extract_course(input_db, course_id, output_db):
    if not os.path.exists(input_db):
        print(f"Error: Input DB '{input_db}' does not exist.")
        sys.exit(1)

    print(f"Extracting course {course_id} from {input_db} to {output_db}...")

    # Connect to input database
    conn_in = sqlite3.connect(input_db)
    conn_in.row_factory = sqlite3.Row
    cur_in = conn_in.cursor()

    # Check if course exists
    cur_in.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    course_row = cur_in.fetchone()

    if not course_row:
        print(f"Error: Course with ID {course_id} not found in {input_db}.")
        sys.exit(1)

    # Connect to output database
    conn_out = sqlite3.connect(output_db)
    cur_out = conn_out.cursor()

    # Create schema
    cur_out.executescript(SCHEMA)

    def insert_row(table, row):
        keys = row.keys()
        values = [row[k] for k in keys]
        placeholders = ', '.join(['?'] * len(values))
        columns = ', '.join(keys)
        sql = f"INSERT OR IGNORE INTO {table} ({columns}) VALUES ({placeholders})"
        cur_out.execute(sql, values)

    # Insert course
    insert_row('courses', course_row)

    # Fetch and insert referenced path if it exists
    if 'path_id' in course_row.keys() and course_row['path_id']:
        cur_in.execute("SELECT * FROM paths WHERE id = ?", (course_row['path_id'],))
        path_row = cur_in.fetchone()
        if path_row:
            insert_row('paths', path_row)

    # Fetch and insert referenced project if it exists
    if 'project_id' in course_row.keys() and course_row['project_id']:
        cur_in.execute("SELECT * FROM projects WHERE id = ?", (course_row['project_id'],))
        project_row = cur_in.fetchone()
        if project_row:
            insert_row('projects', project_row)

    # Fetch and insert topics
    cur_in.execute("SELECT * FROM topics WHERE course_id = ?", (course_id,))
    topics = cur_in.fetchall()
    for topic in topics:
        insert_row('topics', topic)
    print(f"Extracted {len(topics)} topics.")

    # Fetch and insert components
    cur_in.execute("SELECT * FROM components WHERE course_id = ?", (course_id,))
    components = cur_in.fetchall()
    for component in components:
        insert_row('components', component)
    print(f"Extracted {len(components)} components.")

    # Fetch and insert static_assets
    cur_in.execute("SELECT * FROM static_assets WHERE course_id = ?", (course_id,))
    assets = cur_in.fetchall()
    for asset in assets:
        insert_row('static_assets', asset)
    print(f"Extracted {len(assets)} static assets.")

    conn_out.commit()
    conn_in.close()
    conn_out.close()
    print("Extraction completed successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract course data from one SQLite DB to another.")
    parser.add_argument("-i", "--input", required=True, help="Input SQLite database file path")
    parser.add_argument("-c", "--course-id", required=True, type=int, help="Course ID to extract")
    parser.add_argument("-o", "--output", help="Output SQLite database file path (optional)")

    args = parser.parse_args()

    output_db = args.output
    if not output_db:
        output_db = f"course_{args.course_id}.db"

    extract_course(args.input, args.course_id, output_db)
