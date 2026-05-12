#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');

const SERVER_ENV_PATH = path.join(SERVER_DIR, '.env');
const SERVER_ENV_EXAMPLE_PATH = path.join(SERVER_DIR, '.env.example');
const CLIENT_ENV_PATH = path.join(CLIENT_DIR, '.env.local');
const CLIENT_ENV_EXAMPLE_PATH = path.join(CLIENT_DIR, '.env.local.example');

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const proxyPort = parsePort(args['proxy-port'] || process.env.EV_PROXY_PORT, 80, 'proxy-port');
const backendPort = parsePort(args['backend-port'] || process.env.EV_BACKEND_PORT, 5000, 'backend-port');
const clientPort = parsePort(args['client-port'] || process.env.EV_CLIENT_PORT, 3000, 'client-port');
const skipBuild = !!args['skip-build'] || process.env.EV_SKIP_BUILD === '1';
const forceBuild = !!args['force-build'] || process.env.EV_FORCE_BUILD === '1';
const editEnv = !!args['edit-env'] || process.env.EV_EDIT_ENV === '1';

const children = [];
let proxyServer = null;

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  ensureNodeVersion();
  ensureNpm();

  const python = resolvePythonCommand();
  ensurePythonVersion(python.versionText);

  const venvPython = ensureVenv(python);
  installPythonDeps(venvPython);

  const serverEnv = await ensureServerEnv({
    backendPort,
    pythonExec: venvPython,
    rl,
    editEnv,
  });
  const publicKeyOneline = serverEnv.publicKeyOneline;
  const defaultStaticRoot = serverEnv.courseDbPath
    ? path.dirname(serverEnv.courseDbPath)
    : SERVER_DIR;
  let staticRootValue =
    args['static-root'] || process.env.EV_STATIC_API_ROOT || serverEnv.staticRootFromEnv;

  if (!staticRootValue || isPlaceholder(staticRootValue)) {
    staticRootValue = await promptStaticRoot(rl, defaultStaticRoot);
    updateServerEnv({ EV_STATIC_API_ROOT: staticRootValue });
  } else if (args['static-root']) {
    updateServerEnv({ EV_STATIC_API_ROOT: staticRootValue });
  }

  const staticRoot = path.resolve(staticRootValue || defaultStaticRoot);

  rl.close();

  ensureClientEnv({
    proxyPort,
    publicKeyOneline,
  });

  ensureStaticRoot(staticRoot);

  printEnvSummary({
    proxyPort,
    backendPort,
    clientPort,
    authDbPath: serverEnv.authDbPath,
    courseDbPath: serverEnv.courseDbPath,
    inviteCodes: serverEnv.inviteCodes,
    staticRoot,
  });

  const backendProcess = startBackend(venvPython);
  const clientProcess = await startClient({ skipBuild, forceBuild, clientPort });

  proxyServer = startProxyServer({
    proxyPort,
    backendPort,
    clientPort,
    staticRoot,
  });

  console.log('');
  console.log('[ready] Local environment is starting.');
  console.log(`[ready] Proxy:  http://localhost:${proxyPort}`);
  console.log(`[ready] Client: http://localhost:${clientPort}`);
  console.log(`[ready] Flask:  http://localhost:${backendPort}`);
  console.log(`[ready] Static root: ${staticRoot}`);

  children.push(backendProcess, clientProcess);
  attachShutdownHandlers();
}

function printUsage() {
  console.log('Local launcher for EducativeViewer');
  console.log('');
  console.log('Usage: node local-start.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --proxy-port <port>    Proxy port (default: 80)');
  console.log('  --backend-port <port>  Flask port (default: 5000)');
  console.log('  --client-port <port>   Next.js port (default: 3000)');
  console.log('  --static-root <path>   Static API root (default: parent of course DB)');
  console.log('  --skip-build           Skip Next.js build (requires existing .next)');
  console.log('  --force-build          Rebuild Next.js even if .next exists');
  console.log('  --edit-env             Prompt to edit server env values');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function parsePort(value, fallback, label) {
  if (!value) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    console.error(`[error] Invalid ${label}: ${value}`);
    process.exit(1);
  }
  return parsed;
}

