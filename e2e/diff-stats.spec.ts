import { test, expect } from '@playwright/test';

/**
 * diff stats が存在するセッションを含む API モック。
 *
 * セッション1: insertions=42, deletions=7
 * セッション2: insertions=0, deletions=0（変更なし — 非表示）
 * セッション3: insertions=120, deletions=58
 */
function mockKiroductorAPIWithDiffStats() {
  const diffStatsData: Record<string, { insertions: number; deletions: number } | null> = {
    'session-1': { insertions: 42, deletions: 7 },
    'session-2': { insertions: 0, deletions: 0 },
    'session-3': { insertions: 120, deletions: 58 },
  };

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
      getAll: () => Promise.resolve(['session-1', 'session-2', 'session-3']),
      list: () =>
        Promise.resolve([
          {
            acpSessionId: 'session-1',
            repoId: 'repo-1',
            cwd: '/projects/my-app',
            title: 'Feature: Auth',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:30:00.000Z',
          },
          {
            acpSessionId: 'session-2',
            repoId: 'repo-2',
            cwd: '/projects/api-server',
            title: 'Refactor: DB layer',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:20:00.000Z',
          },
          {
            acpSessionId: 'session-3',
            repoId: 'repo-3',
            cwd: '/projects/dashboard',
            title: 'Fix: Chart rendering',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:10:00.000Z',
          },
        ]),
      getMessages: () => Promise.resolve([]),
      isAcpConnected: () => Promise.resolve(true),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
    },
    repo: {
      clone: () => Promise.resolve({ repoId: 'mock-repo' }),
      list: () => Promise.resolve([]),
      createWorktree: () => Promise.resolve({ cwd: '/mock/cwd' }),
      listBranches: () => Promise.resolve([]),
      getDiffStats: (sessionId: string) => Promise.resolve(diffStatsData[sessionId] ?? null),
      getDiff: () => Promise.resolve(null),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

/**
 * タイトルが長いセッションの API モック。
 *
 * タイトルが省略（truncate）され、diff stats が被らないことを検証する。
 */
function mockKiroductorAPIWithLongTitle() {
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
      getActive: () => Promise.resolve('session-long'),
      getAll: () => Promise.resolve(['session-long']),
      list: () =>
        Promise.resolve([
          {
            acpSessionId: 'session-long',
            repoId: 'repo-1',
            cwd: '/projects/my-very-long-project-name',
            title:
              'Implement comprehensive user authentication system with OAuth2 and SAML support for enterprise',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:30:00.000Z',
          },
        ]),
      getMessages: () => Promise.resolve([]),
      isAcpConnected: () => Promise.resolve(true),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
    },
    repo: {
      clone: () => Promise.resolve({ repoId: 'mock-repo' }),
      list: () => Promise.resolve([]),
      createWorktree: () => Promise.resolve({ cwd: '/mock/cwd' }),
      listBranches: () => Promise.resolve([]),
      getDiffStats: () => Promise.resolve({ insertions: 256, deletions: 89 }),
      getDiff: () => Promise.resolve(null),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

/**
 * diff stats が null を返すセッション（diff stats 非表示）の API モック。
 */
function mockKiroductorAPINoDiffStats() {
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
            title: 'New Session',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ]),
      getMessages: () => Promise.resolve([]),
      isAcpConnected: () => Promise.resolve(true),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
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

test.describe('Diff Stats 表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T01:00:00.000Z') });
  });

  test('変更があるセッションに +insertions -deletions が表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // session-1: +42 -7 が表示される
    await expect(page.getByText('+42')).toBeVisible();
    await expect(page.getByText('-7')).toBeVisible();

    // session-3: +120 -58 が表示される
    await expect(page.getByText('+120')).toBeVisible();
    await expect(page.getByText('-58')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-visible.png');
  });

  test('変更が 0/0 のセッションには diff stats が表示されない', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // session-2 (Refactor: DB layer) には diff stats が表示されない
    const session2 = page.getByText('Refactor: DB layer');
    await expect(session2).toBeVisible();
    // session-2 の行に +0 や -0 が表示されていないことを確認
    const session2Item = session2.locator('..').locator('..');
    await expect(session2Item.getByText(/^\+0$/)).not.toBeVisible();
  });

  test('タイトルが長い場合、タイトルが省略され diff stats は完全に表示される', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPIWithLongTitle);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // diff stats が完全に表示される
    await expect(page.getByText('+256')).toBeVisible();
    await expect(page.getByText('-89')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-long-title.png');
  });

  test('diff stats が null のセッションには何も表示されない', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPINoDiffStats);
    await page.goto('http://localhost:5173');
    await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();

    // diff stats 要素が存在しないことを確認
    await expect(page.locator('.text-green-500')).not.toBeVisible();
    await expect(page.locator('.text-red-500')).not.toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-none.png');
  });
});
