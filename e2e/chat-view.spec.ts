import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';
import { SESSION_WITH_BRANCHES } from './fixtures/mock-api';

test.describe('ChatView', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('メッセージが空の場合は空のコンテナが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ sessions: [SESSION_WITH_BRANCHES] });
    await app.goto();
    await app.waitForReady();
    await expect(page).toHaveScreenshot('chat-view-empty.png');
  });

  test('ユーザーとエージェントのメッセージが縦に並んで表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: [
        { id: '1', type: 'user', text: 'こんにちは！' },
        {
          id: '2',
          type: 'agent',
          text: 'こんにちは！何かお手伝いできますか？',
          status: 'completed',
        },
        { id: '3', type: 'user', text: 'TypeScript について教えてください。' },
        {
          id: '4',
          type: 'agent',
          text: 'TypeScript は JavaScript に静的型付けを追加した言語です。',
          status: 'completed',
        },
      ],
    });
    await app.goto();
    await expect(app.message('こんにちは！', { exact: true })).toBeVisible();
    await expect(app.message('TypeScript について教えてください。')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-messages.png');
  });

  test('ツール呼び出しとメッセージが混在して縦に並んで表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
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
    await expect(page).toHaveScreenshot('chat-view-mixed.png');
  });

  test('多数のメッセージがある場合に最下部へスクロールされる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: Array.from({ length: 20 }, (_, i) => ({
        id: String(i + 1),
        type: i % 2 === 0 ? ('user' as const) : ('agent' as const),
        text: `メッセージ ${i + 1}`,
        status: 'completed' as const,
      })),
    });
    await app.goto();
    await expect(app.message('メッセージ 20')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-scrolled.png');
  });

  test('ブランチヘッダーに sourceBranch と currentBranch が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [SESSION_WITH_BRANCHES],
      messages: [
        { id: '1', type: 'user', text: 'Hello' },
        { id: '2', type: 'agent', text: 'Hi there!', status: 'completed' },
      ],
    });
    await app.goto();
    await expect(app.message('main')).toBeVisible();
    await expect(app.message('feature/add-header')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-branch-header.png');
  });
});
