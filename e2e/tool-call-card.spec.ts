import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

test.describe('ToolCallCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('実行中（in_progress）のツール呼び出しが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'tool_call',
          name: 'readFile',
          input: { path: '/src/main.ts' },
          status: 'in_progress',
        },
      ],
    });
    await app.goto();
    await expect(app.message('readFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-in-progress.png');
  });

  test('保留中（pending）のツール呼び出しが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'tool_call',
          name: 'writeFile',
          input: { path: '/src/app.ts', content: 'console.log("hello")' },
          status: 'pending',
        },
      ],
    });
    await app.goto();
    await expect(app.message('writeFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-pending.png');
  });

  test('完了（completed）のツール呼び出しが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'tool_call',
          name: 'readFile',
          input: { path: '/src/main.ts' },
          status: 'completed',
          result: 'File content: export default {}',
        },
      ],
    });
    await app.goto();
    await expect(app.message('readFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-completed.png');
  });

  test('エラー（failed）のツール呼び出しが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'tool_call',
          name: 'executeCommand',
          input: { command: 'rm -rf /' },
          status: 'failed',
          result: 'Permission denied',
        },
      ],
    });
    await app.goto();
    await expect(app.message('executeCommand')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-failed.png');
  });

  test('折りたたみを展開すると入力と出力が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'tool_call',
          name: 'readFile',
          input: { path: '/src/main.ts' },
          status: 'completed',
          result: 'File content: export default {}',
        },
      ],
    });
    await app.goto();
    await app.message('readFile').click();
    await expect(page.getByText('Input')).toBeVisible();
    await expect(page.getByText('Output')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-expanded.png');
  });

  test('会話中にツール呼び出しが混在して表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        { id: '1', type: 'user', text: 'ファイルを読んでください' },
        {
          id: '2',
          type: 'tool_call',
          name: 'readFile',
          input: { path: '/src/main.ts' },
          status: 'completed',
          result: 'export default {}',
        },
        { id: '3', type: 'agent', text: 'ファイルの内容を確認しました。', status: 'completed' },
      ],
    });
    await app.goto();
    await expect(app.message('ファイルを読んでください')).toBeVisible();
    await expect(app.message('readFile')).toBeVisible();
    await expect(app.message('ファイルの内容を確認しました。')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-in-conversation.png');
  });
});
