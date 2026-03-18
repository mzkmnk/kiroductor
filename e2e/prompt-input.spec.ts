import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';
import { SESSION_WITH_BRANCHES } from './fixtures/mock-api';

/** テスト用のサンプル unified diff 文字列。 */
const SAMPLE_DIFF = [
  'diff --git a/src/main.ts b/src/main.ts',
  'index abc1234..def5678 100644',
  '--- a/src/main.ts',
  '+++ b/src/main.ts',
  '@@ -1,5 +1,7 @@',
  ' import { app } from "electron";',
  '+import { BrowserWindow } from "electron";',
  '+import { ipcMain } from "electron";',
  ' ',
  ' app.whenReady().then(() => {',
  '-  console.log("ready");',
  '+  const win = new BrowserWindow();',
  '+  win.loadURL("http://localhost:5173");',
  ' });',
].join('\n');

const MESSAGES = [
  { id: '1', type: 'user' as const, text: 'Hello' },
  { id: '2', type: 'agent' as const, text: 'Hi there!', status: 'completed' },
];

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

  test('コメントチップが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: MESSAGES,
      diff: SAMPLE_DIFF,
      diffStats: { filesChanged: 1, insertions: 4, deletions: 1 },
    });
    await app.goto();

    // diff ダイアログでコメントを追加
    await app.openDiffDialog();
    await expect(app.message('src/main.ts')).toBeVisible();
    await app.clickAddCommentWidget(0);
    await app.addComment('この行が気になる');

    // ダイアログを閉じる（Escape キー）
    await page.keyboard.press('Escape');

    // プロンプト入力欄にチップが表示される
    await expect(page.getByText('main.ts')).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-comment-chips.png');
  });

  test('複数コメントチップと全削除ボタンが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: MESSAGES,
      diff: SAMPLE_DIFF,
      diffStats: { filesChanged: 1, insertions: 4, deletions: 1 },
    });
    await app.goto();

    // diff ダイアログで2つコメントを追加
    await app.openDiffDialog();
    await expect(app.message('src/main.ts')).toBeVisible();

    await app.clickAddCommentWidget(0);
    await app.addComment('コメント1');

    await app.clickAddCommentWidget(1);
    await app.addComment('コメント2');

    // ダイアログを閉じる
    await page.keyboard.press('Escape');

    // 複数チップと全削除ボタンが表示される
    await expect(app.commentClearAllButton).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-with-multiple-chips.png');
  });
});
