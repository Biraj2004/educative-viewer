#!/usr/bin/env node
/**
 * build.js
 *
 * Build, obfuscate, zip, release and run EducativeViewer.
 *
 * Usage:
 *   node build.js            — full interactive menu
 *   node build.js build:only  — clean + build only (no obfuscation, no zip)
 *   node build.js build      — build + obfuscate + zip only (no upload)
 *   node build.js local      — build + obfuscate + start local server
 *   node build.js serve      — start local server using existing .next folder
 *   node build.js upload     — zip + upload to existing GitHub release
 *   node build.js release    — zip + create new GitHub release
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const ROOT        = __dirname;
const NEXT_DIR    = path.join(ROOT, '.next');
const CHUNKS_DIR  = path.join(NEXT_DIR, 'static', 'chunks');
const ZIP_PATH    = path.join(ROOT, '.next.zip');
const ENV_PATH    = path.join(ROOT, '.env.local');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd) {
  console.log(`\n> ${cmd}`);
  const result = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: ROOT });
  if (result.status !== 0) {
    console.error(`\n[ERROR] Command failed: ${cmd}`);
    process.exit(result.status ?? 1);
  }
}

// Spawn the Next.js server as a child process so Ctrl+C properly shuts it down
function runServer() {
  console.log('\n> npx next start');
  console.log('[*] Press Ctrl+C to stop the server.\n');
  const { spawn } = require('child_process');
  const child = spawn('npx', ['next', 'start'], {
    shell: true, stdio: 'inherit', cwd: ROOT,
  });
  const shutdown = () => {
    console.log('\n[*] Shutting down server...');
    child.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
  child.on('exit', code => process.exit(code ?? 0));
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function header(title) {
  const line = '─'.repeat(title.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title}  │`);
  console.log(`└${line}┘`);
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function stepInstallObfuscator() {
  header('Install javascript-obfuscator');
  const existing = runCapture('javascript-obfuscator --version');
  if (existing) {
    console.log(`[+] Already installed: ${existing}`);
  } else {
    run('npm install -g javascript-obfuscator');
  }
}

function stepClean() {
  header('Clean .next');
  if (fs.existsSync(NEXT_DIR)) {
    fs.rmSync(NEXT_DIR, { recursive: true, force: true });
    console.log('[+] Deleted .next');
  } else {
    console.log('[+] .next not present, nothing to clean.');
  }
}

function stepBuild() {
  header('Next.js Build');
  run('npx next build');
}

function stepObfuscate() {
  header('Obfuscate JS Chunks');
  if (!fs.existsSync(CHUNKS_DIR)) {
    console.error(`[ERROR] ${CHUNKS_DIR} not found. Build must run first.`);
    process.exit(1);
  }
  run(
    `javascript-obfuscator "${CHUNKS_DIR}" ` +
    `--output "${CHUNKS_DIR}" ` +
    `--compact true ` +
    `--identifier-names-generator hexadecimal ` +
    `--string-array true ` +
    `--string-array-encoding base64`
  );
  console.log('[+] Obfuscation complete.');
}

function stepZip() {
  header('Create .next.zip');
  if (!fs.existsSync(NEXT_DIR)) {
    console.error(`[ERROR] .next directory not found. Build must run first.`);
    process.exit(1);
  }
  // Remove old zip if present
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

  if (process.platform === 'win32') {
    run(`powershell -Command "Compress-Archive -Path '.next' -DestinationPath '.next.zip'"`);
  } else {
    run(`zip -r .next.zip .next`);
  }
  const sizeMB = (fs.statSync(ZIP_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`[+] Created .next.zip (${sizeMB} MB)`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const vars = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    vars[key] = val;
  }
  return vars;
}

function writeEnvFile(filePath, vars) {
  const out = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(filePath, out, 'utf8');
}

async function promptEnvVars(rl) {
  const examplePath = path.join(ROOT, '.env.local.example');

  // Bootstrap .env.local from example if missing
  if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, ENV_PATH);
      console.log('[+] Created .env.local from .env.local.example');
    } else {
      console.log('[!] No .env.local or .env.local.example found. Skipping env setup.');
      return;
    }
  }

  const vars        = parseEnvFile(ENV_PATH);
  const exampleVars = fs.existsSync(examplePath) ? parseEnvFile(examplePath) : {};
  const allKeys     = [...new Set([...Object.keys(exampleVars), ...Object.keys(vars)])];
  const isPlaceholder = v => !v || v.toLowerCase().includes('your-') || v === 'change-me' || v === 'CHANGEME';

  header('Environment Variables');
  let changed = false;

  for (const key of allKeys) {
    const current = vars[key];
    const isSensitive = /secret|key|password|token|proxy/i.test(key);

    if (isPlaceholder(current)) {
      console.log(`\n  [!] ${key} is not configured`);
      let val = '';
      while (!val) {
        val = (await ask(rl, `      Enter value for ${key}: `)).trim();
        if (!val) console.log('      [!] Value cannot be empty.');
      }
      vars[key] = val;
      changed = true;
    } else {
      const display = isSensitive && current.length > 4 ? current.slice(0, 4) + '***' : current;
      const input = (await ask(rl, `  ${key.padEnd(36)} = ${display}\n      New value (Enter to keep): `)).trim();
      if (input) { vars[key] = input; changed = true; console.log('      [+] Updated.'); }
    }
  }

  if (changed) {
    // Rewrite preserving comments from example template
    let out = '';
    if (fs.existsSync(examplePath)) {
      for (const line of fs.readFileSync(examplePath, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) { out += line + '\n'; continue; }
        const eq = t.indexOf('=');
        if (eq === -1) { out += line + '\n'; continue; }
        const k = t.slice(0, eq).trim();
        out += k in vars ? `${k}=${vars[k]}\n` : `${line}\n`;
      }
      for (const [k, v] of Object.entries(vars)) {
        if (!(k in exampleVars)) out += `${k}=${v}\n`;
      }
    } else {
      out = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    }
    fs.writeFileSync(ENV_PATH, out, 'utf8');
    console.log('\n[+] .env.local saved.');
  } else {
    console.log('');
  }
}

async function stepStartLocal(rl) {
  header('Start Local Server');

  if (!fs.existsSync(NEXT_DIR)) {
    console.error('[ERROR] .next folder not found. Run a build first (option 4 or node build.js local).');
    process.exit(1);
  }

  await promptEnvVars(rl);

  console.log('[*] Starting Next.js server on http://localhost:3000 ...');
  runServer();
}

async function stepUploadToRelease(rl, tagArg) {
  header('Upload to GitHub Release');

  const tag = tagArg || (await ask(rl, 'Release tag to upload to (e.g. v1.0.0): ')).trim();
  if (!tag) { console.error('[ERROR] Tag is required.'); process.exit(1); }

  run(`gh release upload "${tag}" "${ZIP_PATH}" --clobber`);
  console.log(`[+] Uploaded .next.zip to release ${tag}`);
}

async function stepCreateRelease(rl, tagArg) {
  header('Create GitHub Release');

  // Suggest next patch version from latest tag
  const latest = runCapture('gh release list --limit 1') || '';
  const latestTag = latest.trim().split(/\s+/)[0] || '';
  console.log(latestTag ? `[+] Latest release: ${latestTag}` : '[!] No existing releases found.');

  const tag   = tagArg || (await ask(rl, `New release tag${latestTag ? ` (latest is ${latestTag})` : ''}: `)).trim();
  if (!tag) { console.error('[ERROR] Tag is required.'); process.exit(1); }

  const titleIn = (await ask(rl, `Release title [${tag}]: `)).trim();
  const notes   = (await ask(rl, 'Release notes (leave blank for none): ')).trim();
  const title   = titleIn || tag;

  run(`gh release create "${tag}" "${ZIP_PATH}" --title "${title}" --notes "${notes}" --target main`);
  console.log(`[+] Release ${tag} created.`);
}

// ─── Main flows ──────────────────────────────────────────────────────────────

async function flowBuildOnly() {
  stepInstallObfuscator();
  stepClean();
  stepBuild();
  stepObfuscate();
  stepZip();
  console.log('\n[✓] Build complete. .next.zip is ready to upload.');
}
async function flowBuildNoObfuscate() {
  stepClean();
  stepBuild();
  console.log('\n[\u2713] Build complete (no obfuscation).');
}

async function flowLocal(rl) {
  stepInstallObfuscator();
  stepClean();
  stepBuild();
  stepObfuscate();
  await stepStartLocal(rl);
}
async function flowUpload(rl, tagArg) {
  if (!fs.existsSync(ZIP_PATH)) {
    console.log('[!] No .next.zip found — running full build first...');
    stepInstallObfuscator();
    stepClean();
    stepBuild();
    stepObfuscate();
    stepZip();
  }
  await stepUploadToRelease(rl, tagArg);
}

async function flowRelease(rl, tagArg) {
  if (!fs.existsSync(ZIP_PATH)) {
    console.log('[!] No .next.zip found — running full build first...');
    stepInstallObfuscator();
    stepClean();
    stepBuild();
    stepObfuscate();
    stepZip();
  }
  await stepCreateRelease(rl, tagArg);
}

async function interactiveMenu(rl) {
  console.log('\n┌──────────────────────────────┐');
  console.log('│   EducativeViewer Builder    │');
  console.log('└──────────────────────────────┘');
  console.log('');
  console.log('  1) Full build + obfuscate + zip + create new release');
  console.log('  2) Full build + obfuscate + zip + upload to existing release');
  console.log('  3) Build + obfuscate + zip only (no upload)');
  console.log('  4) Build + obfuscate + run local server');
  console.log('  5) Build only (no obfuscation, no zip)');
  console.log('  6) Run local server (use existing .next folder)');
  console.log('  7) Upload existing .next.zip to existing release');
  console.log('  8) Upload existing .next.zip as new release');
  console.log('  0) Exit');
  console.log('');

  const choice = (await ask(rl, 'Choose [0-8]: ')).trim();

  switch (choice) {
    case '1':
      stepInstallObfuscator();
      stepClean();
      stepBuild();
      stepObfuscate();
      stepZip();
      await stepCreateRelease(rl);
      break;
    case '2':
      stepInstallObfuscator();
      stepClean();
      stepBuild();
      stepObfuscate();
      stepZip();
      await stepUploadToRelease(rl);
      break;
    case '3':
      await flowBuildOnly();
      break;
    case '4':
      await flowLocal(rl);
      break;
    case '5':
      await flowBuildNoObfuscate();
      break;
    case '6':
      await stepStartLocal(rl);
      break;
    case '7':
      await stepUploadToRelease(rl);
      break;
    case '8':
      await stepCreateRelease(rl);
      break;
    case '0':
      console.log('Bye.');
      break;
    default:
      console.log('[!] Invalid choice.');
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const cmd = process.argv[2];
  const arg = process.argv[3];

  try {
    if (!cmd)              await interactiveMenu(rl);
    else if (cmd === 'build')      await flowBuildOnly();
    else if (cmd === 'build:only') await flowBuildNoObfuscate();
    else if (cmd === 'local')      await flowLocal(rl);
    else if (cmd === 'serve')      await stepStartLocal(rl);
    else if (cmd === 'upload')     await flowUpload(rl, arg);
    else if (cmd === 'release')    await flowRelease(rl, arg);
    else {
      console.error(`Unknown command: ${cmd}`);
      console.error('Usage: node build.js [build|build:only|local|serve|upload [tag]|release [tag]]');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
