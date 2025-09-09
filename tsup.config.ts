// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/backend-sync': 'src/plugins/backend-sync.ts',
  },
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
    js: format === 'esm' ? '.mjs' : '.cjs',
  }),
});
