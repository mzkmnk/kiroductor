import { test, expect, type Page } from '@playwright/test';

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

const DIFF_DIALOG_MESSAGES = [
  { id: '1', type: 'user' as const, text: 'Hello' },
  { id: '2', type: 'agent' as const, text: 'Hi there!', status: 'completed' },
];

/** diff ダイアログを開くための共通セットアップ。 */
async function openDiffDialog(app: AppPage) {
  await app.setup({
    sessions: [SESSION_WITH_BRANCHES],
    messages: DIFF_DIALOG_MESSAGES,
    diff: SAMPLE_DIFF,
    diffStats: { filesChanged: 2, insertions: 5, deletions: 1 },
  });
  await app.goto();
  await app.showDiffButton.click();
  await expect(app.message('src/main.ts')).toBeVisible();
}

/**
 * ガター上の「+」ボタンを操作してコメント入力フォームを開く。
 *
 * renderGutter は onMouseDown で dragState をセットし、
 * window の mouseup でコメント入力フォームを開く。
 * Playwright の .click() だと mouseup 時に要素が消えている場合があるため、
 * mousedown / mouseup を手動でディスパッチする。
 */
async function clickGutterToAddComment(page: Page, gutterSelector = '.diff-gutter-insert') {
  // ガターセルを直接クリックしてコメント入力フォームを開く
  // react-diff-view の gutterEvents.onClick が発火する
  const gutterCell = page.locator(gutterSelector).first();
  await gutterCell.click();
  await expect(page.getByPlaceholder('Write a comment...')).toBeVisible();
}

/**
 * diff 上にコメントを1件追加するヘルパー。
 */
async function addComment(page: Page, text: string, gutterSelector = '.diff-gutter-insert') {
  await clickGutterToAddComment(page, gutterSelector);
  await page.getByPlaceholder('Write a comment...').fill(text);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  // コメントバッジが表示されるのを待つ
  await expect(page.getByText(text)).toBeVisible();
}

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
    await openDiffDialog(app);
    await expect(app.message('src/utils.ts')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-with-changes.png');
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

test.describe('DiffDialog - コメント機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('ガターホバーで「+」ボタンが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    const gutterCell = page.locator('.diff-gutter').first();
    await gutterCell.hover();

    const addButton = page.getByRole('button', { name: 'Add comment' }).first();
    await expect(addButton).toBeVisible();
    await expect(page).toHaveScreenshot('diff-comment-hover-add-button.png');
  });

  test('ガタークリックでコメント入力フォームが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    await clickGutterToAddComment(page);

    await expect(page).toHaveScreenshot('diff-comment-input-form.png');
  });

  test('コメント入力・送信でバッジが表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    await addComment(page, 'This import looks unnecessary');

    await expect(page.getByText('This import looks unnecessary')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-comment-badge-displayed.png');
  });

  test('コメント追加後にチップがプロンプト入力欄上部に表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    await addComment(page, 'Review comment');

    // チップが表示される（ファイル名 + 行番号の形式）
    const chip = page.getByText('main.ts');
    await expect(chip.last()).toBeVisible();
    await expect(page.getByText('Clear all')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-comment-chips-in-footer.png');
  });

  test('コメントバッジの削除ボタンでコメントが削除されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    await addComment(page, 'Delete me');
    await expect(page.getByText('Delete me')).toBeVisible();

    // バッジの削除ボタンをクリック（ホバーで表示される）
    const badge = page.getByText('Delete me').locator('..');
    await badge.hover();
    await page.getByRole('button', { name: 'Delete comment' }).click();

    await expect(page.getByText('Delete me')).not.toBeVisible();
    await expect(page.getByText('Clear all')).not.toBeVisible();
  });

  test('Clear all ボタンで全コメントが削除されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    // 異なる種類のガター行にコメントを追加
    await addComment(page, 'Comment 1', '.diff-gutter-insert');
    await addComment(page, 'Comment 2', '.diff-gutter-delete');

    await expect(page.getByText('Comment 1')).toBeVisible();
    await expect(page.getByText('Comment 2')).toBeVisible();

    await page.getByText('Clear all').click();

    await expect(page.getByText('Comment 1')).not.toBeVisible();
    await expect(page.getByText('Comment 2')).not.toBeVisible();
    await expect(page.getByText('Clear all')).not.toBeVisible();
  });

  test('コメント入力フォームで Cancel をクリックするとフォームが閉じること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    await clickGutterToAddComment(page);
    await expect(page.getByPlaceholder('Write a comment...')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByPlaceholder('Write a comment...')).not.toBeVisible();
  });

  test('DiffDialog 下部にプロンプト入力欄が表示されること', async ({ page }) => {
    const app = new AppPage(page);
    await openDiffDialog(app);

    const dialogPromptInput = page.getByPlaceholder(/Ask to make changes/).last();
    await expect(dialogPromptInput).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-with-prompt-input.png');
  });
});
