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
    type: 'user' | 'agent';
    text: string;
    status?: 'streaming' | 'completed';
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
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('MessageBubble', () => {
  test('ユーザーメッセージが右寄せで表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'user', text: 'こんにちは！' },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('こんにちは！')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-user.png');
  });

  test('エージェントメッセージが左寄せで表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'agent', text: 'こんにちは！何かお手伝いできますか？', status: 'completed' },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('こんにちは！何かお手伝いできますか？')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-agent.png');
  });

  test('ストリーミング中のエージェントメッセージにカーソルが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'agent', text: '考え中です', status: 'streaming' },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText(/考え中です▌/)).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-streaming.png');
  });

  test('ユーザーとエージェントのメッセージが混在する会話を表示する', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'user', text: 'TypeScript について教えてください。' },
      {
        id: '2',
        type: 'agent',
        text: 'TypeScript は JavaScript に静的型付けを追加した言語です。',
        status: 'completed',
      },
      { id: '3', type: 'user', text: '型推論はどう使いますか？' },
      {
        id: '4',
        type: 'agent',
        text: '変数を宣言するときに自動的に型が推論されます',
        status: 'streaming',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('TypeScript について教えてください。')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-conversation.png');
  });
});
