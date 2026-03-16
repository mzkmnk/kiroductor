/**
 * VRT（Visual Regression Test）用の Vite 設定。
 *
 * Playwright の webServer で renderer のみを起動するために使用する。
 * electron.vite.config.ts の renderer セクションと同等の設定。
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '../src/renderer'),
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
});
