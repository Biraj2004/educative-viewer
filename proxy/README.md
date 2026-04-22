# Reverse Proxy Setup (Nginx + Apache, Windows + Linux)

This project uses one URL space for both backend APIs and static files under `/api`.

Required behavior:
- If the request path is a known backend API endpoint, forward to Flask backend (`127.0.0.1:5000`).
- Otherwise, if the path starts with `/api/`, serve a static file from the static API directory.
- All non-`/api/*` requests go to the Next.js client (`127.0.0.1:3000`).

The ready-to-use config templates are in:
- `proxy/nginx-linux.conf`
- `proxy/nginx-windows.conf`
- `proxy/apache-linux.conf`
- `proxy/apache-windows.conf`

## Backend API endpoint allowlist

The proxy templates only forward these routes to Flask:

### Courses/content APIs
- `GET /api/paths`
- `GET /api/paths/{path_id}/courses`
- `GET /api/projects`
- `GET /api/projects/{project_id}/course`
- `GET /api/courses`
- `POST /api/course-details`
- `POST /api/topic-details`

### Contact API
- `POST /api/contact`

### Auth APIs
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/auth/2fa/setup`
- `PUT /api/auth/theme`
- `POST /api/auth/progress/topic`
- `DELETE /api/auth/progress/course`
- `POST /api/auth/signup/rollback`
- `POST /api/auth/2fa/enable`
- `POST /api/auth/2fa/verify`
- `POST /api/auth/forgot-password/request`
- `POST /api/auth/forgot-password/verify`
- `POST /api/auth/forgot-password/reset`

### Admin APIs
- `GET /api/admin/users`
- `PATCH /api/admin/set-user-status`
- `PATCH /api/admin/set-course-status`
- `GET /api/admin/test-components`
- `POST /api/admin/test-components`
- `DELETE /api/admin/test-components/{component_id}`

Any `/api/*` path not in this list is served from static files.

## Static API folder layout

Put your static files under the server root with this structure:

- Linux: `/var/www/educativeviewer/api/...`
- Windows: `C:/inetpub/wwwroot/educativeviewer/api/...`

Example:
- `/var/www/educativeviewer/api/images/logo.png` -> served at `https://your-domain.com/api/images/logo.png`

## Environment values

Use these values so browser calls stay on one domain and let Nginx/Apache split routes.

### client/.env.local

Set:

```env
PROXY_SECRET=change-me-if-you-still-use-cloudflare-worker
NEXT_PUBLIC_BACKEND_API_BASE=https://your-domain.com/
NEXT_PUBLIC_STATIC_FILES_BASE=https://your-domain.com/
VERCEL_ENV=development
NEXT_PUBLIC_RSA_PUBLIC_KEY=your-public-key-here
# Optional Basic auth header value for protected static worker URLs.
# Example: Basic YWRtaW46YWRtaW4=
NEXT_PUBLIC_STATIC_BASIC_AUTH=
```

Notes:
- `NEXT_PUBLIC_BACKEND_API_BASE` points to the site root, not `/api`, because backend routes already contain `/api/...`.
- `NEXT_PUBLIC_STATIC_FILES_BASE` points to `/api` because static assets are under `/api/*`.

### server/.env

Minimum relevant values:

```env
FLASK_PORT=5000
FLASK_DEBUG=0

JWT_SECRET=replace-with-strong-secret
JWT_EXPIRES_DAYS=7
INVITE_CODES=abcdef
TOTP_ISSUER=EduViewer

RSA_PRIVATE_KEY=your-private-key-one-line-with-\n
# Optional for contact endpoint
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Keep your DB settings according to your selected backend (`oracle` or `sqlite`).

## Nginx setup

1. Copy one of these templates into your Nginx config path:
   - Linux: `proxy/nginx-linux.conf`
   - Windows: `proxy/nginx-windows.conf`
2. Edit:
   - `server_name`
   - `root` (your static API root parent, containing `api/`)
   - Upstream ports if changed
3. Validate and reload:

Linux:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Windows (example):
```powershell
nginx -t
nginx -s reload
```

## Apache setup

1. Enable required modules.

Linux (Debian/Ubuntu):
```bash
sudo a2enmod proxy proxy_http rewrite headers alias
sudo systemctl restart apache2
```

Windows:
- Ensure these modules are enabled in Apache config:
  - `mod_proxy`
  - `mod_proxy_http`
  - `mod_rewrite`
  - `mod_headers`
  - `mod_alias`

2. Copy one of these templates:
   - Linux: `proxy/apache-linux.conf`
   - Windows: `proxy/apache-windows.conf`

3. Edit:
   - `ServerName`
   - `Alias /api/ ...` directory path
   - Backend/client upstream ports if needed

4. Validate and reload:

Linux:
```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

Windows (example):
```powershell
httpd -t
httpd -k restart
```

## Verification checklist

After config is loaded, test:

1. Backend endpoint should hit Flask:
```bash
curl -i https://your-domain.com/api/auth/me
```
(Expected: backend-style JSON response, usually 401 if no token.)

2. Static file path under `/api` should not hit Flask:
```bash
curl -i https://your-domain.com/api/images/logo.png
```
(Expected: static file content if present, or 404 from web server static path.)

3. Non-`/api` should hit Next.js:
```bash
curl -i https://your-domain.com/
```

4. Unknown `/api` path should be static resolution only:
```bash
curl -i https://your-domain.com/api/not-a-backend-route
```
(Expected: static 404 unless file exists; should not be proxied to Flask.)

## When backend APIs change

If you add/remove Flask routes, update all 4 proxy templates so endpoint matching stays correct.
