import { test, expect } from '@playwright/test';

/**
 * Mock for window.kiroductor API injected by the Electron preload script.
 *
 * Since the preload script does not run in Vite standalone mode,
 * we inject it via {@link https://playwright.dev/docs/mock-browser-apis addInitScript}.
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
      prompt: () =>
        new Promise((resolve) => setTimeout(() => resolve({ stopReason: 'end_turn' }), 500)),
      cancel: () => Promise.resolve(),
      getMessages: () => Promise.resolve([]),
      onUpdate: () => () => {},
    },
  };
}

test.describe('PromptInput', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI);
    await page.goto('http://localhost:5173');
  });

  test('matches screenshot in default state', async ({ page }) => {
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-default.png');
  });

  test('matches screenshot with text filled', async ({ page }) => {
    await page.getByPlaceholder(/Type a message/).fill('Hello, agent!');
    await expect(page).toHaveScreenshot('prompt-input-filled.png');
  });

  test('matches screenshot while processing (disabled)', async ({ page }) => {
    // Fill text and click Send to trigger the processing state
    await page.getByPlaceholder(/Type a message/).fill('processing test');
    await page.getByRole('button', { name: 'Send' }).click();
    // prompt() resolves after 500ms, so the textarea is disabled during that time
    await expect(page.getByPlaceholder(/Type a message/)).toBeDisabled();
    await expect(page).toHaveScreenshot('prompt-input-disabled.png');
  });
});
