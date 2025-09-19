const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const TMP  = path.join(ROOT, '.publish-tmp');

if (!fs.existsSync(DIST)) throw new Error('dist not found; run build first');
fs.mkdirSync(TMP, { recursive: true });

// Utilities
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyFile(from, to) { ensureDir(path.dirname(to)); fs.copyFileSync(from, to); }
function copyDirFilter(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isDirectory()) copyDirFilter(from, to, filterFn);
    else if (!filterFn || filterFn(from)) copyFile(from, to);
  }
}

// 1) Root-level index.* and dev.*
const createdFiles = [];
['index.js', 'index.mjs', 'index.d.ts', 'index.js.map', 'index.mjs.map',
 'dev.js', 'dev.mjs', 'dev.d.ts', 'dev.js.map', 'dev.mjs.map'].forEach(f => {
  const from = path.join(DIST, f);
  if (fs.existsSync(from)) { copyFile(from, path.join(ROOT, f)); createdFiles.push(f); }
});

// 2) esm/**  ( *.mjs + *.mjs.map + *.d.ts + *.d.ts.map )
const ESM_DIR = path.join(ROOT, 'esm');
copyDirFilter(
  DIST,
  ESM_DIR,
  p => p.endsWith('.mjs') || p.endsWith('.mjs.map') || p.endsWith('.d.ts') || p.endsWith('.d.ts.map')
);
const createdDirs = fs.existsSync(ESM_DIR) ? ['esm'] : [];

// 3) plugins/** (copy entire dist/plugins)
const DIST_PLUGINS = path.join(DIST, 'plugins');
const ROOT_PLUGINS = path.join(ROOT, 'plugins');
if (fs.existsSync(DIST_PLUGINS)) {
  copyDirFilter(DIST_PLUGINS, ROOT_PLUGINS);
  createdDirs.push('plugins');
}

const DIST_HOOKS = path.join(DIST, 'hooks');
const ROOT_HOOKS = path.join(ROOT, 'hooks');
if (fs.existsSync(DIST_HOOKS)) {
  copyDirFilter(DIST_HOOKS, ROOT_HOOKS);
  createdDirs.push('hooks');
}

// 4) index/** (copy entire dist/index — needed for worker & internal subpath imports)
const DIST_INDEX = path.join(DIST, 'index');
const ROOT_INDEX = path.join(ROOT, 'index');
if (fs.existsSync(DIST_INDEX)) {
  copyDirFilter(DIST_INDEX, ROOT_INDEX);
  createdDirs.push('index');
}

// 5) utils/** (copy entire dist/utils if present)
const DIST_UTILS = path.join(DIST, 'utils');
const ROOT_UTILS = path.join(ROOT, 'utils');
if (fs.existsSync(DIST_UTILS)) {
  copyDirFilter(DIST_UTILS, ROOT_UTILS);
  createdDirs.push('utils');
}

// Record files and dirs created at project root
fs.writeFileSync(
  path.join(TMP, 'createdAtRoot.json'),
  JSON.stringify({ files: createdFiles, dirs: createdDirs }, null, 2)
);

console.log('[prepublish-prepare] staged root files, esm/, plugins/, hooks/, and index/ for publish (package.json untouched)');
