// scripts/postbuild.cjs
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'dist', 'esm');
fs.mkdirSync(dir, { recursive: true });
const p = path.join(dir, 'package.json');
fs.writeFileSync(p, JSON.stringify({ type: 'module' }, null, 2));
console.log('Wrote', p);
