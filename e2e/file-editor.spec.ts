import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';
import { SESSION_WITH_BRANCHES } from './fixtures/mock-api';

test.describe('FileEditor', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('ファイルツリーのファイルをクリックするとタブが開きファイル内容が表示される', async ({
    page,
  }) => {
    const app = new AppPage(page);
    await app.setup({ sessions: [SESSION_WITH_BRANCHES] });
    await app.goto();
    await app.waitForReady();

    // ファイルツリーで App.tsx をクリック
    await page.getByText('src').click();
    await page.getByText('renderer').click();
    await page.getByText('App.tsx').click();

    // タブが表示されるのを待つ
    await expect(page.getByRole('button', { name: /App\.tsx/ })).toBeVisible();

    // CodeMirror エディタのコンテンツが表示されるのを待つ
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.cm-content')).toBeVisible();

    await expect(page).toHaveScreenshot('file-editor-tsx.png');
  });

  test('JSON ファイルがシンタックスハイライト付きで表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ sessions: [SESSION_WITH_BRANCHES] });
    await app.goto();
    await app.waitForReady();

    // package.json をクリック
    await page.getByText('package.json').click();

    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page).toHaveScreenshot('file-editor-json.png');
  });

  test('複数のファイルを開くとタブが複数表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ sessions: [SESSION_WITH_BRANCHES] });
    await app.goto();
    await app.waitForReady();

    // package.json を開く
    await page.getByText('package.json').click();
    await expect(page.getByRole('button', { name: /package\.json/ })).toBeVisible();

    // README.md を開く
    await page.getByText('README.md').click();
    await expect(page.getByRole('button', { name: /README\.md/ })).toBeVisible();

    // 両方のタブが表示されている
    await expect(page.getByRole('button', { name: /package\.json/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /README\.md/ })).toBeVisible();

    await expect(page).toHaveScreenshot('file-editor-multiple-tabs.png');
  });

  test('タブの X ボタンでファイルタブを閉じるとチャットに戻る', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ sessions: [SESSION_WITH_BRANCHES] });
    await app.goto();
    await app.waitForReady();

    // package.json を開く
    await page.getByText('package.json').click();
    await expect(page.locator('.cm-editor')).toBeVisible();

    // タブの X ボタンをクリック
    await page.getByLabel('Close package.json').click();

    // エディタが消えてチャットに戻る
    await expect(page.locator('.cm-editor')).not.toBeVisible();
    await expect(app.promptInput).toBeVisible();

    await expect(page).toHaveScreenshot('file-editor-tab-closed.png');
  });

  test('存在しないファイルを開くとエラーメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      files: {
        '': [{ name: 'nonexistent.ts', path: 'nonexistent.ts', isDirectory: false }],
      },
    });
    await app.goto();
    await app.waitForReady();

    // 存在しないファイルをクリック
    await page.getByText('nonexistent.ts').click();

    // エラーメッセージが表示される
    await expect(page.getByText('File not found')).toBeVisible();

    await expect(page).toHaveScreenshot('file-editor-error.png');
  });
});
