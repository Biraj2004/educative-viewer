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
 *   node build.js download   — download .next.zip from an existing release
 *   node build.js upload     — zip + upload to existing GitHub release
 *   node build.js release    — zip + create new GitHub release
 *   node build.js public:sync — download and refresh JSON files in public/
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const ROOT        = __dirname;
const NEXT_DIR    = path.join(ROOT, '.next');
const NEXT_CACHE  = path.join(NEXT_DIR, 'cache');
const CHUNKS_DIR  = path.join(NEXT_DIR, 'static', 'chunks');
const ZIP_PATH    = path.join(ROOT, '.next.zip');
const ENV_PATH    = path.join(ROOT, '.env.local');
const REPOS_PATH  = path.join(ROOT, '.gh-repos.json');
const PUBLIC_DIR  = path.join(ROOT, 'public');
const PUBLIC_ZIP_REPO  = process.env.PUBLIC_ZIP_REPO  || 'Biraj2004/educative-viewer';
const PUBLIC_ZIP_TAG   = process.env.PUBLIC_ZIP_TAG   || 'public-files';
const PUBLIC_ZIP_ASSET = process.env.PUBLIC_ZIP_ASSET || 'public.zip';
const PUBLIC_ZIP_PATH  = path.join(ROOT, '.public.zip');

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