function ensureNodeVersion() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error('[error] Node.js 18+ is required.');
    process.exit(1);
  }
}

function ensureNpm() {
  const result = spawnSync('npm -v', { shell: true, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('[error] npm is not available. Install Node.js 18+ first.');
    process.exit(1);
  }
}

function resolvePythonCommand() {
  const candidates = [
    { cmd: 'python', baseArgs: [] },
    { cmd: 'py', baseArgs: ['-3'] },
    { cmd: 'python3', baseArgs: [] },
  ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.cmd, [...candidate.baseArgs, '-V'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (result.status === 0) {
      const versionText = (result.stdout || result.stderr || '').trim();
      return { ...candidate, versionText };
    }
  }

  console.error('[error] Python 3.10+ is required but was not found on PATH.');
  process.exit(1);
}

function ensurePythonVersion(versionText) {
  const match = versionText.match(/Python\s+(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  if (major < 3 || (major === 3 && minor < 10)) {
    console.error(`[error] Python 3.10+ is required. Detected: ${versionText}`);
    process.exit(1);
  }
}

function ensureEnvFile(targetPath, templatePath) {
  if (fs.existsSync(targetPath)) return;
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, targetPath);
    return;
  }
  fs.writeFileSync(targetPath, '', 'utf8');
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const vars = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function saveEnvFilePreservingTemplate(targetPath, templatePath, vars) {
  if (!fs.existsSync(templatePath)) {
    const out = Object.entries(vars)
      .map(([key, val]) => `${key}=${val}`)
      .join('\n') + '\n';
    fs.writeFileSync(targetPath, out, 'utf8');
    return;
  }

  const templateVars = parseEnvFile(templatePath);
  const lines = fs.readFileSync(templatePath, 'utf8').split('\n');
  let out = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      out += line + '\n';
      continue;
    }
    const key = trimmed.split('=')[0].trim();
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      out += `${key}=${vars[key]}\n`;
    } else {
      out += line + '\n';
    }
  }

  for (const [key, val] of Object.entries(vars)) {
    if (!Object.prototype.hasOwnProperty.call(templateVars, key)) {
      out += `${key}=${val}\n`;
    }
  }

  fs.writeFileSync(targetPath, out, 'utf8');
}

function updateServerEnv(updates) {
  ensureEnvFile(SERVER_ENV_PATH, SERVER_ENV_EXAMPLE_PATH);
  const current = parseEnvFile(SERVER_ENV_PATH);
  const finalVars = { ...current, ...updates };
  saveEnvFilePreservingTemplate(SERVER_ENV_PATH, SERVER_ENV_EXAMPLE_PATH, finalVars);
}

function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.trim().toLowerCase();
  if (!lower) return true;
  if (lower.includes('/path/to/')) return true;
  if (lower.includes('\\path\\to\\')) return true;
  if (lower.includes('your-') || lower.includes('your_')) return true;
  if (lower.includes('changeme') || lower.includes('change-me')) return true;
  if (lower === 'abcdef') return true;
  if (lower === 'your-public-key-here') return true;
  if (lower === 'your-proxy-secret-here') return true;
  return false;
}

