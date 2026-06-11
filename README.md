# Edu-Viewer PRO 🎓

A modern, highly-polished local educational viewer for structured content (courses, paths, cloudlabs, and projects). 

Edu-Viewer PRO is designed to run locally, serve content directly from local SQLite databases, bundle sandboxed workspaces, support dark modes, and provide an extremely premium browser experience.

---

## ✨ Updates
- v1.0.188+ updates
    ```
    Please rebuild the project using --force-build command as environment variables were updated.
    Auth DB may need to be deleted if you face issues.
    ```

## ✨ Key Features

* **⚡ Single-Command Startup**: Run one command (`node local-start.js`) and everything (Flask API backend, Next.js frontend, and SSL proxy) is automatically configured, built, and started.
* **🔒 Automatic HTTPS & SSL**: Generates self-signed certificates out-of-the-box so features like browser cryptos and sandboxes work flawlessly.
* **🚀 Premium UI/UX**: Responsive modern dashboard, HSL tailormade colors, sleek dark mode, and fluid micro-animations.
* **🗄️ Multi-Database Support**: Load multiple database files simultaneously.
* **💾 Rich Content Rendering**: Supports complex components including SlateHTML, MarkdownEditor, interactive workspaces, and drawing canvas sketches.
* **📥 Legacy Content Migration**: Seamlessly import your custom folder structure of downloaded HTML lessons using the built-in migration suite.

---

## 📋 Requirements

Before launching, please ensure you have the following installed:

* **[Node.js 18+](https://nodejs.org/)** (LTS version recommended)
* **[Python 3.10+](https://www.python.org/downloads/)** (Make sure `python` is added to your system environment variables)

---

## 🚀 Getting Started

Launch the app from the root of this project:

```powershell
node local-start.js
```

### What happens on the first run?
The startup script is fully automated:
1. **Python Virtual Environment**: Setup in `server/env/` and installs backend dependencies.
2. **Security Keys**: Generates RSA keys for JWT tokens inside `server/.env`.
3. **Database Prompt**: Prompts you for your database paths (add as many as you need!).
4. **Next.js Builder**: Builds the production bundle (takes ~1-2 mins on first run).
5. **Start Servers**: Spawns Flask, Next.js, and the HTTPS proxy.

Once ready, go to **[https://localhost](https://localhost)** (bypass the self-signed certificate warning) and log in with invite code: **`local`**.

> **Note**: If port `443` is already in use or requires Administrator privilege, run the terminal as Administrator or specify a custom port: `node local-start.js --proxy-port 8443`.

---

## 🔑 Administrator Credentials

On first run, an administrator account is automatically bootstrapped:
* **Email**: `admin@localhost`
* **Password**: Stored securely inside `server/.bootstrap_admin_credentials.txt` (you will be prompted to change this on your first login).

---

## 📦 Importing Content (Legacy Migration)

You can import folder structures containing downloaded lessons into SQLite databases using the legacy migrator script.

```bash
# Move to the migration directory
cd migration

# Install natsort dependency
pip install -r requirements.txt

# Run the migrator in Auto mode
python legacy_migration.py --dir "C:\path\to\your\scraped\courses"
```

For advanced settings (such as **split database mode** which creates individual database files per course), check out the [Migration Documentation](migration/README.md).

---

## 🛠️ Useful Flags

Configure startup behavior via command line arguments:

```powershell
node local-start.js --force-build      # Force rebuild of the Next.js client
node local-start.js --skip-build       # Bypass build step, run existing client
node local-start.js --proxy-port 8443  # Use a custom non-privileged port
node local-start.js --edit-env         # Re-configure DB paths, static roots, or ports
```

---

## 📖 Sub-module Documentation

* [Migration Guide](migration/README.md) — How to parse, bundle, and split local HTML courses.
* [Deployment Guide](Cloudflare_Vercel.md) — Production setup for hosting on Cloudflare and Vercel.
* [Proxy Configs](proxy/README.md) — Manual Nginx/Apache configuration if not using the automated script.
* [Detailed Docs](README_DETAILED.md) — Technical deep-dive into internal modules and structure.
