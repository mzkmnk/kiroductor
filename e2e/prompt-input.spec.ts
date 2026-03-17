import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

test.describe('PromptInput', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('matches screenshot in default state', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();
    await expect(page).toHaveScreenshot('prompt-input-default.png');
  });

  test('matches screenshot with text filled', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.promptInput.fill('Hello, agent!');
    await expect(page).toHaveScreenshot('prompt-input-filled.png');
  });

  test('matches screenshot while processing (disabled)', async ({ page }) => {
    const app = new AppPage(page);
    // prompt() が 500ms 後に resolve することで処理中状態を維持
    await app.setup({ promptDelayMs: 500 });
    await app.goto();
    await app.promptInput.fill('processing test');
    await app.sendButton.click();
    await expect(app.promptInput).toBeDisabled();
    await expect(page).toHaveScreenshot('prompt-input-disabled.png');
  });
});
