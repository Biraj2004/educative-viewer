import argparse
import json
import logging
import os
import sqlite3
import uuid
from datetime import datetime, timezone
import hashlib
import natsort
import re

_DDL = """
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
        cloudlab_id     INTEGER REFERENCES cloudlabs(id),
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

    CREATE INDEX IF NOT EXISTS idx_courses_path       ON courses(path_id);
    CREATE INDEX IF NOT EXISTS idx_paths_author_collection ON paths(path_author_id, path_collection_id);
    CREATE INDEX IF NOT EXISTS idx_projects_triplet   ON projects(project_author_id, project_collection_id, project_work_id);
    CREATE INDEX IF NOT EXISTS idx_cloudlabs_triplet  ON cloudlabs(cloudlab_author_id, cloudlab_collection_id, cloudlab_work_id);
    CREATE INDEX IF NOT EXISTS idx_topics_course      ON topics(course_id);
    CREATE INDEX IF NOT EXISTS idx_components_topic   ON components(course_id, topic_index);
    CREATE INDEX IF NOT EXISTS idx_components_type    ON components(type);
"""

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def generate_id():
    return uuid.uuid4().hex[:16]

def slugify(text):
    return "".join([c if c.isalnum() else "-" for c in text.lower()])

def clean_topic_title(raw_title):
    """Removes leading numbers like '005-' or '177-' from the topic title."""
    return re.sub(r'^\d+[-_\s]+', '', raw_title).strip()

