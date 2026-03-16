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
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
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

test.describe('ToolCallCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('実行中（in_progress）のツール呼び出しが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'tool_call',
        name: 'readFile',
        input: { path: '/src/main.ts' },
        status: 'in_progress',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('readFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-in-progress.png');
  });

  test('保留中（pending）のツール呼び出しが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'tool_call',
        name: 'writeFile',
        input: { path: '/src/app.ts', content: 'console.log("hello")' },
        status: 'pending',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('writeFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-pending.png');
  });

  test('完了（completed）のツール呼び出しが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'tool_call',
        name: 'readFile',
        input: { path: '/src/main.ts' },
        status: 'completed',
        result: 'File content: export default {}',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('readFile')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-completed.png');
  });

  test('エラー（failed）のツール呼び出しが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'tool_call',
        name: 'executeCommand',
        input: { command: 'rm -rf /' },
        status: 'failed',
        result: 'Permission denied',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('executeCommand')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-failed.png');
  });

  test('折りたたみを展開すると入力と出力が表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'tool_call',
        name: 'readFile',
        input: { path: '/src/main.ts' },
        status: 'completed',
        result: 'File content: export default {}',
      },
    ]);
    await page.goto('http://localhost:5173');
    await page.getByText('readFile').click();
    await expect(page.getByText('Input')).toBeVisible();
    await expect(page.getByText('Output')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-expanded.png');
  });

  test('会話中にツール呼び出しが混在して表示される', async ({ page }) => {
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
      {
        id: '3',
        type: 'agent',
        text: 'ファイルの内容を確認しました。',
        status: 'completed',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('ファイルを読んでください')).toBeVisible();
    await expect(page.getByText('readFile')).toBeVisible();
    await expect(page.getByText('ファイルの内容を確認しました。')).toBeVisible();
    await expect(page).toHaveScreenshot('tool-call-card-in-conversation.png');
  });
});
