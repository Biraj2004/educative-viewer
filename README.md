# Edu-Viewer PRO

A local viewer for structured educational content. One script starts everything.

## Updates
- From v1.0.66+ : Please rebuild the project using --force-build command as environment variables were updated.

## Requirements

Install these before running:

- **[Node.js 18+](https://nodejs.org/)** — download and install the LTS version
- **[Python 3.10+](https://www.python.org/downloads/)** — make sure it's on your PATH (`python --version` should work)

## Start locally

From the repo root:

```powershell
node local-start.js
```

> **Windows:** Port 80 requires an elevated shell — run PowerShell as **Administrator**, or use `--proxy-port 8080`.

### What happens on first run

The script is fully automated. It will:

1. **Create a Python venv** at `server/env/` and install backend dependencies.
2. **Generate RSA keys** and write them into `server/.env`.
3. **Ask for your course DB path(s)** — paste the full path to each DB file. After each entry you can add another with **Y/N**:
   ```
   Course DB path 1: C:\Users\you\Downloads\educative_scraper.db
   Add another course DB? [y/N]: y
   Course DB path 2: D:\Courses\extra.db
   Add another course DB? [y/N]: n
   ```
4. **Ask for the static API root** — the folder that holds course images. Just press **Enter** to accept the default (parent folder of the DB).
5. **Build the Next.js bundle** — takes ~1–2 min the first time.
6. Start Flask, Next.js, and the embedded proxy.

Once done, open **http://localhost** and log in with invite code **`local`**.

On **subsequent runs** all prompts are skipped — it starts straight away.

## Useful flags

```powershell
node local-start.js --force-build      # force a full rebuild
node local-start.js --skip-build       # skip build, serve existing .next
node local-start.js --proxy-port 8080  # use a non-privileged port
node local-start.js --edit-env         # change saved settings (DB path, ports, etc.)
```

## Versioning

The version shown in the navbar (`v1.x.x`) is stored in `client/.env.local.example`:

```
NEXT_PUBLIC_VERSION=1.0.63
```

CI auto-increments the patch on every push to `main`. To bump major or minor, edit this line and commit.

## More docs

| | |
|---|---|
| [README_DETAILED.md](README_DETAILED.md) | Full detailed README |
| [Cloudflare_Vercel.md](Cloudflare_Vercel.md) | Production deployment (Cloudflare + Vercel) |
| [proxy/README.md](proxy/README.md) | Nginx / Apache proxy configs |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