async function ensureServerEnv({ backendPort, pythonExec, rl, editEnv }) {
  ensureEnvFile(SERVER_ENV_PATH, SERVER_ENV_EXAMPLE_PATH);

  const current = parseEnvFile(SERVER_ENV_PATH);
  const updates = {};

  const defaultAuthDbPath = path.join(SERVER_DIR, 'auth.sqlite3');
  const defaultCourseDbPath = path.join(SERVER_DIR, 'course.sqlite3');
  const currentCourseDbPath = current.COURSE_SQLITE_DB_PATH || current.DB_PATH || '';

  if (isPlaceholder(current.FLASK_PORT)) updates.FLASK_PORT = String(backendPort);
  if (isPlaceholder(current.FLASK_DEBUG)) updates.FLASK_DEBUG = '0';

  const oracleConfigured = ![
    current.ORACLE_USER,
    current.ORACLE_PASSWORD,
    current.ORACLE_DSN,
  ].some(isPlaceholder);

  const engine = (current.AUTH_DB_ENGINE || '').trim().toLowerCase();
  const needsEngine = isPlaceholder(engine);
  const shouldForceSqlite = !oracleConfigured && (!engine || engine === 'oracle' || needsEngine);
  const useSqlite = shouldForceSqlite || engine === 'sqlite' || needsEngine;

  if (shouldForceSqlite || needsEngine) updates.AUTH_DB_ENGINE = 'sqlite';
  if (useSqlite && isPlaceholder(current.AUTH_SQLITE_DB_PATH)) {
    updates.AUTH_SQLITE_DB_PATH = defaultAuthDbPath;
  }

  if (isPlaceholder(current.COURSE_DB_ENGINE)) updates.COURSE_DB_ENGINE = 'sqlite';
  if (isPlaceholder(current.COURSE_SQLITE_DB_PATH) && isPlaceholder(current.DB_PATH)) {
    updates.COURSE_SQLITE_DB_PATH = defaultCourseDbPath;
    updates.DB_PATH = defaultCourseDbPath;
  }

  if (rl) {
    const courseDefault = !isPlaceholder(currentCourseDbPath)
      ? currentCourseDbPath
      : defaultCourseDbPath;
    const shouldPromptCourse = editEnv || isPlaceholder(currentCourseDbPath);
    if (shouldPromptCourse) {
      const chosen = await promptValue(rl, 'Course DB path', courseDefault);
      updates.COURSE_SQLITE_DB_PATH = chosen;
      updates.DB_PATH = chosen;
    }
  }

  if (rl && editEnv) {
    const currentInvite = current.INVITE_CODES || updates.INVITE_CODES || 'local';
    const inviteCodes = await promptValue(rl, 'Invite codes (CSV)', currentInvite, { allowEmpty: false });
    updates.INVITE_CODES = inviteCodes;

    const currentJwt = current.JWT_SECRET || updates.JWT_SECRET || '';
    const jwtSecret = await promptValue(rl, 'JWT secret', currentJwt || crypto.randomBytes(32).toString('hex'), {
      sensitive: true,
    });
    updates.JWT_SECRET = jwtSecret;

    if (useSqlite) {
      const currentAuthPath = current.AUTH_SQLITE_DB_PATH || updates.AUTH_SQLITE_DB_PATH || defaultAuthDbPath;
      const authPath = await promptValue(rl, 'Auth DB path (SQLite)', currentAuthPath);
      updates.AUTH_SQLITE_DB_PATH = authPath;
    }
  }

  if (isPlaceholder(current.JWT_SECRET)) {
    updates.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
  if (isPlaceholder(current.INVITE_CODES)) updates.INVITE_CODES = 'local';
  if (isPlaceholder(current.TOTP_ISSUER)) updates.TOTP_ISSUER = 'EduViewer';

  let publicKeyOneline = '';
  if (isPlaceholder(current.RSA_PRIVATE_KEY)) {
    const keys = generateRsaKeysWithPython(pythonExec);
    updates.RSA_PRIVATE_KEY = keys.privateKeyOneline;
    publicKeyOneline = keys.publicKeyOneline;
  } else {
    publicKeyOneline = derivePublicKeyWithPython(pythonExec, current.RSA_PRIVATE_KEY);
  }

  const finalVars = { ...current, ...updates };
  saveEnvFilePreservingTemplate(SERVER_ENV_PATH, SERVER_ENV_EXAMPLE_PATH, finalVars);

  const courseDbPathRaw = finalVars.COURSE_SQLITE_DB_PATH || finalVars.DB_PATH || defaultCourseDbPath;
  const courseDbPath = resolvePathFrom(SERVER_DIR, courseDbPathRaw);
  const authDbPathRaw = finalVars.AUTH_SQLITE_DB_PATH || defaultAuthDbPath;
  const authDbPath = resolvePathFrom(SERVER_DIR, authDbPathRaw);
  const staticRootFromEnv = finalVars.EV_STATIC_API_ROOT || '';
  const inviteCodes = finalVars.INVITE_CODES || '';

  return {
    publicKeyOneline,
    authDbPath,
    courseDbPath,
    staticRootFromEnv,
    inviteCodes,
  };
}

function generateRsaKeysWithPython(pythonExec) {
  const code = [
    'from cryptography.hazmat.primitives.asymmetric import rsa',
    'from cryptography.hazmat.primitives import serialization',
    'priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)',
    'priv_pem = priv.private_bytes(',
    '    encoding=serialization.Encoding.PEM,',
    '    format=serialization.PrivateFormat.TraditionalOpenSSL,',
    '    encryption_algorithm=serialization.NoEncryption(),',
    ').decode().strip().replace("\\n", "\\\\n")',
    'pub_pem = priv.public_key().public_bytes(',
    '    encoding=serialization.Encoding.PEM,',
    '    format=serialization.PublicFormat.SubjectPublicKeyInfo,',
    ').decode().strip().replace("\\n", "\\\\n")',
    'print(priv_pem)',
    'print(pub_pem)',
  ].join('\n');

  const output = runPythonSnippet(pythonExec, code, {});
  const lines = output.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    console.error('[error] Failed to generate RSA keys using Python.');
    process.exit(1);
  }

  return {
    privateKeyOneline: lines[0],
    publicKeyOneline: lines[1],
  };
}