def print_progress_bar(iteration, total, prefix='', suffix='', decimals=1, length=50, fill='█', print_end="\r"):
    if total == 0:
        return
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filled_length = int(length * iteration // total)
    bar = fill * filled_length + '-' * (length - filled_length)
    print(f'\r{prefix} |{bar}| {percent}% {suffix}', end=print_end)
    if iteration == total: 
        print()

def create_connection(db_file):
    conn = sqlite3.connect(db_file)
    # Performance PRAGMAs to drastically speed up bulk inserts
    conn.execute("PRAGMA synchronous = OFF;")
    conn.execute("PRAGMA journal_mode = MEMORY;")
    conn.execute("PRAGMA cache_size = 100000;")
    conn.execute("PRAGMA locking_mode = EXCLUSIVE;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.row_factory = sqlite3.Row
    conn.executescript(_DDL)
    return conn

def process_course(course_dir, course_title, args, conn, cursor, now_iso, course_type="Course", path_id=None, project_id=None, cloudlab_id=None):
    legacy_toc = None
    toc_path = os.path.join(course_dir, "__toc__.json")
    if os.path.isfile(toc_path):
        try:
            with open(toc_path, "r", encoding="utf-8") as f:
                legacy_toc = json.load(f)
            logging.info(f"Found and loaded {os.path.basename(toc_path)} to migrate from {course_dir}")
        except Exception as e:
            logging.warning(f"Failed to load {os.path.basename(toc_path)} from {course_dir}: {e}")
    
    if not course_title:
        course_title = os.path.basename(course_dir)
    course_slug = slugify(course_title)
    url = f"https://educative.io/legacy/{course_slug}"
    author_id = generate_id()
    collection_id = generate_id()
    
    cursor.execute("SELECT seq FROM sqlite_sequence WHERE name='courses'")
    row = cursor.fetchone()
    course_id = 1
    if row:
        course_id = row["seq"] + 1  
    logging.info(f"Predicting next course ID as {course_id} for '{course_title}'")
    
    complete_toc = []
    topics_inserted = {} 
    topic_index = 0
    if legacy_toc:
        categories = legacy_toc["toc"]
        course_title = legacy_toc["course"]
        url = legacy_toc["url"]
        for cat in categories:
            if isinstance(cat, list):
                t_title, t_slug, t_api, t_url = cat[0], cat[1], cat[2], cat[3]
                topic_dto = {
                    "api_url": t_api,
                    "course_id": course_id,
                    "slug": slugify(clean_topic_title(t_title)),
                    "title": t_title,
                    "topic_index": topic_index,
                    "type": "collection_lesson",
                    "url": t_url
                }
                complete_toc.append(topic_dto)
                topics_inserted[topic_index] = topic_dto
                topic_index += 1
            elif isinstance(cat, dict):
                cat_name = cat["category"]
                cat_topics = cat["topics"]
                new_topics = []
                for t in cat_topics:
                    t_title, t_slug, t_api, t_url = t[0], t[1], t[2], t[3]
                    topic_dto = {
                        "api_url": t_api,
                        "course_id": course_id,
                        "slug": slugify(clean_topic_title(t_title)),
                        "title": t_title,
                        "topic_index": topic_index,
                        "type": "collection_lesson",
                        "url": t_url
                    }
                    new_topics.append(topic_dto)
                    topics_inserted[topic_index] = topic_dto
                    topic_index += 1
                complete_toc.append({
                    "category": cat_name,
                    "topics": new_topics
                })

    html_files = []
    for entry in os.listdir(course_dir):
        full_path = os.path.join(course_dir, entry)
        if os.path.isdir(full_path):
            expected_html = os.path.join(full_path, f"{entry}.html")
            if os.path.isfile(expected_html):
                html_files.append(expected_html)
        elif entry.lower().endswith(".html"):
            html_files.append(full_path)
    
    html_files = natsort.natsorted(html_files)
    total_files = len(html_files)

    if complete_toc == [] and html_files:
        logging.info(f"No TOC found, using HTML files to generate TOC for course '{course_title}'")
        for i, html_f in enumerate(html_files):
            html_title = os.path.splitext(os.path.basename(html_f))[0]
            api_url = f"http://localhost:5000/courses/{course_id}/topics/{i}/content_for_viewer_using_topic_id/0"
            t_title = clean_topic_title(html_title)
            t_slug = slugify(t_title)
            topic_dto = {
                "api_url": api_url,
                "course_id": course_id,
                "slug": t_slug,
                "title": t_title,
                "topic_index": i,
                "type": "collection_lesson",
                "url": f"http://localhost:3000/dashboard/courses/{course_id}/{course_slug}/topics/{i}/{t_slug}"
            }
            complete_toc.append(topic_dto)
            topics_inserted[i] = topic_dto
            topic_index += 1
    
    structure_hash = hashlib.sha256(
        json.dumps([str(t.get("slug", "")) for t in topics_inserted.values()], ensure_ascii=False).encode("utf-8")
    ).hexdigest()
        
    cursor.execute("SELECT id FROM courses WHERE structure_hash = ?", (structure_hash,))
    existing_course = cursor.fetchone()
    if existing_course:
        logging.info(f"Course '{course_title}' already exists with same structure hash (ID {existing_course['id']}). Skipping HTML processing.")
        return

    cursor.execute("""
        INSERT INTO courses (id, type, path_id, url, structure_hash, slug, author_id, collection_id, title, toc_json, cloudlab_id, project_id, is_active, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (course_id, course_type, path_id, url, structure_hash, course_slug, author_id, collection_id, course_title, json.dumps(complete_toc), cloudlab_id, project_id, 1, now_iso))
    logging.info(f"Created course '{course_title}' with ID {course_id} (Type: {course_type})")


    for topic_index, html_file in enumerate(html_files):
        if topic_index == 0 or topic_index == total_files - 1 or topic_index % 5 == 0:
            print_progress_bar(topic_index, total_files, prefix=f'Migrating HTML ({course_title}):', suffix='Complete', length=50)
        try:
            with open(html_file, "r", encoding="utf-8") as f:
                html_content = f.read()
        except Exception as e:
            logging.error(f"Failed to read {html_file}: {e}")
            break
            
        topic_name = topics_inserted[topic_index]["title"]
        topic_slug = topics_inserted[topic_index]["slug"]
        api_url = topics_inserted[topic_index]["api_url"]
        topic_url = topics_inserted[topic_index]["url"]
        
        cursor.execute("""
            INSERT INTO topics (course_id, topic_index, topic_name, topic_slug, topic_url, api_url, page_id, status, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (course_id, topic_index, topic_name, topic_slug, topic_url, api_url, generate_id(), "completed", now_iso))
        
        content_json_dict = {"html": html_content}
        content_json_str = json.dumps(content_json_dict)
        cursor.execute("""
            INSERT INTO components (course_id, topic_index, component_index, type, content_json, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (course_id, topic_index, 0, "LegacyHTML", content_json_str, now_iso))
        
        topic_dir = os.path.dirname(html_file)
        if os.path.abspath(topic_dir) != os.path.abspath(course_dir):
            legacy_workspace_files = {}
            # Shallow scan topic_dir to verify if there are any other files or directories
            # If there are no other files, we skip the expensive os.walk entirely
            has_workspace = False
            try:
                for entry in os.scandir(topic_dir):
                    if entry.is_dir():
                        has_workspace = True
                        break
                    elif entry.is_file() and not entry.name.lower().endswith(".html"):
                        has_workspace = True
                        break
            except OSError:
                pass

            if has_workspace:
                for w_root, w_dirs, w_files in os.walk(topic_dir):
                    # Prune massive dependency/build folders to drastically speed up workspace bundling
                    w_dirs[:] = [d for d in w_dirs if d not in (".git", "node_modules", ".node_modules", "venv", ".venv", "__pycache__", ".next", "dist", "build", ".idea", ".vscode", "coverage")]
                    
                    for w_file in w_files:
                        # Skip HTML files in the immediate topic directory so we don't bundle the main lesson html itself
                        if w_root == topic_dir and w_file.lower().endswith(".html"):
                            continue
                        
                        full_path = os.path.join(w_root, w_file)
                        rel_path = os.path.relpath(full_path, topic_dir).replace("\\", "/")
                        
                        try:
                            with open(full_path, "r", encoding="utf-8") as rf:
                                content = rf.read()
                            legacy_workspace_files[rel_path] = content
                        except UnicodeDecodeError as e:
                            logging.warning(f"Skipping binary/unreadable file in workspace: {rel_path} - {e}")
                        except Exception as e:
                            logging.warning(f"Error reading workspace file {rel_path}: {e}")
                        
            if legacy_workspace_files:
                workspace_json_dict = {"files": legacy_workspace_files}
                workspace_json_str = json.dumps(workspace_json_dict)
                cursor.execute("""
                    INSERT INTO components (course_id, topic_index, component_index, type, content_json, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (course_id, topic_index, 1, "LegacyWorkspace", workspace_json_str, now_iso))
        
    if total_files > 0:
        print_progress_bar(total_files, total_files, prefix=f'Migrating HTML ({course_title}):', suffix='Complete', length=50)
    
    # Commit after each course to prevent RAM exhaustion on massive migrations
    conn.commit()

def process_content_by_type(base_dir, content_type, content_title, args, conn, cursor, now_iso):
    if content_type == "Path":
        path_title = content_title or os.path.basename(base_dir)
        path_slug = slugify(path_title)
        
        cursor.execute("SELECT id FROM paths WHERE path_url_slug = ?", (path_slug,))
        row = cursor.fetchone()
        if row:
            path_id = row["id"]
            logging.info(f"Path '{path_title}' already exists (ID {path_id}). Checking sub-courses...")
        else:
            author_id = generate_id()
            collection_id = generate_id()
            cursor.execute("""
                INSERT INTO paths (path_author_id, path_collection_id, path_url_slug, path_title, is_active, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (author_id, collection_id, path_slug, path_title, 1, now_iso))
            path_id = cursor.lastrowid
            logging.info(f"Created Path entry '{path_title}' with ID {path_id}")

        # Iterate through subdirectories for courses
        for entry in os.listdir(base_dir):
            full_path = os.path.join(base_dir, entry)
            if os.path.isdir(full_path):
                process_course(full_path, entry, args, conn, cursor, now_iso, course_type="Path", path_id=path_id)

    elif content_type == "Project":
        project_title = content_title or os.path.basename(base_dir)
        project_slug = slugify(project_title)
        
        cursor.execute("SELECT id FROM projects WHERE project_url_slug = ?", (project_slug,))
        row = cursor.fetchone()
        if row:
            project_id = row["id"]
            logging.info(f"Project '{project_title}' already exists (ID {project_id}). Checking content...")
        else:
            author_id = generate_id()
            collection_id = generate_id()
            work_id = generate_id()
            cursor.execute("""
                INSERT INTO projects (project_author_id, project_collection_id, project_work_id, project_title, project_url_slug, is_active, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (author_id, collection_id, work_id, project_title, project_slug, 1, now_iso))
            project_id = cursor.lastrowid
            logging.info(f"Created Project entry '{project_title}' with ID {project_id}")
        
        process_course(base_dir, content_title, args, conn, cursor, now_iso, course_type="Project", project_id=project_id)
        
    elif content_type == "Cloudlab":
        cloudlab_title = content_title or os.path.basename(base_dir)
        cloudlab_slug = slugify(cloudlab_title)
        
        cursor.execute("SELECT id FROM cloudlabs WHERE cloudlab_url_slug = ?", (cloudlab_slug,))
        row = cursor.fetchone()
        if row:
            cloudlab_id = row["id"]
            logging.info(f"Cloudlab '{cloudlab_title}' already exists (ID {cloudlab_id}). Checking content...")
        else:
            author_id = generate_id()
            collection_id = generate_id()
            work_id = generate_id()
            cursor.execute("""
                INSERT INTO cloudlabs (cloudlab_author_id, cloudlab_collection_id, cloudlab_work_id, cloudlab_title, cloudlab_url_slug, is_active, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (author_id, collection_id, work_id, cloudlab_title, cloudlab_slug, 1, now_iso))
            cloudlab_id = cursor.lastrowid
            logging.info(f"Created Cloudlab entry '{cloudlab_title}' with ID {cloudlab_id}")
        
        process_course(base_dir, content_title, args, conn, cursor, now_iso, course_type="Cloudlab", cloudlab_id=cloudlab_id)

    else:
        # Course
        process_course(base_dir, content_title, args, conn, cursor, now_iso, course_type="Course")

def main():
    parser = argparse.ArgumentParser(description="Migrate legacy HTML courses/paths to SQLite database")
    parser.add_argument("--db", default="educative_scraper_legacy.db", help="Path to the SQLite DB file (default: educative_scraper_legacy.db)")
    parser.add_argument("--dir", required=True, help="Path to the legacy course or path directory")
    parser.add_argument("--type", choices=["Course", "Path", "Cloudlab", "Project", "Auto"], default="Auto", help="Type of legacy content (or Auto to scan directories)")
    parser.add_argument("--title", help="Course or Path title (defaults to directory name)")
    args = parser.parse_args()

    base_dir = os.path.abspath(args.dir)
    if not os.path.isdir(base_dir):
        logging.error(f"Directory not found: {base_dir}")
        return

    conn = create_connection(args.db)
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    if args.type == "Auto":
        valid_folders = {
            "paths": "Path",
            "courses": "Course",
            "cloudlabs": "Cloudlab",
            "projects": "Project"
        }
        found_any = False
        for entry in os.listdir(base_dir):
            full_path = os.path.join(base_dir, entry)
            if os.path.isdir(full_path) and entry.lower() in valid_folders:
                content_type = valid_folders[entry.lower()]
                logging.info(f"Auto-detected category folder: '{entry}' (Type: {content_type})")
                for sub_entry in os.listdir(full_path):
                    sub_path = os.path.join(full_path, sub_entry)
                    if os.path.isdir(sub_path):
                        logging.info(f"Processing {content_type}: '{sub_entry}'...")
                        process_content_by_type(sub_path, content_type, sub_entry, args, conn, cursor, now_iso)
                found_any = True
                
        if not found_any:
            logging.error(f"Auto mode: No category folders (Paths, Courses, Cloudlabs, Projects) found in '{base_dir}'")
    else:
        process_content_by_type(base_dir, args.type, args.title, args, conn, cursor, now_iso)

    conn.commit()
    conn.close()
    logging.info(f"Migration completed successfully.")

if __name__ == "__main__":
    main()
