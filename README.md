<div align="center">

<img src="./client/public/icon-og.png" alt="Edu-Viewer PRO Logo" width="100" height="100" />

<h1>Edu-Viewer PRO</h1>

<p><strong>A premium full-stack platform for rendering structured educational content — offline, fast, and beautifully organized.</strong></p>

<p>Browse courses &nbsp;|&nbsp; Render interactive topics &nbsp;|&nbsp; Run code &nbsp;|&nbsp; Track progress &nbsp;|&nbsp; Self-host anywhere</p>

<!-- Badges -->
<p>
  <img src="https://img.shields.io/github/v/release/Biraj2004/educative-viewer?label=Latest%20Release&color=4f46e5" alt="Latest Release" />
  <img src="https://img.shields.io/github/issues/Biraj2004/educative-viewer?label=Issues&color=ef4444" alt="Issues" />
  <img src="https://img.shields.io/badge/Platform-Web-3b82f6?logo=googlechrome&logoColor=white" alt="Platform Web" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Min%20Node-18%2B-339933?logo=nodedotjs&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python&logoColor=white" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/License-MIT-22c55e" alt="License MIT" />
</p>

<!-- Action Buttons -->
<p>
  <a href="https://educative-viewer-guide.vercel.app/">
    <img src="https://img.shields.io/badge/📖%20SETUP-Guide%20Website-4f46e5?style=for-the-badge" alt="Guide Website" />
  </a>
  &nbsp;
  <a href="https://github.com/Biraj2004/educative-viewer/issues/new">
    <img src="https://img.shields.io/badge/🐛%20REPORT-Issue-ef4444?style=for-the-badge" alt="Report Issue" />
  </a>
  &nbsp;
  <a href="https://github.com/Biraj2004/educative-viewer/releases">
    <img src="https://img.shields.io/badge/🏷%20VIEW-Releases-2563eb?style=for-the-badge" alt="View Releases" />
  </a>
</p>

</div>

---

Edu-Viewer PRO is a clean, performance-focused full-stack web application for viewing and interacting with structured educational course content. It supports rich interactive components — code execution, diagrams, quizzes, Markdown/LaTeX rendering, and visual data structures — with a streamlined local and production deployment workflow.

---

## 📖 Full Setup Guide