function derivePublicKeyWithPython(pythonExec, privateKeyOneline) {
  const code = [
    'import os',
    'from cryptography.hazmat.primitives import serialization',
    'from cryptography.hazmat.primitives.serialization import load_pem_private_key',
    'raw = os.environ.get("EV_RSA_PRIVATE_KEY", "")',
    'pem = raw.replace("\\\\n", "\\n").encode()',
    'key = load_pem_private_key(pem, password=None)',
    'pub = key.public_key().public_bytes(',
    '    encoding=serialization.Encoding.PEM,',
    '    format=serialization.PublicFormat.SubjectPublicKeyInfo,',
    ').decode().strip().replace("\\n", "\\\\n")',
    'print(pub)',
  ].join('\n');

  const output = runPythonSnippet(pythonExec, code, {
    EV_RSA_PRIVATE_KEY: privateKeyOneline,
  });

  const line = output.split(/\r?\n/).find((value) => value.trim());
  if (!line) {
    console.error('[error] Failed to derive RSA public key from RSA_PRIVATE_KEY.');
    console.error('        Re-run after clearing RSA_PRIVATE_KEY in server/.env.');
    process.exit(1);
  }

  return line.trim();
}

function runPythonSnippet(pythonExec, code, extraEnv) {
  const result = spawnSync(pythonExec, ['-c', code], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    console.error('[error] Python RSA helper failed.');
    process.exit(result.status ?? 1);
  }

  return (result.stdout || '').toString().trim();
}

function ensureClientEnv({ proxyPort, publicKeyOneline }) {
  ensureEnvFile(CLIENT_ENV_PATH, CLIENT_ENV_EXAMPLE_PATH);

  const current = parseEnvFile(CLIENT_ENV_PATH);
  const updates = {
    PROXY_SECRET: 'local-proxy',
    NEXT_PUBLIC_BACKEND_API_BASE: `http://localhost:${proxyPort}/`,
    NEXT_PUBLIC_STATIC_FILES_BASE: `http://localhost:${proxyPort}/`,
    NEXT_PUBLIC_STATIC_BASIC_AUTH: '',
    VERCEL_ENV: 'development',
    NEXT_PUBLIC_RSA_PUBLIC_KEY: publicKeyOneline,
  };

  const finalVars = { ...current, ...updates };
  saveEnvFilePreservingTemplate(CLIENT_ENV_PATH, CLIENT_ENV_EXAMPLE_PATH, finalVars);
}

function ensureStaticRoot(rootPath) {
  const apiImages = path.join(rootPath, 'api', 'images');
  fs.mkdirSync(apiImages, { recursive: true });
}

