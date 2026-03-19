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
  'diff --git a/src/utils.ts b/src/utils.ts',
  'new file mode 100644',
  'index 0000000..1234567',
  '--- /dev/null',
  '+++ b/src/utils.ts',
  '@@ -0,0 +1,3 @@',
  '+export function add(a: number, b: number): number {',
  '+  return a + b;',
  '+}',
].join('\n');

/**
 * 画像ファイルを含む diff（新規追加）。
 * git diff でバイナリファイルが追加された場合のフォーマット。
 */
const IMAGE_ADD_DIFF = [
  'diff --git a/assets/logo.png b/assets/logo.png',
  'new file mode 100644',
  'index 0000000..abc1234',
  'Binary files /dev/null and b/assets/logo.png differ',
].join('\n');

/**
 * 画像ファイルを含む diff（変更）。
 * git diff でバイナリファイルが変更された場合のフォーマット。
 */
const IMAGE_MODIFY_DIFF = [
  'diff --git a/assets/logo.png b/assets/logo.png',
  'index abc1234..def5678 100644',
  'Binary files a/assets/logo.png and b/assets/logo.png differ',
].join('\n');

/**
 * テスト用の最小 PNG 画像（1×1 赤ピクセル）の Base64 文字列。
 */
const RED_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

/**
 * テスト用の最小 PNG 画像（1×1 青ピクセル）の Base64 文字列。
 */
const BLUE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADggGAWjR9awAAAABJRU5ErkJggg==';

const DIFF_DIALOG_MESSAGES = [
  { id: '1', type: 'user' as const, text: 'Hello' },
  { id: '2', type: 'agent' as const, text: 'Hi there!', status: 'completed' },
];

test.describe('DiffDialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('diff ボタンが ChatView ヘッダーに表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: DIFF_DIALOG_MESSAGES,
    });
    await app.goto();
    await expect(app.showDiffButton).toBeVisible();
    await expect(page).toHaveScreenshot('diff-button-in-header.png');
  });

  test('diff ボタンクリックで split diff ビューが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: DIFF_DIALOG_MESSAGES,
      diff: SAMPLE_DIFF,
      diffStats: { filesChanged: 2, insertions: 5, deletions: 1 },
    });
    await app.goto();
    await app.showDiffButton.click();
    await expect(app.message('src/main.ts')).toBeVisible();
    await expect(app.message('src/utils.ts')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-with-changes.png');
  });

  test('追加された画像ファイルのプレビューが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: DIFF_DIALOG_MESSAGES,
      diff: IMAGE_ADD_DIFF,
      diffStats: { filesChanged: 1, insertions: 0, deletions: 0 },
      fileBase64Map: { 'assets/logo.png': RED_PNG_BASE64 },
    });
    await app.goto();
    await app.showDiffButton.click();
    await expect(app.message('assets/logo.png')).toBeVisible();
    await expect(page.getByRole('img', { name: 'assets/logo.png' })).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-image-add.png');
  });

  test('変更された画像ファイルの Before/After プレビューが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: DIFF_DIALOG_MESSAGES,
      diff: IMAGE_MODIFY_DIFF,
      diffStats: { filesChanged: 1, insertions: 0, deletions: 0 },
      fileBase64Map: { 'assets/logo.png': BLUE_PNG_BASE64 },
    });
    await app.goto();
    await app.showDiffButton.click();
    await expect(app.message('assets/logo.png')).toBeVisible();
    await expect(page.getByText('Before')).toBeVisible();
    await expect(page.getByText('After')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-image-modify.png');
  });

  test('diff データが空の場合ボタンが無効化されること', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: DIFF_DIALOG_MESSAGES,
    });
    await app.goto();
    await expect(app.showDiffButton).toBeDisabled();
  });
});
