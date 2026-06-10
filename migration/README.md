# Educative Legacy Content Migrator

This script migrates downloaded legacy HTML courses, paths, projects, and cloudlabs into the application's SQLite database. It seamlessly converts raw directory structures into properly linked database entries, bundles code workspaces, and handles duplicate checking automatically.

## Prerequisites

Make sure you have installed the required dependencies:

```bash
pip install -r requirements.txt
```

*(The only external dependency is `natsort`, which is required to properly sort numerically prefixed lesson HTML files like `1-intro.html` vs `10-summary.html`)*

## Usage

You can run the migrator using Python:

```bash
python legacy_migration.py --dir <path_to_content>
```

### Arguments:

*   `--dir` **(Required)**: The absolute or relative path to the directory containing your downloaded content. 
*   `--type` *(Optional)*: The type of content you are migrating. Defaults to `Auto`.
    *   `Auto`: Automatically scans the directory for standard root folders (`Paths`, `Courses`, `Projects`, `Cloudlabs`) and processes everything inside them recursively.
    *   `Course`
    *   `Path`
    *   `Cloudlab`
    *   `Project`
*   `--db` *(Optional)*: Path to the target SQLite DB file. (Defaults to `educative_scraper_legacy.db` in your current directory).
*   `--title` *(Optional)*: An explicit title to give the imported content (ignored in `Auto` mode). If omitted, it will try to read the title from `__toc__.json` or fallback to the folder name.

---

## The "Auto" Mode (Recommended)

If you simply pass a root folder (eg root folder like `done/`) to the script without a `--type`, it will automatically look for standard category folders.

```bash
python legacy_migration.py --dir D:\Development\Courses_main\done
```

**Expected Directory Structure for Auto Mode:**
```text
/done/
  ├── Paths/
  │   └── Advanced Web Architecture/
  │       ├── Course 1: Basics/
  │       └── Course 2: Advanced/
  ├── Courses/
  │   └── System Design Interview/
  │       ├── 001-intro/
  │       └── 002-scaling/
  ├── Projects/
  └── Cloudlabs/
```

---

## Topic & Workspace Structure

To ensure courses are migrated perfectly, your scraped folders must follow this strict structure:

1. **Course Folder**: Contains a `__toc__.json` and subfolders for each topic.
2. **Topic Folders**: Each topic must be contained within its own subfolder.
3. **HTML File**: The primary lesson HTML file **MUST exactly match** the name of its parent topic folder.
4. **Workspaces**: Any code, quizzes, or additional files should be stored inside the topic folder alongside the HTML file. They will be bundled into the database as a `LegacyWorkspace` component.

### Example Course Structure:
```text
/System Design Interview/                 <-- Course Folder
  ├── __toc__.json                        <-- Table of Contents (Optional but highly recommended)
  ├── 001-introduction/                   <-- Topic Folder
  │   └── 001-introduction.html           <-- MUST match the folder name!
  ├── 002-load-balancing/                 <-- Topic Folder
  │   ├── 002-load-balancing.html         <-- MUST match the folder name!
  │   ├── Codes_1/                        <-- Will be automatically bundled into LegacyWorkspace!
  │   │   ├── server.js
  │   │   └── package.json
  │   └── images/                         <-- Skipped automatically to save space
  │       └── diagram.png
```

## Features

* **Idempotent Migration**: The script generates a precise `structure_hash` for each course based on its topics. If you run the migrator twice on the same folder, it instantly skips existing courses to prevent duplicates!
* **Workspace Bundling**: Automatically finds code snippets and text assets next to your `.html` files and packages them into the database so the viewer can render Monaco code editors.
* **Smart Filtering**: Automatically ignores massive `node_modules`, `venv`, and binary image files to keep the migration lightning fast.