function ensureVenv(python) {
  const venvDir = path.join(SERVER_DIR, 'env');
  const venvPython = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  if (!fs.existsSync(venvPython)) {
    console.log('[setup] Creating venv in server/env ...');
    const result = spawnSync(python.cmd, [...python.baseArgs, '-m', 'venv', venvDir], {
      stdio: 'inherit',
      cwd: SERVER_DIR,
    });
    if (result.status !== 0) {
      console.error('[error] Failed to create Python venv.');
      process.exit(result.status ?? 1);
    }
  }

  return venvPython;
}

function installPythonDeps(venvPython) {
  console.log('[setup] Installing backend dependencies...');
  const result = spawnSync(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
    stdio: 'inherit',
    cwd: SERVER_DIR,
  });
  if (result.status !== 0) {
    console.error('[error] pip install failed.');
    process.exit(result.status ?? 1);
  }
}

function startBackend(venvPython) {
  console.log('[start] Flask backend');
  const child = spawn(venvPython, ['app.py'], {
    cwd: SERVER_DIR,
    stdio: 'inherit',
  });
  child.on('exit', (code) => handleChildExit('backend', code));
  return child;
}

async function startClient({ skipBuild, forceBuild, clientPort }) {
  console.log('[setup] Installing client dependencies if needed...');
  if (!fs.existsSync(path.join(CLIENT_DIR, 'node_modules'))) {
    const installResult = spawnSync('npm install', {
      shell: true,
      stdio: 'inherit',
      cwd: CLIENT_DIR,
    });
    if (installResult.status !== 0) {
      console.error('[error] npm install failed.');
      process.exit(installResult.status ?? 1);
    }
  }

  const nextDir = path.join(CLIENT_DIR, '.next');
  const hasBuild = fs.existsSync(nextDir);
  const shouldBuild = forceBuild || (!hasBuild && !skipBuild);

  if (shouldBuild) {
    console.log('[build] Next.js build');
    const buildResult = spawnSync('npx next build', {
      shell: true,
      stdio: 'inherit',
      cwd: CLIENT_DIR,
    });
    if (buildResult.status !== 0) {
      console.error('[error] Next.js build failed.');
      process.exit(buildResult.status ?? 1);
    }
  } else if (!hasBuild) {
    console.error('[error] .next folder not found. Remove --skip-build or run a build first.');
    process.exit(1);
  } else {
    console.log('[build] Skipped (using existing .next)');
  }

  console.log('[start] Next.js server');
  const child = spawn('npx', ['next', 'start', '-p', String(clientPort)], {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => handleChildExit('client', code));
  return child;
}

function startProxyServer({ proxyPort, backendPort, clientPort, staticRoot }) {
  const backendTarget = { host: '127.0.0.1', port: backendPort };
  const clientTarget = { host: '127.0.0.1', port: clientPort };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname || '/';

    if (isBackendApi(pathname)) {
      proxyRequest(req, res, backendTarget);
      return;
    }

    if (pathname.startsWith('/api/')) {
      serveStatic(req, res, staticRoot, pathname);
      return;
    }

    proxyRequest(req, res, clientTarget);
  });

  server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  server.on('error', (err) => {
    if (err && err.code === 'EACCES') {
      console.error('[error] Proxy port requires elevated privileges.');
      console.error('        Re-run as Administrator or choose a higher port with --proxy-port.');
    } else if (err && err.code === 'EADDRINUSE') {
      console.error('[error] Proxy port is already in use. Choose another port with --proxy-port.');
    } else {
      console.error('[error] Proxy failed to start:', err && err.message ? err.message : err);
    }
    shutdown();
  });

  server.listen(proxyPort, '0.0.0.0');
  console.log(`[start] Embedded proxy listening on :${proxyPort}`);
  return server;
}

