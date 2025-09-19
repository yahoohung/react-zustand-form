const { spawnSync } = require('child_process');

const res = spawnSync('npm', ['pack', '--json', '--dry-run'], { encoding: 'utf8' });
if (res.status !== 0) {
  console.error(res.stdout || res.stderr);
  process.exit(res.status);
}
const out = JSON.parse(res.stdout);
const files = (out[0] && out[0].files) ? out[0].files.map(f => f.path) : [];
const normalized = files.map(p => p.replace(/^package\//, ''));
const banned = [/^src\//, /^tests?\//, /^\.github\//, /^scripts\//, /^examples?\//, /^dist\//, /^\.smoke-tmp\//];

const offenders = normalized.filter(p => banned.some(rx => rx.test(p)));
if (offenders.length) {
  console.error('❌ Disallowed files included:\n' + offenders.map(s=>' - '+s).join('\n'));
  process.exit(1);
}

// Ensure expected built artifacts are present
const required = [
  // root entrypoints
  'index.js',
  'index.mjs',
  'index.d.ts',
  // esm mirrors
  'esm/index.mjs',
  'esm/index.d.ts',
  // plugins entrypoints
  'plugins/index.js',
  'plugins/index.d.ts',
  'esm/plugins/index.mjs',
  'esm/plugins/index.d.ts',
  // dev entry (optional but recommended)
  'dev.js',
  'dev.mjs',
  'dev.d.ts',
];
const missing = required.filter(p => !normalized.includes(p));
if (missing.length) {
  console.error('❌ Missing expected build outputs in package:\n' + missing.map(s=>' - '+s).join('\n'));
  process.exit(1);
}


console.log('✅ Packlist check passed; required outputs present.');
