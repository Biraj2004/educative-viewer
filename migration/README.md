# Educative Legacy Content Migrator 🚀

A highly-optimized Python tool to migrate downloaded legacy HTML courses, paths, projects, and cloudlabs into SQLite databases. 

It seamlessly converts raw directory structures into properly indexed database entries, packages code workspaces, avoids duplication via structure hashing, and is optimized for speed.

---

## ⚡ Key Features

* **5x Faster Performance**: Uses SQLite exclusive locking, memory-backed temp store, and shallow-scan directory walking to complete large migrations in seconds.
* **Smart Duplication Checks**: Computes unique hashes for course structures. Running the script twice will quickly skip already-migrated content.
* **Auto Workspace Bundling**: Detects code snippets and configuration files next to lesson HTML and packages them into the database, enabling interactive browser-based Monaco editors in the viewer.
* **Automatic Exclusions**: Bypasses heavy folders like `node_modules`, `venv`, `.git`, and binary media files to keep database size optimal.
* **Split Database Option**: Can generate separate, self-contained databases for each course or merge courses into single-file paths.

---

## 📋 Prerequisites

Install the required dependencies (only `natsort` is needed to correctly sort lesson files like `1-intro.html` vs `10-summary.html`):

```bash
pip install -r requirements.txt
```

---

## 🛠️ Usage

Run the migrator directly via python:

```bash
python legacy_migration.py --dir <path_to_content>
```

### Command Line Arguments

| Argument | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `--dir` | **Yes** | - | Path to the directory containing downloaded content. |
| `--type` | No | `Auto` | Type of content being migrated: `Auto`, `Course`, `Path`, `Cloudlab`, or `Project`. |
| `--db` | No | `educative_scraper_legacy.db` | Target SQLite database file or directory. |
| `--title` | No | - | Explicit title to override auto-detection (ignored in `Auto` mode). |
| `--split` | No | *(Disabled)* | **Split Database Mode**: Generates folder-specific `.db` files (see below). |

---

## 📂 Auto Mode & Folder Structure

When running in `--type Auto` mode, the migrator expects category folders inside the target directory:

```text
/your-scraped-content/
  ├── Paths/
  │   └── Become a System Design Expert/
  │       ├── Grokking System Design/
  │       └── Grokking Low Level Design/
  ├── Courses/
  │   └── Modern Web Development/
  │       ├── 001-introduction/
  │       └── 002-react-basics/
  ├── Projects/
  └── Cloudlabs/
```

### Strict Lesson Structure (Per-Topic)
To migrate a course properly:
1. **HTML File Matching**: The main `.html` file containing the lesson content **must match** its parent topic folder name exactly (e.g., `002-react-basics/002-react-basics.html`).
2. **Workspaces**: Put files/folders you want inside the student's interactive workspace in the same topic folder. They will automatically bundle as a `LegacyWorkspace`.

---

## 🗄️ Database Split Mode (`--split`)

By default, everything is compiled into a single monolithic database (e.g., `educative_scraper_legacy.db`). 

To generate cleaner, modular, and portable databases, enable `--split`:

```bash
python legacy_migration.py --dir D:\scraped-content --split --db output_dbs/educative.db
```

### Split Mode Behavior:
* **Courses/Projects/Cloudlabs** get their own independent `.db` file under their respective folders (e.g., `output_dbs/Courses/modern-web-development.db`).
* **Paths** get a single `.db` file containing all courses belonging to that path (e.g., `output_dbs/Paths/become-a-system-design-expert.db`).
* **Tree Structure**: It matches your input structure exactly, but placing database files directly under `Courses/`, `Paths/`, etc., without nesting them in sub-folders.
