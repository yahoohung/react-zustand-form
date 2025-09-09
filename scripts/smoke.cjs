/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function sh(cmd, opts = {}) {
    try {
        return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
    } catch (e) {
        const out = (e.stdout || '') + (e.stderr || '');
        throw new Error(out || e.message);
    }
}
function writeStub(pkg, content) {
    const dir = path.join('node_modules', pkg);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: pkg, version: '0.0.0', type: 'commonjs', main: 'index.js' }, null, 2)
    );
    fs.writeFileSync(path.join(dir, 'index.js'), content);
}
function installPeersOrStub(tarballAbs) {
    const REG = process.env.NPM_REGISTRY || 'https://registry.npmjs.org/';
    try {
        console.log('→ Installing tarball + peers from registry…');
        sh(`npm i "${tarballAbs}" react@^18 react-dom@^18 zustand@^5 --no-audit --no-fund --loglevel=warn --registry=${REG}`);
        return 'registry';
    } catch (e) {
        console.warn('! Online install failed, falling back to local stubs.\n', e.message?.slice(0, 4000));
        console.log('→ Installing tarball only & creating minimal peer stubs…');
        sh(`npm i "${tarballAbs}" --no-audit --no-fund --loglevel=warn`);
        // minimal stubs just to satisfy require/import at module init
        writeStub('react', `module.exports={useState:()=>[null,()=>{}],useEffect:()=>{},useRef:()=>({current:null}),createElement:()=>null};`);
        writeStub('react-dom', `module.exports={};`);
        writeStub('zustand', `module.exports={create:()=>()=>({getState(){},setState(){},subscribe(){return ()=>{}}})};`);
        return 'stub';
    }
}
function main() {
    // 1) Pack and resolve absolute tarball path
    const packed = JSON.parse(sh('npm pack --json'))[0];
    if (!packed || !packed.filename) throw new Error('npm pack did not return a filename');
    const tarball = path.resolve(process.cwd(), packed.filename);
    // 2) Temp project
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rzf-smoke-'));
    console.log('Working dir:', tmp);
    process.chdir(tmp);
    sh('npm init -y');
    const mode = installPeersOrStub(tarball);
    // 3) CJS
    fs.writeFileSync('cjs.js', `
const root = require('react-zustand-form');
const sub = require('react-zustand-form/plugins/backend-sync');
const compat = require('react-zustand-form/plugins/backend-sync');
if (!root.useForm) throw new Error('CJS root useForm missing');
if (!sub.createBackendSync) throw new Error('CJS subpath createBackendSync missing');
if (!compat.createBackendSync) throw new Error('CJS compat subpath missing');
console.log('CJS OK (${mode})');
`);
    sh('node cjs.js');
    // 4) ESM
    fs.writeFileSync('esm.mjs', `
import { useForm } from 'react-zustand-form';
import { createBackendSync as a } from 'react-zustand-form/plugins/backend-sync';
import { createBackendSync as b } from 'react-zustand-form/plugins/backend-sync';
if (!useForm) throw new Error('ESM root useForm missing');
if (!a || !b) throw new Error('ESM subpath missing');
console.log('ESM OK (${mode})');
`);
    sh('node esm.mjs');
    console.log('✅ Smoke passed (CJS/ESM root & subpaths) via', mode);
}
try {
    main();
} catch (e) {
    console.error('❌ Smoke failed:\n', e.message || e);
    process.exit(1);
}