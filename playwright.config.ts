import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH ??
            '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        },
      },
    },
  ],

  webServer: {
    command: 'pnpm exec vite --config vite.renderer.config.ts',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
