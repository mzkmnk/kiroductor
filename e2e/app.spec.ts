import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

test.describe('アプリ初期表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('PromptInput が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await expect(app.promptInput).toBeVisible();
    await expect(app.sendButton).toBeVisible();
  });
});