function downloadReleaseAsset(repo, tag, pattern, outputPath, directAssetName) {
  const ghResult = spawnSync(
    `gh release download "${tag}" --repo "${repo}" --pattern "${pattern}" --output "${outputPath}" --clobber`,
    { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT }
  );

  if (ghResult.status !== 0) {
    console.log('[!] gh download failed, falling back to direct URL download...');
    const url = `https://github.com/${repo}/releases/download/${tag}/${directAssetName}`;
    if (process.platform === 'win32') {
      run(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${outputPath}'"`);
    } else {
      run(`curl -fL "${url}" -o "${outputPath}"`);
    }
  }
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

  const preserveCache = process.env.PRESERVE_NEXT_CACHE === '1';
  const tmpCachePath = path.join(ROOT, '.next-cache-tmp');

  if (fs.existsSync(NEXT_DIR)) {
    if (preserveCache && fs.existsSync(NEXT_CACHE)) {
      if (fs.existsSync(tmpCachePath)) {
        fs.rmSync(tmpCachePath, { recursive: true, force: true });
      }
      fs.renameSync(NEXT_CACHE, tmpCachePath);
      fs.rmSync(NEXT_DIR, { recursive: true, force: true });
      fs.mkdirSync(NEXT_DIR, { recursive: true });
      fs.renameSync(tmpCachePath, NEXT_CACHE);
      console.log('[+] Deleted .next (preserved .next/cache)');
      return;
    }

    fs.rmSync(NEXT_DIR, { recursive: true, force: true });
    console.log('[+] Deleted .next');
  } else {
    console.log('[+] .next not present, nothing to clean.');
  }
}

async function stepSyncPublicJson() {
  header('Sync Public JSON Files');

  const JSZip = require('jszip');
  console.log(`[*] Downloading ${PUBLIC_ZIP_ASSET} from ${PUBLIC_ZIP_REPO}@${PUBLIC_ZIP_TAG} ...`);

  if (fs.existsSync(PUBLIC_ZIP_PATH)) fs.unlinkSync(PUBLIC_ZIP_PATH);
  downloadReleaseAsset(PUBLIC_ZIP_REPO, PUBLIC_ZIP_TAG, PUBLIC_ZIP_ASSET, PUBLIC_ZIP_PATH, PUBLIC_ZIP_ASSET);

  if (!fs.existsSync(PUBLIC_ZIP_PATH)) {
    throw new Error(`Could not download ${PUBLIC_ZIP_ASSET}`);
  }

  const zipBuffer = fs.readFileSync(PUBLIC_ZIP_PATH);
  const zip = await JSZip.loadAsync(zipBuffer);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const publicRoot = path.resolve(PUBLIC_DIR) + path.sep;
  let updated = 0;
  let skipped = 0;

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    let relPath = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (relPath.toLowerCase().startsWith('public/')) {
      relPath = relPath.slice('public/'.length);
    }

    if (!relPath || !relPath.toLowerCase().endsWith('.json')) {
      skipped += 1;
      continue;
    }

    const targetPath = path.resolve(PUBLIC_DIR, relPath);
    if (targetPath !== path.resolve(PUBLIC_DIR) && !targetPath.startsWith(publicRoot)) {
      skipped += 1;
      console.log(`[!] Skipping unsafe zip entry: ${entryName}`);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const data = await entry.async('nodebuffer');
    fs.writeFileSync(targetPath, data);
    updated += 1;
  }

  if (updated === 0) {
    throw new Error('public.zip was downloaded but no JSON files were extracted.');
  }

  console.log(`[+] Updated ${updated} JSON file(s) in public/.`);
  if (skipped > 0) {
    console.log(`[i] Skipped ${skipped} non-JSON or invalid zip entr${skipped === 1 ? 'y' : 'ies'}.`);
  }

  if (fs.existsSync(PUBLIC_ZIP_PATH)) fs.unlinkSync(PUBLIC_ZIP_PATH);
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

// ─── Repo store ──────────────────────────────────────────────────────────────

function loadRepos() {
  if (!fs.existsSync(REPOS_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(REPOS_PATH, 'utf8')); } catch { return []; }
}

function saveRepos(repos) {
  fs.writeFileSync(REPOS_PATH, JSON.stringify(repos, null, 2) + '\n', 'utf8');
}

/** Add/remove repos from the saved list. */
async function stepManageRepos(rl) {
  header('Manage GitHub Repos');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const repos = loadRepos();

    if (repos.length === 0) {
      console.log('  [!] No saved repos.\n');
    } else {
      console.log('  Saved repos:');
      repos.forEach((r, i) => console.log(`    ${i + 1}) ${r}`));
    }
    console.log('');
    console.log('  a) Add new repo');
    if (repos.length > 0) console.log('  r) Remove a repo');
    console.log('  q) Done');
    console.log('');

    const choice = (await ask(rl, `  Choose [a${repos.length ? '|r' : ''}|q]: `)).trim().toLowerCase();

    if (choice === 'a') {
      let newRepo = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        newRepo = (await ask(rl, '  Enter repo as owner/repo (e.g. anilabhadatta/educative-viewer): ')).trim();
        if (/^[\w.-]+\/[\w.-]+$/.test(newRepo)) break;
        console.log('  [!] Invalid format. Use owner/repo.');
      }
      if (!repos.includes(newRepo)) {
        repos.push(newRepo);
        saveRepos(repos);
        console.log(`  [+] Saved: ${newRepo}`);
      } else {
        console.log('  [!] Already in list.');
      }

    } else if (choice === 'r' && repos.length > 0) {
      const idx = (await ask(rl, `  Remove repo number [1-${repos.length}]: `)).trim();
      const n = parseInt(idx, 10);
      if (n >= 1 && n <= repos.length) {
        const removed = repos.splice(n - 1, 1)[0];
        saveRepos(repos);
        console.log(`  [-] Removed: ${removed}`);
      } else {
        console.log('  [!] Invalid number.');
      }

    } else if (choice === 'q') {
      break;
    } else {
      console.log('  [!] Invalid choice.');
    }
  }
}

/**
 * Ensure at least one repo is saved; if none exist, prompt to add one.
 * Returns the full list of repos to upload to.
 */
async function ensureRepos(rl) {
  let repos = loadRepos();
  if (repos.length === 0) {
    console.log('\n  [!] No saved repos. Add at least one to continue.');
    let newRepo = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      newRepo = (await ask(rl, '  Enter repo as owner/repo (e.g. anilabhadatta/educative-viewer): ')).trim();
      if (/^[\w.-]+\/[\w.-]+$/.test(newRepo)) break;
      console.log('  [!] Invalid format. Use owner/repo.');
    }
    repos.push(newRepo);
    saveRepos(repos);
    console.log(`  [+] Saved: ${newRepo}`);
  }
  return repos;
}

