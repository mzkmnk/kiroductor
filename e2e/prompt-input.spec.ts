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
      prompt: () =>
        new Promise((resolve) => setTimeout(() => resolve({ stopReason: 'end_turn' }), 500)),
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
            sourceBranch: 'main',
            currentBranch: 'kiroductor/mock-session',
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
      listBranches: () => Promise.resolve([]),
      getDiffStats: () => Promise.resolve({}),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('PromptInput', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
    await page.addInitScript(mockKiroductorAPI);
    await page.goto('http://localhost:5173');
  });

  test('matches screenshot in default state', async ({ page }) => {
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    await expect(page).toHaveScreenshot('prompt-input-default.png');
  });

  test('matches screenshot with text filled', async ({ page }) => {
    await page.getByPlaceholder(/Type a message/).fill('Hello, agent!');
    await expect(page).toHaveScreenshot('prompt-input-filled.png');
  });

  test('matches screenshot while processing (disabled)', async ({ page }) => {
    // Fill text and click Send to trigger the processing state
    await page.getByPlaceholder(/Type a message/).fill('processing test');
    await page.getByRole('button', { name: 'Send' }).click();
    // prompt() resolves after 500ms, so the textarea is disabled during that time
    await expect(page.getByPlaceholder(/Type a message/)).toBeDisabled();
    await expect(page).toHaveScreenshot('prompt-input-disabled.png');
  });
});
