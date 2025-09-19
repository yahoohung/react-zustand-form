// tsup.config.ts
import { defineConfig } from 'tsup';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = __dirname;

const EXCLUDE_PATTERNS = [/\.d\.ts$/i, /\.test\.tsx?$/i, /\.spec\.tsx?$/i, /\.stories\.tsx?$/i];

function collectEntries(subdir: string): string[] {
  const start = join(ROOT, subdir);
  if (!existsSync(start)) return [];

  const results: string[] = [];
  const stack = [start];

  while (stack.length) {
    const current = stack.pop()!;
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!dirent.isFile()) continue;

      const ext = extname(dirent.name);
      if (ext !== '.ts' && ext !== '.tsx' && ext !== '.mts' && ext !== '.cts') continue;
      if (EXCLUDE_PATTERNS.some((rx) => rx.test(dirent.name))) continue;

      const relPath = relative(ROOT, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }

  return results;
}

const entryFiles = new Set<string>([
  'src/index.ts',
  'src/dev.ts',
  'src/plugins/index.ts',
  'src/hooks/index.ts',
]);

for (const path of collectEntries('src/hooks')) entryFiles.add(path);
for (const path of collectEntries('src/plugins')) entryFiles.add(path);
for (const path of collectEntries('src/index')) entryFiles.add(path);
for (const path of collectEntries('src/utils')) entryFiles.add(path);

const entries = Array.from(entryFiles);

export default defineConfig({
  entry: entries,
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,         // lib: keep single-file outputs per entry
  target: 'es2019',
  treeshake: true,
  minify: true,
  external: ['react', 'react-dom', 'zustand'], // don’t bundle peers
  outDir: 'dist',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.js',
  }),
});
