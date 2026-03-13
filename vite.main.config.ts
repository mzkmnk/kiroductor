import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// https://www.electronforge.io/config/plugins/vite#configuration
// Electron Forge の VitePlugin からはエントリーポイントが forge.config.ts 経由で渡される。
// CI での standalone ビルド検証のため lib モードで設定。
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
    outDir: '.vite/build',
  },
});
