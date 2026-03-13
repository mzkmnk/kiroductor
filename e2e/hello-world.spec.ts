import { test, expect } from '@playwright/test';

/**
 * Electron の preload スクリプトが注入する window.kiroductor API のモック。
 *
 * Vite 単独起動時は preload が動作しないため、
 * {@link https://playwright.dev/docs/mock-browser-apis addInitScript} で注入する。
 */
function mockKiroductorAPI() {
  (window as Record<string, unknown>).kiroductor = {
    acp: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getStatus: () => Promise.resolve('disconnected'),
      onStatusChange: () => () => {},
    },
    session: {
      create: () => Promise.resolve(),
      prompt: () => Promise.resolve({ stopReason: 'end_turn' }),
      cancel: () => Promise.resolve(),
      getMessages: () => Promise.resolve([]),
      onUpdate: () => () => {},
    },
  };
}

test.describe('Hello World 画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI);
  });

  test('ベースラインスクリーンショットと一致する', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.locator('h1')).toHaveText('Kiroductor');
    await expect(page).toHaveScreenshot('hello-world.png');
  });
});
