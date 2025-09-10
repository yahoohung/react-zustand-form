const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TMP  = path.join(ROOT, '.publish-tmp');
const DIST = path.join(ROOT, 'dist');

try {
  const createdPath = path.join(TMP, 'createdAtRoot.json');
  if (fs.existsSync(createdPath)) {
    const { files = [], dirs = [] } = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
    for (const f of files) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
    for (const d of ['esm', 'plugins', ...dirs.filter(x => !['esm','plugins'].includes(x))]) {
      const p = path.join(ROOT, d);
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }
  }

  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  if (fs.existsSync(TMP))  fs.rmSync(TMP,  { recursive: true, force: true });

  console.log('[postpublish-clean] cleaned root/esm/plugins and removed dist');
} catch (e) {
  console.error('[postpublish-clean] Error:', e);
  process.exitCode = 1;
}
