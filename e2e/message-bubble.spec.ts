import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';

/** テスト用 1x1 赤ピクセル PNG の Base64（モックメッセージの attachments 用） */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

/** テスト用 1x1 青ピクセル PNG の Base64（2枚目の画像用） */
const TINY_BLUE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

const MARKDOWN_SAMPLE = [
  '# Markdown サンプル',
  '',
  '## 見出し',
  '',
  '### h3 見出し',
  '#### h4 見出し',
  '',
  '---',
  '',
  '## テキスト装飾',
  '',
  '通常のテキスト、**太字**、*イタリック*、~~取り消し線~~、`インラインコード`',
  '',
  '> ブロッククォート：これは引用文です。',
  '> 複数行にもなります。',
  '',
  '---',
  '',
  '## リスト',
  '',
  '- アイテム1',
  '- アイテム2',
  '  - ネスト1',
  '  - ネスト2',
  '- アイテム3',
  '',
  '1. 番号付き1',
  '2. 番号付き2',
  '3. 番号付き3',
  '',
  '---',
  '',
  '## コードブロック',
  '',
  '```typescript',
  'type Result<T, E = Error> =',
  '  | { ok: true; value: T }',
  '  | { ok: false; error: E };',
  '',
  'async function fetchUser(id: string): Promise<Result<User>> {',
  '  try {',
  '    const res = await fetch(`/api/users/${id}`);',
  '    if (!res.ok) return { ok: false, error: new Error(res.statusText) };',
  '    return { ok: true, value: await res.json() };',
  '  } catch (e) {',
  '    return { ok: false, error: e as Error };',
  '  }',
  '}',
  '```',
  '',
  '```python',
  'def fibonacci(n: int) -> list[int]:',
  '    a, b = 0, 1',
  '    result = []',
  '    while a < n:',
  '        result.append(a)',
  '        a, b = b, a + b',
  '    return result',
  '',
  'print(fibonacci(100))',
  '```',
  '',
  '```bash',
  'pnpm install',
  'pnpm start',
  'pnpm test',
  '```',
  '',
  '```json',
  '{',
  '  "name": "kiroductor",',
  '  "version": "0.0.1",',
  '  "scripts": {',
  '    "start": "electron-vite dev",',
  '    "build": "electron-vite build"',
  '  }',
  '}',
  '```',
  '',
  '---',
  '',
  '## テーブル',
  '',
  '| ライブラリ | Stars | 用途 |',
  '|---|---|---|',
  '| `react-markdown` | 14k | Markdown レンダリング |',
  '| `shiki` | 13k | シンタックスハイライト |',
  '| `remark-gfm` | 1k | GFM 拡張 |',
  '',
  '---',
  '',
  '## リンク',
  '',
  '[GitHub](https://github.com) / [公式ドキュメント](https://docs.example.com)',
].join('\n');

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
          text: MARKDOWN_SAMPLE,
          status: 'completed',
        },
      ],
    });
    await app.goto();
    await expect(page.getByRole('heading', { name: 'Markdown サンプル' })).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-agent.png');
  });

  test('ユーザーメッセージがMarkdownでレンダリングされる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'user',
          text: MARKDOWN_SAMPLE,
        },
      ],
    });
    await app.goto();
    await expect(page.getByRole('heading', { name: 'Markdown サンプル' })).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-markdown-user.png');
  });

  test('添付画像付きのユーザーメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'user',
          text: 'この画像を見てください',
          attachments: [{ mimeType: 'image/png', data: TINY_PNG_BASE64 }],
        },
      ],
    });
    await app.goto();
    await expect(app.message('この画像を見てください')).toBeVisible();
    await expect(page.getByAltText('Attached image')).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-user-with-image.png');
  });

  test('複数の添付画像付きユーザーメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'user',
          text: '2枚の画像を比較してください',
          attachments: [
            { mimeType: 'image/png', data: TINY_PNG_BASE64 },
            { mimeType: 'image/png', data: TINY_BLUE_PNG_BASE64 },
          ],
        },
      ],
    });
    await app.goto();
    await expect(app.message('2枚の画像を比較してください')).toBeVisible();
    const images = page.getByAltText('Attached image');
    await expect(images).toHaveCount(2);
    await expect(page).toHaveScreenshot('message-bubble-user-with-multiple-images.png');
  });

  test('10枚の添付画像付きユーザーメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'user',
          text: '10枚の画像を確認してください',
          attachments: Array.from({ length: 10 }, (_, i) => ({
            mimeType: 'image/png',
            data: i % 2 === 0 ? TINY_PNG_BASE64 : TINY_BLUE_PNG_BASE64,
          })),
        },
      ],
    });
    await app.goto();
    await expect(app.message('10枚の画像を確認してください')).toBeVisible();
    const images = page.getByAltText('Attached image');
    await expect(images).toHaveCount(10);
    await expect(page).toHaveScreenshot('message-bubble-user-with-10-images.png');
  });

  test('添付画像付きメッセージとエージェント返答の会話が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      messages: [
        {
          id: '1',
          type: 'user',
          text: 'このスクリーンショットのバグを修正してください',
          attachments: [{ mimeType: 'image/png', data: TINY_PNG_BASE64 }],
        },
        {
          id: '2',
          type: 'agent',
          text: '画像を確認しました。ボタンの位置がずれていますね。修正します。',
          status: 'completed',
        },
      ],
    });
    await app.goto();
    await expect(app.message('このスクリーンショットのバグを修正してください')).toBeVisible();
    await expect(
      app.message('画像を確認しました。ボタンの位置がずれていますね。修正します。'),
    ).toBeVisible();
    await expect(page).toHaveScreenshot('message-bubble-conversation-with-image.png');
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
