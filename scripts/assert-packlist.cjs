const { spawnSync } = require('child_process');

const res = spawnSync('npm', ['pack', '--json', '--dry-run'], { encoding: 'utf8' });
if (res.status !== 0) {
  console.error(res.stdout || res.stderr);
  process.exit(res.status);
}
const out = JSON.parse(res.stdout);
const files = (out[0] && out[0].files) ? out[0].files.map(f => f.path) : [];
const banned = [/^src\//, /^tests?\//, /^\.github\//, /^scripts\//, /^examples?\//, /^dist\//, /^\.smoke-tmp\//];

const offenders = files.filter(p => banned.some(rx => rx.test(p)));
if (offenders.length) {
  console.error('❌ Disallowed files included:\n' + offenders.map(s=>' - '+s).join('\n'));
  process.exit(1);
}
console.log('✅ Packlist check passed, no src/tests/.github/scripts/dist etc.');
