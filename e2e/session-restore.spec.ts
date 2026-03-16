import { test, expect } from '@playwright/test';

/**
 * セッション復元中（isRestoring = true）の UI をテストするための API モック。
 *
 * `load()` を決して resolve しない Promise にすることで、
 * ローディング表示が維持された状態でスクリーンショットを撮影できる。
 */
function mockKiroductorAPIRestoring() {
  (window as Record<string, unknown>).kiroductor = {
    acp: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getStatus: () => Promise.resolve('disconnected'),
      onStatusChange: () => () => {},
    },
    session: {
      create: () => Promise.resolve(),
      // never resolves — keeps the restoring state active
      load: () => new Promise(() => {}),
      switch: () => Promise.resolve(),
      prompt: () => Promise.resolve({ stopReason: 'end_turn' }),
      cancel: () => Promise.resolve(),
      getActive: () => Promise.resolve('session-1'),
      getAll: () => Promise.resolve(['session-1']),
      list: () =>
        Promise.resolve([
          {
            acpSessionId: 'session-1',
            repoId: 'repo-1',
            cwd: '/projects/my-app',
            title: 'My App',
            sourceBranch: 'main',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            acpSessionId: 'session-2',
            repoId: 'repo-2',
            cwd: '/projects/other-app',
            title: 'Other App',
            sourceBranch: 'main',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
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

/**
 * 復元完了後の UI をテストするための API モック。
 *
 * `load()` を即座に resolve し、`getMessages()` で過去のメッセージを返す。
 */
function mockKiroductorAPIRestored() {
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
      getActive: () => Promise.resolve('session-1'),
      getAll: () => Promise.resolve(['session-1']),
      list: () =>
        Promise.resolve([
          {
            acpSessionId: 'session-1',
            repoId: 'repo-1',
            cwd: '/projects/my-app',
            title: 'My App',
            sourceBranch: 'main',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            acpSessionId: 'session-2',
            repoId: 'repo-2',
            cwd: '/projects/other-app',
            title: 'Other App',
            sourceBranch: 'main',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ]),
      getMessages: () =>
        Promise.resolve([
          { id: '1', type: 'user', text: 'Hello from restored session' },
          {
            id: '2',
            type: 'agent',
            text: 'Welcome back! Your session has been restored.',
            status: 'completed',
          },
        ]),
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

test.describe('セッション復元中の UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('復元中はスピナーと "Restoring session..." が表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIRestoring);
    await page.goto('http://localhost:5173');
    // 最初のセッション（session-1）がアクティブな状態でチャット画面が表示されるまで待機
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    // 2番目のセッション（Other App）をクリックして復元中状態に遷移
    await page.getByText('Other App').click();
    // "Restoring session..." とスピナーが表示されることを確認
    await expect(page.getByText('Restoring session...')).toBeVisible();
    await expect(page).toHaveScreenshot('session-restore-loading.png');
  });

  test('復元中は PromptInput が disabled になる', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIRestoring);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    // 2番目のセッションをクリックして復元中状態に遷移
    await page.getByText('Other App').click();
    await expect(page.getByText('Restoring session...')).toBeVisible();
    // PromptInput が disabled になっていることを確認
    await expect(page.getByPlaceholder(/Type a message/)).toBeDisabled();
  });

  test('復元完了後に過去のメッセージが表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIRestored);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
    // 2番目のセッションをクリックして復元を実行
    await page.getByText('Other App').click();
    // 復元完了後にメッセージが表示されることを確認
    await expect(page.getByText('Hello from restored session')).toBeVisible();
    await expect(page.getByText('Welcome back! Your session has been restored.')).toBeVisible();
    await expect(page).toHaveScreenshot('session-restore-completed.png');
  });
});
