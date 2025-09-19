/* scripts/smoke.cjs */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const PKG_JSON = path.join(ROOT, 'package.json');
const NM_DIR = path.join(ROOT, 'node_modules');

function assert(cond, msg) {
  if (!cond) {
    console.error('❌', msg);
    process.exit(1);
  }
  console.log('✅', msg);
}
function exists(p) { return fs.existsSync(p); }
function rel(p) { return path.relative(ROOT, p); }

function listFilesRec(dir, filter) {
  const out = [];
  const walk = (d) => {
    if (!exists(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, ent.name);
      if (ent.isDirectory()) walk(fp);
      else if (!filter || filter(fp)) out.push(fp);
    }
  };
  walk(dir);
  return out;
}

function firstSubpathNoExt(rootSubdir) {
  const js = listFilesRec(path.join(ROOT, rootSubdir), (p) => p.endsWith('.js'));
  const mjs = listFilesRec(path.join(ROOT, rootSubdir), (p) => p.endsWith('.mjs'));
  const any = js[0] || mjs[0];
  if (!any) return null;
  const relFromRoot = any.replace(ROOT + path.sep, '').replace(/\\/g, '/');
  return relFromRoot.replace(/\.m?js$/, '');
}

/** Create node_modules/<name> link to ROOT (junction on Windows), fallback to copy */
function linkSelfIntoNodeModules(pkgName) {
  fs.mkdirSync(NM_DIR, { recursive: true });
  const linkPath = path.join(NM_DIR, pkgName);
  try {
    if (exists(linkPath)) fs.rmSync(linkPath, { recursive: true, force: true });
    // Prefer symlink/junction (Windows requires 'junction' for directories)
    fs.symlinkSync(ROOT, linkPath, 'junction');
    return { linkPath, mode: 'symlink' };
  } catch {
    // Fallback: copy (slower)
    const copyDir = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, ent.name);
        const to = path.join(dest, ent.name);
        if (ent.isDirectory()) copyDir(from, to);
        else fs.copyFileSync(from, to);
      }
    };
    copyDir(ROOT, linkPath);
    return { linkPath, mode: 'copy' };
  }
}

(async function main() {
  console.log('--- Smoke Test: CJS / ESM / TS types / subpath exports (plugins/*, hooks/*, index/*) ---');

  assert(exists(PKG_JSON), 'package.json exists');
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
  assert(!!pkg.name, 'package.json has "name" (used as specifier)');

  // A) Basic file checks
  const mustHave = [
    path.join(ROOT, 'index.js'),
    path.join(ROOT, 'index.d.ts'),
    path.join(ROOT, 'esm', 'index.mjs'),
    path.join(ROOT, 'esm', 'index.d.ts')
  ];
  for (const f of mustHave) {
    assert(exists(f), `Exists: ${rel(f)}`);
  }

  // If subpaths exist, prepare for subpath tests (plugins/*, hooks/* and index/*)
  const pluginSub = firstSubpathNoExt('plugins');
  const indexSub = firstSubpathNoExt('index');
  const hooksSub = firstSubpathNoExt('hooks');

  // B) Create a temporary link to this project inside node_modules
  const { linkPath, mode } = linkSelfIntoNodeModules(pkg.name);
  console.log(`node_modules/${pkg.name} <- (${mode}) ${rel(ROOT) || '.'}`);

  console.log('(Note) Skipping CommonJS require checks – package exports ESM only.');

  // D) ESM test (import by package name → uses exports.import)
  try {
    const esmMod = await import(pkg.name);
    assert(esmMod != null, 'ESM import(pkg-name) OK (resolves exports.import → ./esm/index.mjs)');
  } catch (e) {
    console.error(e);
    assert(false, 'ESM import(pkg-name) failed');
  }
  if (pluginSub) {
    try {
      const esmSub = await import(`${pkg.name}/${pluginSub}`);
      assert(esmSub != null, `ESM import(${pkg.name}/${pluginSub}) OK (plugins/*)`);
    } catch (e) {
      console.error(e);
      assert(false, `ESM import(${pkg.name}/${pluginSub}) failed`);
    }
  } else {
    console.log('(Note) No plugins/* file found, skip ESM plugins subpath test');
  }
  if (indexSub) {
    try {
      const esmSub = await import(`${pkg.name}/${indexSub}`);
      assert(esmSub != null, `ESM import(${pkg.name}/${indexSub}) OK (index/*)`);
    } catch (e) {
      console.error(e);
      assert(false, `ESM import(${pkg.name}/${indexSub}) failed`);
    }
  } else {
    console.log('(Note) No index/* file found, skip ESM index subpath test');
  }
  if (hooksSub) {
    try {
      const esmSub = await import(`${pkg.name}/${hooksSub}`);
      assert(esmSub != null, `ESM import(${pkg.name}/${hooksSub}) OK (hooks/*)`);
    } catch (e) {
      console.error(e);
      assert(false, `ESM import(${pkg.name}/${hooksSub}) failed`);
    }
  } else {
    console.log('(Note) No hooks/* file found, skip ESM hooks subpath test');
  }

  // E) TS type check (NodeNext resolves exports.types)
  const SMOKE_TMP = path.join(ROOT, '.smoke-tmp');
  const SRC_DIR = path.join(SMOKE_TMP, 'src');
  fs.rmSync(SMOKE_TMP, { recursive: true, force: true });
  fs.mkdirSync(SRC_DIR, { recursive: true });

  // Create tsconfig
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      jsx: "react-jsx",
      noEmit: true,
      skipLibCheck: true
    }
  };
  fs.writeFileSync(path.join(SMOKE_TMP, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // Create index.ts: test root + subpath types
  let tsCode = `
    import RootDefault, * as RootNS from '${pkg.name}';
    void RootDefault; void RootNS;
  `;
  if (pluginSub) {
    tsCode += `\nimport * as PluginNS from '${pkg.name}/${pluginSub}'; void PluginNS;`;
  }
  if (indexSub) {
    tsCode += `\nimport * as IndexNS from '${pkg.name}/${indexSub}'; void IndexNS;`;
  }
  if (hooksSub) {
    tsCode += `\nimport * as HooksNS from '${pkg.name}/${hooksSub}'; void HooksNS;`;
  }
  fs.writeFileSync(path.join(SRC_DIR, 'index.ts'), tsCode);

  // Run tsc
  const tscBin = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const r = cp.spawnSync(tscBin, ['-p', SMOKE_TMP], { stdio: 'inherit' });
  assert(r.status === 0, 'TypeScript type check passed (tsc --noEmit)');

  // F) Cleanup
  try {
    // Remove node_modules/<pkgName> (symlink or copy)
    if (exists(linkPath)) fs.rmSync(linkPath, { recursive: true, force: true });
    // Remove .smoke-tmp
    fs.rmSync(SMOKE_TMP, { recursive: true, force: true });
  } catch (e) {
    console.warn('(Cleanup warning)', e.message);
  }

  console.log('--- Smoke Test Done ---');
})();