const BACKEND_API_PATTERNS = [
  /^\/api\/paths\/?$/i,
  /^\/api\/paths\/\d+\/courses\/?$/i,
  /^\/api\/projects\/?$/i,
  /^\/api\/projects\/\d+\/course\/?$/i,
  /^\/api\/courses\/?$/i,
  /^\/api\/course-details\/?$/i,
  /^\/api\/topic-details\/?$/i,
  /^\/api\/contact\/?$/i,
  /^\/api\/auth\/signup\/?$/i,
  /^\/api\/auth\/login\/?$/i,
  /^\/api\/auth\/me\/?$/i,
  /^\/api\/auth\/logout\/?$/i,
  /^\/api\/auth\/change-password\/?$/i,
  /^\/api\/auth\/2fa\/setup\/?$/i,
  /^\/api\/auth\/theme\/?$/i,
  /^\/api\/auth\/progress\/topic\/?$/i,
  /^\/api\/auth\/progress\/course\/?$/i,
  /^\/api\/auth\/signup\/rollback\/?$/i,
  /^\/api\/auth\/2fa\/enable\/?$/i,
  /^\/api\/auth\/2fa\/verify\/?$/i,
  /^\/api\/auth\/forgot-password\/request\/?$/i,
  /^\/api\/auth\/forgot-password\/verify\/?$/i,
  /^\/api\/auth\/forgot-password\/reset\/?$/i,
  /^\/api\/admin\/users\/?$/i,
  /^\/api\/admin\/set-user-status\/?$/i,
  /^\/api\/admin\/set-course-status\/?$/i,
  /^\/api\/admin\/test-components\/?$/i,
  /^\/api\/admin\/test-components\/\d+\/?$/i,
];

function isBackendApi(pathname) {
  return BACKEND_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

function proxyRequest(req, res, target) {
  const options = {
    hostname: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${target.host}:${target.port}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.statusCode = 502;
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res, staticRoot, pathname) {
  let safePath;
  try {
    safePath = decodeURIComponent(pathname);
  } catch {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const filePath = path.resolve(staticRoot, `.${safePath}`);
  const rootResolved = path.resolve(staticRoot);
  if (!filePath.startsWith(rootResolved)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    res.setHeader('Content-Type', getMimeType(filePath));
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Server Error');
    });
    stream.pipe(res);
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.json': return 'application/json';
    case '.txt': return 'text/plain';
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'application/javascript';
    case '.map': return 'application/json';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    default: return 'application/octet-stream';
  }
}

function handleChildExit(name, code) {
  if (code === 0) {
    console.log(`[exit] ${name} exited.`);
  } else {
    console.error(`[exit] ${name} exited with code ${code}. Shutting down.`);
    shutdown();
  }
}

function resolvePathFrom(baseDir, rawPath) {
  if (!rawPath) return '';
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(baseDir, rawPath);
}

async function promptStaticRoot(rl, defaultRoot) {
  const question = `Static API root (contains /api/images) [${defaultRoot}]: `;
  const answer = await ask(rl, question);
  return answer.trim() || defaultRoot;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function printEnvSummary({
  proxyPort,
  backendPort,
  clientPort,
  authDbPath,
  courseDbPath,
  inviteCodes,
  staticRoot,
}) {
  console.log('');
  console.log('[env] Local environment summary');
  console.log(`  Proxy port:        ${proxyPort}`);
  console.log(`  Backend port:      ${backendPort}`);
  console.log(`  Client port:       ${clientPort}`);
  console.log(`  Auth DB path:      ${authDbPath}`);
  console.log(`  Course DB path:    ${courseDbPath}`);
  console.log(`  Invite codes:      ${inviteCodes || 'local'}`);
  console.log(`  Static root:       ${staticRoot}`);
}

async function promptValue(rl, label, currentValue, options = {}) {
  const allowEmpty = options.allowEmpty !== false;
  const display = options.sensitive && currentValue
    ? `${String(currentValue).slice(0, 4)}***`
    : currentValue;
  const prompt = `${label} [${display || ''}]: `;
  const answer = (await ask(rl, prompt)).trim();
  if (!answer && !allowEmpty && !currentValue) {
    return promptValue(rl, label, currentValue, options);
  }
  return answer || currentValue;
}

function attachShutdownHandlers() {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function shutdown() {
  if (proxyServer) {
    try { proxyServer.close(); } catch { /* ignore */ }
  }

  for (const child of children) {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(0), 250);
}

main().catch((err) => {
  console.error('[fatal]', err && err.message ? err.message : err);
  process.exit(1);
});
