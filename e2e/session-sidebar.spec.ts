import { test, expect } from '@playwright/test';

/**
 * diff stats 付きのセッション一覧を返す API モック。
 *
 * サイドバーに差分統計（`+N` / `-N`）が表示されることを検証する。
 */
function mockKiroductorAPIWithDiffStats() {
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
            title: 'Feature: Auth',
            sourceBranch: 'main',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T01:00:00.000Z',
          },
          {
            acpSessionId: 'session-2',
            repoId: 'repo-1',
            cwd: '/projects/my-app-2',
            title: 'Fix: Login Bug',
            sourceBranch: 'develop',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:30:00.000Z',
          },
          {
            acpSessionId: 'session-3',
            repoId: 'repo-2',
            cwd: '/projects/other',
            title: 'No Changes Session',
            sourceBranch: 'main',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
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
      getDiffStats: () =>
        Promise.resolve({
          'session-1': { insertions: 111, deletions: 51 },
          'session-2': { insertions: 23, deletions: 7 },
          'session-3': { insertions: 0, deletions: 0 },
        }),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

/**
 * diff stats が取得できないセッションを含む API モック。
 *
 * 一部セッションの diff stats が null（エラー）の場合でも
 * サイドバーが正常にレンダリングされることを検証する。
 */
function mockKiroductorAPIWithPartialDiffStats() {
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
            title: 'Working Session',
            sourceBranch: 'main',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T01:00:00.000Z',
          },
          {
            acpSessionId: 'session-2',
            repoId: 'repo-2',
            cwd: '/projects/broken',
            title: 'Broken Worktree',
            sourceBranch: 'main',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
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
      getDiffStats: () =>
        Promise.resolve({
          'session-1': { insertions: 42, deletions: 10 },
          'session-2': null,
        }),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('SessionSidebar の diff stats 表示', () => {
  test('各セッションに差分統計が表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // diff stats の表示を確認
    await expect(page.getByText('+111')).toBeVisible();
    await expect(page.getByText('-51')).toBeVisible();
    await expect(page.getByText('+23')).toBeVisible();
    await expect(page.getByText('-7')).toBeVisible();

    await expect(page).toHaveScreenshot('sidebar-diff-stats.png');
  });

  test('insertions と deletions が両方 0 の場合は差分統計が非表示になる', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // session-3 (No Changes Session) には +0 / -0 が表示されないことを確認
    const noChangesItem = page.getByText('No Changes Session');
    await expect(noChangesItem).toBeVisible();
    // No Changes Session の親要素内に +0 がないことを確認
    const sessionItem = noChangesItem.locator('..').locator('..');
    await expect(sessionItem.getByText('+0')).not.toBeVisible();
  });

  test('diff stats が null のセッションでもサイドバーが正常に表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithPartialDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // 正常なセッションには diff stats が表示される
    await expect(page.getByText('+42')).toBeVisible();
    await expect(page.getByText('-10')).toBeVisible();

    // エラーのセッションでもタイトルは表示される
    await expect(page.getByText('Broken Worktree')).toBeVisible();

    await expect(page).toHaveScreenshot('sidebar-diff-stats-partial.png');
  });
});
