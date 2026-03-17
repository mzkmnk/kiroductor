import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

test.describe('MessageBubble', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('ユーザーメッセージが右寄せで表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({ messages: [{ id: '1', type: 'user', text: 'こんにちは！' }] });
    await app.goto();
    await expect(app.message('こんにちは！')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-user.png');
  });

  test('エージェントメッセージが左寄せで表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'agent',
          text: 'こんにちは！何かお手伝いできますか？',
          status: 'completed',
        },
      ],
    });
    await app.goto();
    await expect(app.message('こんにちは！何かお手伝いできますか？')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-agent.png');
  });

  test('ストリーミング中のエージェントメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [{ id: '1', type: 'agent', text: '考え中です', status: 'streaming' }],
    });
    await app.goto();
    await expect(app.message('考え中です')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-streaming.png');
  });

  test('ユーザーとエージェントのメッセージが混在する会話を表示する', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
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
      ],
    });
    await app.goto();
    await expect(app.message('TypeScript について教えてください。')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-conversation.png');
  });

  test('エージェントメッセージがMarkdownでレンダリングされる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
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
      ],
    });
    await app.goto();
    await expect(page.getByRole('heading', { name: 'TypeScript の特徴' })).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-agent.png');
  });

  test('ユーザーメッセージがMarkdownでレンダリングされる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
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
      ],
    });
    await app.goto();
    await expect(app.message('以下の関数を修正してください：')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-user.png');
  });

  test('Markdownのテーブルとリンクが正しく表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
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
      ],
    });
    await app.goto();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-table.png');
  });
});
