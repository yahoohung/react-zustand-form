import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = join(ROOT, 'src');

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // allow importing local source files from this monorepo (../../../src)
      allow: [ROOT]
    }
  }
});
