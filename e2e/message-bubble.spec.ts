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
      isAcpConnected: () => Promise.resolve(true),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
      getModels: () =>
        Promise.resolve({
          currentModelId: 'claude-sonnet-4-20250514',
          availableModels: [
            { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
            { modelId: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
          ],
        }),
      setModel: () => Promise.resolve(),
      onModelChanged: () => () => {},
    },
    repo: {
      clone: () => Promise.resolve({ repoId: 'mock-repo' }),
      list: () => Promise.resolve([]),
      createWorktree: () => Promise.resolve({ cwd: '/mock/cwd' }),
      listBranches: () => Promise.resolve([]),
      getDiffStats: () => Promise.resolve(null),
      getDiff: () => Promise.resolve(null),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('MessageBubble', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

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

  test('ストリーミング中のエージェントメッセージが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      { id: '1', type: 'agent', text: '考え中です', status: 'streaming' },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('考え中です')).toBeVisible();
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

  test('エージェントメッセージがMarkdownでレンダリングされる', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'agent',
        text: [
          '## TypeScript の特徴',
          '',
          'TypeScript には以下の特徴があります：',
          '',
          '- **静的型付け**: コンパイル時に型エラーを検出',
          '- *型推論*: 明示的な型注釈なしでも型を推論',
          '- `interface` と `type` による型定義',
          '',
          '```typescript',
          'const greet = (name: string): string => {',
          '  return `Hello, ${name}!`;',
          '};',
          '```',
          '',
          '> TypeScript は JavaScript のスーパーセットです。',
        ].join('\n'),
        status: 'completed',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('heading', { name: 'TypeScript の特徴' })).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-agent.png');
  });

  test('ユーザーメッセージがMarkdownでレンダリングされる', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'user',
        text: [
          '以下の関数を修正してください：',
          '',
          '```typescript',
          'function add(a, b) {',
          '  return a + b;',
          '}',
          '```',
          '',
          '1. 引数に型注釈を追加',
          '2. 戻り値の型を明示',
        ].join('\n'),
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByText('以下の関数を修正してください：')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-user.png');
  });

  test('Markdownのテーブルとリンクが正しく表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithMessages, [
      {
        id: '1',
        type: 'agent',
        text: [
          '型の比較表です：',
          '',
          '| 型 | 説明 | 例 |',
          '|---|---|---|',
          '| `string` | 文字列 | `"hello"` |',
          '| `number` | 数値 | `42` |',
          '| `boolean` | 真偽値 | `true` |',
          '',
          '詳細は [TypeScript公式ドキュメント](https://www.typescriptlang.org/) を参照してください。',
        ].join('\n'),
        status: 'completed',
      },
    ]);
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-table.png');
  });
});