> For a detailed visual walkthrough with screenshots and step-by-step instructions, visit the official guide:
>
> 🌐 **[educative-viewer-guide.vercel.app](https://educative-viewer-guide.vercel.app/)**
> &nbsp;&nbsp;&nbsp;📦 **[Guide Source Repository](https://github.com/Biraj2004/Educative-Viewer-Guide)**

---

## 🛠 Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React%2019-20232a?logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20v4-06b6d4?logo=tailwindcss&logoColor=white) |
| **Backend** | ![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white) ![Python](https://img.shields.io/badge/Python%203.10+-3776ab?logo=python&logoColor=white) |
| **Database** | ![SQLite](https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white) ![Oracle](https://img.shields.io/badge/Oracle%20DB-F80000?logo=oracle&logoColor=white) |
| **Auth** | ![JWT](https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=white) ![RSA-2048](https://img.shields.io/badge/RSA--2048-6b7280) ![TOTP 2FA](https://img.shields.io/badge/TOTP%202FA-4f46e5) |
| **Proxy** | ![Nginx](https://img.shields.io/badge/Nginx-009639?logo=nginx&logoColor=white) ![Apache](https://img.shields.io/badge/Apache-D22128?logo=apache&logoColor=white) |
| **Deployment** | ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white) |

</div>

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Prerequisites](#-prerequisites)
- [Repository Structure](#-repository-structure)
- [Backend Setup](#-backend-setup-flask)
- [Frontend Setup](#-frontend-setup-nextjs)
- [Environment Variables](#️-environment-variables-reference)
- [Local Proxy Setup](#-local-proxy-setup)
- [Start Order — Quick Reference](#-start-order--quick-reference)
- [Verify Image Proxy](#-verify-image-proxy)
- [Troubleshooting](#-troubleshooting)
- [Related Documentation](#-related-documentation)

---

## 🏗 Architecture Overview

```
Browser → Nginx / Apache  (:80)
               ├── /api/*  →  Flask       (:5000)   known API routes
               ├── /api/*  →  local disk            static / image assets
               └── /*      →  Next.js     (:3000)   everything else
```

| Layer | Technology | Default Port |
|---|---|---|
| Frontend | Next.js App Router (React 19, TypeScript, Tailwind v4) | `3000` |
| Backend | Flask (Python 3.10+) | `5000` |
| Auth DB | Oracle or SQLite — configured via env | — |
| Course DB | SQLite — with optional shard mapping | — |
| Reverse Proxy | Nginx or Apache | `80` |

---

## ✅ Prerequisites

Install these before proceeding:

- **[Node.js 18+](https://nodejs.org/)** — required for the Next.js frontend
- **[Python 3.10+](https://www.python.org/)** — required for the Flask backend
- **[Nginx](https://nginx.org/)** or **[Apache](https://httpd.apache.org/)** — only needed for local proxy routing

---

## 📁 Repository Structure

```
educative-viewer/
├── client/                  # Next.js frontend (React 19, TypeScript, Tailwind v4)
├── server/                  # Flask backend (Python)
│   ├── backend/
│   │   ├── routes/          # Auth, courses, admin, contact endpoints
│   │   ├── db/              # SQLite + Oracle adapters, DB manager
│   │   ├── auth_service.py  # JWT, RSA, session, 2FA logic
│   │   └── config.py        # AppConfig — all env key parsing
│   ├── app.py               # Flask app entrypoint
│   └── setup_and_run.py     # First-time setup helper
├── proxy/                   # Ready-to-use Nginx and Apache config files
├── Cloudflare_Vercel.md     # Edge deployment: Cloudflare Worker + Vercel
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## 🔧 Backend Setup (Flask)

Open a terminal in the `server/` directory.

### First-time setup

```powershell
cd server

# Create and activate a virtual environment
python -m venv env
.\env\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the one-time setup script
python setup_and_run.py
```

> **Note:** The active setup entrypoint is `setup_and_run.py`. Any older references to `setup.py` in documentation are outdated.

`setup_and_run.py` does the following automatically:

1. Generates an **RSA-2048 key pair** and writes `RSA_PRIVATE_KEY` into `server/.env`.
2. Prints the RSA **public key** — **copy it**. You will paste it as `NEXT_PUBLIC_RSA_PUBLIC_KEY` when the frontend build prompts you.
3. Prompts for all required `.env` values: DB paths, JWT secret, invite codes, TOTP issuer, Flask port/debug settings.
4. Asks whether to start the Flask server immediately.

On subsequent runs, if `RSA_PRIVATE_KEY` is already set in `.env`, key generation is skipped and only env values are reviewed before starting.

### Subsequent runs (after initial setup)

```powershell
cd server
.\env\Scripts\Activate.ps1
python app.py
```

Keep this terminal running while the frontend is active.

---

## 🖥 Frontend Setup (Next.js)

Open a **second** terminal in the `client/` directory.

```powershell
cd client
npm install
node build-and-run.js
```

The interactive builder menu appears:

```
┌──────────────────────────────┐
│   Edu-Viewer PRO Builder     │
└──────────────────────────────┘

  1) Full build + obfuscate + zip + create new release
  2) Full build + obfuscate + zip + upload to existing release
  3) Build + obfuscate + zip only (no upload)
  4) Build + obfuscate + run local server
  5) Build only (no obfuscation) + zip
  6) Build and run local server
  7) Upload existing .next.zip to existing release
  8) Upload existing .next.zip as new release
  9) Manage saved GitHub repos
  0) Exit
```

**For local development → choose option `6`** — it will:

1. Prompt you to review or enter environment variable values (saved to `client/.env.local`).
2. Run a Next.js production build (no obfuscation — use option `4` if you need obfuscation).
3. Start the local server at `http://localhost:3000`.

> Every build option (`1`–`6`) prompts for environment variables before building. You never need to manually edit `client/.env.local`.

### CLI — non-interactive commands

```powershell
node build-and-run.js local      # prompt env → build → obfuscate → start server
node build-and-run.js serve      # prompt env → start server (requires existing .next folder)
node build-and-run.js build      # prompt env → build → obfuscate → zip
node build-and-run.js build:only # prompt env → build (no obfuscation) → zip
node build-and-run.js upload     # zip → upload to existing GitHub release
node build-and-run.js release    # zip → create new GitHub release
node build-and-run.js download   # download .next.zip from a GitHub release
```

---

## ⚙️ Environment Variables Reference

All variables below are prompted during every build. Defaults for a purely local setup are shown.

| Variable | Description | Local Default |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_API_BASE` | Base URL of the Flask backend | `http://localhost/` |
| `NEXT_PUBLIC_STATIC_FILES_BASE` | Base URL for static/image assets | `http://localhost/` |
| `NEXT_PUBLIC_RSA_PUBLIC_KEY` | RSA public key printed by `setup_and_run.py` | *(paste from server log)* |
| `NEXT_PUBLIC_STATIC_BASIC_AUTH` | Optional Basic Auth header for protected static worker | *(leave blank if unused)* |
| `PROXY_SECRET` | Shared secret for Cloudflare Worker `x-edu-proxy` header | *(not required locally)* |
| `VERCEL_ENV` | Deployment environment identifier | `development` |

> ⚠️ **Important:** In production (`VERCEL_ENV=production`), the Next.js middleware enforces `x-edu-proxy == PROXY_SECRET` on every request. Always set `VERCEL_ENV=development` for local runs.

---

## 🔀 Local Proxy Setup

Use this when you need a single `http://localhost` URL that:

- Routes known backend API paths (`/api/*`) to Flask on port `5000`
- Serves image/static files from local disk under `/api`
- Forwards all other requests to Next.js on port `3000`

### Option A — Nginx (Windows)

1. Use the config at `proxy/nginx-windows.conf`.
2. If your existing `nginx.conf` already has a default `server { ... }` block on port 80, **comment it out** — only one `localhost:80` server block should be active at a time.
3. Confirm these values in the config:

```nginx
server_name localhost;
root C:/inetpub/wwwroot/educativeviewer;
# Flask upstream:  127.0.0.1:5000
# Next.js upstream: 127.0.0.1:3000
```

4. Create the local static folder:

```
C:/inetpub/wwwroot/educativeviewer/api/images/
```

5. Test and reload:

```powershell
nginx -t
nginx -s reload
```

### Option B — Apache (Windows)

1. Use the config at `proxy/apache-windows.conf`.
2. If your main Apache config already has a `<VirtualHost *:80>` for localhost, **disable it** — only one active `localhost:80` virtual host is allowed.
3. Confirm the `Alias` path points to:

```
C:/inetpub/wwwroot/educativeviewer/api/
```

4. Place image files under:

```
C:/inetpub/wwwroot/educativeviewer/api/images/
```

5. Test and restart:

```powershell
httpd -t
httpd -k restart
```

---

## Start Order — Quick Reference

Follow this order on every run:

**1 — Start the backend**

```powershell
cd server
.\env\Scripts\Activate.ps1

# First run only (generates keys + .env prompts)
python setup_and_run.py

# All subsequent runs
python app.py
```

**2 — Start the frontend**

```powershell
cd client
node build-and-run.js
# → Choose option 6: Build and run local server
```

**3 — Start or reload the proxy**

```powershell
# Nginx
nginx -s reload

# Apache
httpd -k restart
```

**4 — Open the app**

```
http://localhost
```

> Always use `http://localhost` (through the proxy) — not `http://localhost:3000` — to get full routing including API calls and static assets.

---

## Verify Image Proxy

Place a test image at:

```
C:/inetpub/wwwroot/educativeviewer/api/images/logo.png
```

Then open in your browser:

```
http://localhost/api/images/logo.png
```

If the image renders correctly, local proxy static file serving is working.

---

## Troubleshooting

### API calls fail from the frontend

- Confirm Flask is running on port `5000`.
- Confirm `NEXT_PUBLIC_BACKEND_API_BASE=http://localhost/` is set in `client/.env.local`.
- Confirm the proxy is running and routing `/api/*` to Flask.

### Frontend does not start

- Always use `node build-and-run.js` — **do not** use `npm run dev`.
- Choose option `6` from the builder menu.
- To skip a rebuild and serve an existing build:
  ```powershell
  node build-and-run.js serve
  ```
  This requires an existing `.next` folder from a prior build.

### Images return 404 through proxy

- Confirm the file exists under `C:/inetpub/wwwroot/educativeviewer/api/...`.
- Confirm the `root` (Nginx) or `Alias` (Apache) path in your proxy config matches the actual folder path on disk exactly.

### Port already in use

- Change the conflicting port in the proxy config.
- Update the corresponding env variable (`NEXT_PUBLIC_BACKEND_API_BASE` or `NEXT_PUBLIC_STATIC_FILES_BASE`) to match the new port.

### Session expires immediately or login redirects unexpectedly

- Verify `NEXT_PUBLIC_RSA_PUBLIC_KEY` in `client/.env.local` exactly matches the public key printed by `setup_and_run.py`.
- An RSA key mismatch causes password encryption to fail silently in the browser, resulting in unexpected auth failures.

---

## Related Documentation

| Document | Description |
|---|---|
| [`Cloudflare_Vercel.md`](Cloudflare_Vercel.md) | Edge deployment pattern using Cloudflare Worker + Vercel |
| [`proxy/README.md`](proxy/README.md) | Detailed proxy routing rules and config reference |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines |
| [`SECURITY.md`](SECURITY.md) | Security policy and responsible disclosure |
| [Setup Guide Website](https://educative-viewer-guide.vercel.app/) | Visual walkthrough guide for local and production setup |
| [Guide Source Repository](https://github.com/Biraj2004/Educative-Viewer-Guide) | Source code for the official setup guide website |

---

<div align="center">

Made with ❤️ by [Biraj Sarkar](https://github.com/Biraj2004) &nbsp;•&nbsp; [Anilabha Datta](https://github.com/anilabhadatta)

</div>
