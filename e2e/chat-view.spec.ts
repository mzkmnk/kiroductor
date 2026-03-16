import { test, expect } from '@playwright/test';

/**
 * Electron の preload スクリプトが注入する window.kiroductor API のモック。
 *
 * Vite 単独起動時は preload が動作しないため、
 * {@link https://playwright.dev/docs/mock-browser-apis addInitScript} で注入する。
 */
function mockKiroductorAPIWithMessages(
  messages: {
    id: string;
    type: 'user' | 'agent' | 'tool_call';
    text?: string;
    name?: string;
    input?: unknown;
    status?: string;
    result?: string;
  }[],
) {
  (window as Record<string, unknown>).kiroductor = {
    acp: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getStatus: () => Promise.resolve('disconnected'),
      onStatusChange: () => () => {},
    },
    session: {
      create: () => Promise.resolve(),
      load: () => Promise.resolve(),
      switch: () => Promise.resolve(),
      prompt: () => Promise.resolve({ stopReason: 'end_turn' }),
      cancel: () => Promise.resolve(),
      getActive: () => Promise.resolve('mock-session-id'),
      getAll: () => Promise.resolve(['mock-session-id']),
      list: () =>
        Promise.resolve([
          {
            acpSessionId: 'mock-session-id',
            repoId: 'mock-repo',
            cwd: '/mock/cwd',
            title: 'Mock Session',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      getMessages: () => Promise.resolve(messages),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
    },
    repo: {
      clone: () => Promise.resolve({ repoId: 'mock-repo' }),
      list: () => Promise.resolve([]),
      createWorktree: () => Promise.resolve({ cwd: '/mock/cwd' }),
      listBranches: () => Promise.resolve([]),
      getDiffStats: () => Promise.resolve(null),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('ChatView', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('メッセージが空の場合は空のコンテナが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, []);
    await page.goto('http://localhost:5173');
    // getActive() が resolve してチャット画面に切り替わるまで待機する
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-empty.png');
  });

  test('ユーザーとエージェントのメッセージが縦に並んで表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'user', text: 'こんにちは！' },
      { id: '2', type: 'agent', text: 'こんにちは！何かお手伝いできますか？', status: 'completed' },
      { id: '3', type: 'user', text: 'TypeScript について教えてください。' },
      {
        id: '4',
        type: 'agent',
        text: 'TypeScript は JavaScript に静的型付けを追加した言語です。',
        status: 'completed',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('こんにちは！', { exact: true })).toBeVisible();
    await expect(page.getByText('TypeScript について教えてください。')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-messages.png');
  });

  test('ツール呼び出しとメッセージが混在して縦に並んで表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
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
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('ファイルを読んでください')).toBeVisible();
    await expect(page.getByText('readFile')).toBeVisible();
    await expect(page.getByText('ファイルの内容を確認しました。')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-mixed.png');
  });

  test('多数のメッセージがある場合に最下部へスクロールされる', async ({ page }) => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      type: i % 2 === 0 ? ('user' as const) : ('agent' as const),
      text: `メッセージ ${i + 1}`,
      status: 'completed' as const,
    }));
    await page.addInitScript(mockKiroductorAPIWithMessages, messages);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('メッセージ 20')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-view-scrolled.png');
  });
});
