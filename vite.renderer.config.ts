import { defineConfig } from 'vite';

// @vitejs/plugin-react と @tailwindcss/vite は ESM only のため動的 import を使用する
// https://www.electronforge.io/config/plugins/vite#esm-only-packages
export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default;
  const tailwindcss = (await import('@tailwindcss/vite')).default;

  return {
    root: './src/renderer',
    plugins: [tailwindcss(), react()],
  };
});