async function resolveRepo(rl) {
  const repos = await ensureRepos(rl);
  if (repos.length === 1) return repos[0];

  console.log('\nSaved repos:\n');
  repos.forEach((repo, i) => console.log(`  ${i + 1}) ${repo}`));
  const idxRaw = (await ask(rl, `\nChoose repo [1-${repos.length}] (default 1): `)).trim();

  if (!idxRaw) return repos[0];
  const idx = Number.parseInt(idxRaw, 10);
  if (Number.isNaN(idx) || idx < 1 || idx > repos.length) {
    console.log('[!] Invalid selection, using repo 1.');
    return repos[0];
  }
  return repos[idx - 1];
}

async function downloadZip(rl) {
  header('Download .next.zip from GitHub Releases');

  const repo = await resolveRepo(rl);

  // List ALL releases — works unauthenticated for public repos
  let releases = runCapture(`gh release list --repo "${repo}" --limit 100`);
  let latestTag = null;
  if (!releases) {
    // Fallback: GitHub REST API (no auth needed for public repos)
    console.log('[!] gh CLI unavailable or not authenticated, fetching via GitHub API...');
    const apiUrl = `https://api.github.com/repos/${repo}/releases?per_page=100`;
    const raw = process.platform === 'win32'
      ? runCapture(`powershell -Command "(Invoke-WebRequest -Uri '${apiUrl}' -UseBasicParsing).Content"`)
      : runCapture(`curl -sf "${apiUrl}"`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.length) latestTag = parsed[0].tag_name;
        releases = parsed.map(r => `${r.tag_name.padEnd(20)} ${r.name || ''}`).join('\n');
      } catch { /* ignore parse error */ }
    }
  } else {
    // gh release list output: first token of the first line is the latest tag
    const firstLine = releases.split('\n').find(l => l.trim());
    if (firstLine) latestTag = firstLine.trim().split(/\s+/)[0];
  }
  if (!releases) {
    console.error('[ERROR] Could not fetch releases. Check repo name and network connection.');
    process.exit(1);
  }

  console.log('\nAvailable releases:\n');
  console.log(releases);

  const prompt = latestTag
    ? `\nEnter release tag to download (default: ${latestTag}): `
    : '\nEnter release tag to download from (e.g. v1.0.0): ';
  const tagInput = (await ask(rl, prompt)).trim();
  const tagClean = tagInput || latestTag;
  if (!tagClean) {
    console.error('[ERROR] No tag provided and no latest release found.');
    process.exit(1);
  }
  console.log(`\n[*] Downloading .next.zip from release ${tagClean} ...`);

  // Try gh first (works without auth for public repos), fall back to direct URL
  const ghResult = spawnSync(
    `gh release download "${tagClean}" --repo "${repo}" --pattern "*.zip" --output "${ZIP_PATH}" --clobber`,
    { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT }
  );
  if (ghResult.status !== 0) {
    console.log('[!] gh download failed, falling back to direct URL download...');
    const url = `https://github.com/${repo}/releases/download/${tagClean}/.next.zip`;
    if (process.platform === 'win32') {
      run(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${ZIP_PATH}'"`);
    } else {
      run(`curl -fL "${url}" -o "${ZIP_PATH}"`);
    }
  }

  console.log(`[+] Saved to ${ZIP_PATH}`);
  return tagClean;
}

async function stepUploadToRelease(rl, tagArg) {
  header('Upload to GitHub Release');

  const repos = await ensureRepos(rl);
  console.log(`\n  [*] Will upload to ${repos.length} repo(s): ${repos.join(', ')}`);

  const tag = tagArg || (await ask(rl, 'Release tag to upload to (e.g. v1.0.0): ')).trim();
  if (!tag) { console.error('[ERROR] Tag is required.'); process.exit(1); }

  for (const repo of repos) {
    console.log(`\n  [→] Uploading to ${repo} ...`);
    run(`gh release upload "${tag}" "${ZIP_PATH}" --clobber --repo "${repo}"`);
    console.log(`  [+] Uploaded to ${repo} @ ${tag}`);
  }
  console.log(`\n[✓] Upload complete to all ${repos.length} repo(s).`);
}

