import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure only one React copy is used when importing local sources
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: {
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
    }
  },
  server: {
    fs: {
      // allow importing local source files from this monorepo (../../../src)
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../..')]
    }
  }
});
