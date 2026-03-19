import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

/** テスト用 1x1 赤ピクセル PNG（87 bytes） */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

/** テスト用の小さな PNG ファイルバッファ */
function tinyPngBuffer(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, 'base64');
}

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

  test('画像添付ボタンがデフォルト状態で表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();
    await expect(app.attachButton).toBeVisible();
  });

  test('画像を添付するとプレビューサムネイルが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    // hidden file input に画像をセット
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: tinyPngBuffer(),
    });

    // プレビューサムネイルが表示されるのを待つ
    await expect(page.getByAltText('test-image.png')).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-image.png');
  });

  test('複数画像を添付するとすべてのプレビューが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'image-1.png', mimeType: 'image/png', buffer: tinyPngBuffer() },
      { name: 'image-2.png', mimeType: 'image/png', buffer: tinyPngBuffer() },
    ]);

    await expect(page.getByAltText('image-1.png')).toBeVisible();
    await expect(page.getByAltText('image-2.png')).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-multiple-images.png');
  });

  test('画像添付とテキスト入力を組み合わせた状態', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: tinyPngBuffer(),
    });
    await app.promptInput.fill('この画像について説明してください');

    await expect(page.getByAltText('screenshot.png')).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-image-and-text.png');
  });

  test('20枚の画像を添付した状態', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      Array.from({ length: 20 }, (_, i) => ({
        name: `image-${i + 1}.png`,
        mimeType: 'image/png' as const,
        buffer: tinyPngBuffer(),
      })),
    );

    // 20枚すべてのプレビューが表示されるのを待つ
    await expect(page.getByAltText('image-20.png')).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-20-images.png');
  });

  test('処理中は画像添付ボタンが非表示になる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ promptDelayMs: 500 });
    await app.goto();
    await app.promptInput.fill('processing test');
    await app.sendButton.click();
    await expect(app.promptInput).toBeDisabled();
    await expect(app.attachButton).not.toBeVisible();
  });

  test('複数行入力時にフォーカス中は高さが拡張される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    await app.promptInput.click();
    await app.promptInput.fill('line1\nline2\nline3\nline4\nline5\nline6\nline7');
    // max-height transition (150ms) が完了するまで待つ
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('prompt-input-multiline-focused.png');
  });

  test('フォーカスが外れると元の高さに戻る', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    await app.promptInput.click();
    await app.promptInput.fill('line1\nline2\nline3\nline4\nline5');
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    // max-height transition (150ms) が完了するまで待つ
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('prompt-input-multiline-blurred.png');
  });

  test('再フォーカス時に複数行の高さが復元される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup();
    await app.goto();
    await app.waitForReady();

    await app.promptInput.click();
    await app.promptInput.fill('line1\nline2\nline3\nline4\nline5');
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    await app.promptInput.click();
    // max-height transition (150ms) が完了するまで待つ
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('prompt-input-multiline-refocused.png');
  });
});
