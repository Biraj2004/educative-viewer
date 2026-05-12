# Edu-Viewer PRO

Local-first full-stack viewer for structured educational content (courses, topics, quizzes, code, and media), with a single-script local launcher.

## Local setup (one script)

Prereqs:
- Node.js 18+
- Python 3.10+

From the repo root:

```powershell
node local-start.js
```

What the launcher does:
- Creates `server/env` if missing and installs backend dependencies.
- Generates RSA keys and updates `server/.env` with local defaults.
- Writes local runtime values into `client/.env.local`.
- Prompts once for the static API root (defaults to the parent folder of the course DB) and creates `<staticRoot>/api/images`.
- Builds the Next.js production bundle only when `.next` is missing (use `--force-build` when you want a rebuild).
- Starts Flask, Next.js, and an embedded proxy on port 80.

Open the app:
- http://localhost/

Useful options:

```powershell
# Force a production rebuild
node local-start.js --force-build

# Skip build (requires existing client/.next)
node local-start.js --skip-build

# Use alternate ports if 80 is unavailable
node local-start.js --proxy-port 3000 --client-port 3001

# Point static assets to another folder
node local-start.js --static-root D:\path\to\static

# Edit local server env values (invite codes, JWT secret, DB paths)
node local-start.js --edit-env
```

Notes:
- On Windows, port 80 requires an elevated shell. If it fails, re-run as Administrator or use `--proxy-port`.
- Static images must live under `<staticRoot>/api/images` and will be served at `/api/images/...`.
- Default invite code for local is `local`.

## Manual setup

For the full manual setup guide, see [README_DETAILED.md](README_DETAILED.md).
