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
      getMessages: () => Promise.resolve([]),
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

test.describe('アプリ初期表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI);
  });

  test('PromptInput が表示される', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });
});
