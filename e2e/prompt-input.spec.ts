import { test, expect } from '@playwright/test';

/**
 * Electron の preload スクリプトが注入する window.kiroductor API のモック。
 *
 * Vite 単独起動時は preload が動作しないため、
 * {@link https://playwright.dev/docs/mock-browser-apis addInitScript} で注入する。
 */
function mockKiroductorAPI() {
  (window as Record<string, unknown>).kiroductor = {
    acp: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getStatus: () => Promise.resolve('disconnected'),
      onStatusChange: () => () => {},
    },
    session: {
      create: () => Promise.resolve(),
      prompt: () =>
        new Promise((resolve) => setTimeout(() => resolve({ stopReason: 'end_turn' }), 500)),
      cancel: () => Promise.resolve(),
      getMessages: () => Promise.resolve([]),
      onUpdate: () => () => {},
    },
  };
}

test.describe('PromptInput', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI);
    await page.goto('http://localhost:5173');
  });

  test('通常状態のスクリーンショットと一致する', async ({ page }) => {
    await expect(page.getByPlaceholder(/メッセージを入力/)).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-default.png');
  });

  test('テキスト入力済み状態のスクリーンショットと一致する', async ({ page }) => {
    await page.getByPlaceholder(/メッセージを入力/).fill('こんにちは、エージェント！');
    await expect(page).toHaveScreenshot('prompt-input-filled.png');
  });

  test('送信処理中（disabled）状態のスクリーンショットと一致する', async ({ page }) => {
    // テキストを入力して送信ボタンをクリックすることで processing 状態に移行させる
    await page.getByPlaceholder(/メッセージを入力/).fill('処理中テスト');
    await page.getByRole('button', { name: '送信' }).click();
    // prompt() は 500ms 後に resolve するため、その間は disabled 状態になる
    await expect(page.getByPlaceholder(/メッセージを入力/)).toBeDisabled();
    await expect(page).toHaveScreenshot('prompt-input-disabled.png');
  });
});
