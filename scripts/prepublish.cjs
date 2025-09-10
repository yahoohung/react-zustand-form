/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const DRY = !!process.env.npm_config_dry_run;
const SKIP = !!process.env.PUBLISH_SKIP_SMOKE;
function run(cmd) {
    console.log(`$ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
}
(async function main() {
    run('npm run clean');
    run('npm run build');
    run('npm test');
    run('npm run size');
    if (DRY || SKIP) {
        console.log(DRY ? '↷ Detected npm --dry-run, skipping smoke.' : '↷ PUBLISH_SKIP_SMOKE set, skipping smoke.');
        return;
    }

    run('node scripts/smoke.cjs');
})().catch((e) => {
    console.error('❌ prepublish failed:', e?.message || e);
    process.exit(1);
});