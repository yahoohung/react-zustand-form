// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/index.tsx',
    'src/plugins/**/*.ts',
    'src/plugins/**/*.tsx',
    'src/hooks/**/*.ts',
    'src/hooks/**/*.tsx'    
  ],
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