function incrementTag(tag) {
  if (!tag) return 'v1.0.0';
  const match = tag.match(/^([^0-9]*)(\d+(?:\.\d+)*)$/);
  if (!match) {
    console.warn(`[!] Non-standard tag format: ${tag}. Defaulting to v1.0.0`);
    return 'v1.0.0';
  }

  const prefix = match[1];
  const parts = match[2].split('.').map((part) => Number(part));
  parts[parts.length - 1] += 1;
  return prefix + parts.join('.');
}

async function stepCreateRelease(rl, tagArg) {
  header('Create GitHub Release');

  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;
  const repos = await ensureRepos(rl);
  console.log(`\n  [*] Will create release in ${repos.length} repo(s): ${repos.join(', ')}`);

  let tag = tagArg;
  let title;
  let notes;

  if (tag) {
    console.log(`[+] Using provided tag: ${tag}`);
    title = tag;
    notes = `Automated release for ${tag}`;
  } else if (isCI) {
    console.log('[+] CI environment detected, automating release tag...');
    const latest = runCapture(`gh release list --limit 1 --repo "${repos[0]}"`) || '';
    const latestTag = latest.trim().split(/\s+/)[0] || '';
    if (latestTag) console.log(`  [+] Latest release in ${repos[0]}: ${latestTag}`);

    tag = incrementTag(latestTag);
    title = tag;
    notes = `Automated release for ${tag}`;
    console.log(`  [+] New release tag: ${tag}`);
  } else {
    // Interactive part
    const latest = runCapture(`gh release list --limit 1 --repo "${repos[0]}"`) || '';
    const latestTag = latest.trim().split(/\s+/)[0] || '';
    if (latestTag) console.log(`  [+] Latest release in ${repos[0]}: ${latestTag}`);

    tag = (await ask(rl, `New release tag${latestTag ? ` (latest is ${latestTag})` : ''}: `)).trim();
    if (!tag) { console.error('[ERROR] Tag is required.'); process.exit(1); }

    const titleIn = (await ask(rl, `Release title [${tag}]: `)).trim();
    notes = (await ask(rl, 'Release notes (leave blank for none): ')).trim();
    title = titleIn || tag;
  }

  for (const repo of repos) {
    console.log(`\n  [→] Creating release in ${repo} ...`);
    run(`gh release create "${tag}" "${ZIP_PATH}" --title "${title}" --notes "${notes}" --target main --repo "${repo}"`);
    console.log(`  [+] Release ${tag} created in ${repo}`);
  }
  console.log(`\n[✓] Release created in all ${repos.length} repo(s).`);
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
  stepZip();
  console.log('\n[\u2713] Build complete (no obfuscation). .next.zip is ready to upload.');
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
  console.log('  5) Build only (no obfuscation) + zip');
  console.log('  6) Run local server (use existing .next folder)');
  console.log('  7) Upload existing .next.zip to existing release');
  console.log('  8) Upload existing .next.zip as new release');
  console.log('  9) Manage saved GitHub repos');
  console.log('  10) Download and refresh public JSON files');
  console.log('  11) Download .next.zip from existing release');
  console.log('  0) Exit');
  console.log('');

  const choice = (await ask(rl, 'Choose [0-11]: ')).trim();

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
    case '9':
      await stepManageRepos(rl);
      break;
    case '10':
      await stepSyncPublicJson();
      break;
    case '11':
      await downloadZip(rl);
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
    else if (cmd === 'download')   await downloadZip(rl);
    else if (cmd === 'public:sync' || cmd === 'public') await stepSyncPublicJson();
    else if (cmd === 'serve')      await stepStartLocal(rl);
    else if (cmd === 'upload')     await flowUpload(rl, arg);
    else if (cmd === 'release')    await flowRelease(rl, arg);
    else {
      console.error(`Unknown command: ${cmd}`);
      console.error('Usage: node build.js [build|build:only|local|serve|download|public:sync|upload [tag]|release [tag]]');
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
