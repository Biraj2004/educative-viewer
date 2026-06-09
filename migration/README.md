# Educative Legacy Content Migrator

This script migrates downloaded legacy HTML courses, paths, projects, and cloudlabs into the application's SQLite database. It seamlessly converts raw directory structures into properly linked database entries that the viewer understands.

## Prerequisites

Make sure you have installed the required dependencies:

```bash
pip install -r requirements.txt
```

*(The only external dependency is `natsort`, which is required to properly sort numerically prefixed lesson HTML files like `1-intro.html` vs `10-summary.html`)*

## Usage

You can run the migrator using Python:

```bash
python legacy_migration.py --dir <path_to_content> --type <content_type>
```

### Arguments:

*   `--dir` **(Required)**: The absolute or relative path to the directory containing your downloaded content. 
*   `--type` **(Required)**: The type of content you are migrating. Must be one of:
    *   `Course`
    *   `Path`
    *   `Cloudlab`
    *   `Project`
*   `--db`: Path to the target SQLite DB file. (Defaults to `educative_scraper_legacy.db` in your current directory).
*   `--title`: An optional explicit title to give the imported content. If omitted, it will try to read the title from `__toc__.json`, or fallback to using the name of the folder itself.

## How it works for Paths (`--type Path`)

When migrating a **Path**, the `--dir` should point to the root directory of the entire Path. 
The migrator will automatically:
1. Create a single overarching `Path` entry in the database.
2. Iterate through all the *subdirectories* inside your `--dir`.
3. Treat each subdirectory as a separate **Course**.
4. Parse the `__toc__.json` inside each course subdirectory, naturally sort the `.html` lesson files, and link all of those topics/components to the overarching Path.

### Example Path Directory Structure:
```text
/Advanced Web Architecture Path/     <-- You pass this to --dir
  ├── Course 1: Basics/              <-- Script auto-creates Course 1
  │   ├── __toc__.json
  │   ├── 1-introduction.html
  │   └── 2-server.html
  └── Course 2: Advanced/            <-- Script auto-creates Course 2
      ├── __toc__.json
      ├── 1-load-balancers.html
      └── 2-caching.html
```
