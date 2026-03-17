import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';
import type { MockSession } from './fixtures/mock-api';

/**
 * diff stats テスト用のセッション一覧。
 *
 * session-1: insertions=42, deletions=7
 * session-2: insertions=0, deletions=0（変更なし — 非表示）
 * session-3: insertions=120, deletions=58
 */
const DIFF_STATS_SESSIONS: MockSession[] = [
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
];

test.describe('Diff Stats 表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T01:00:00.000Z') });
  });

  test('変更があるセッションに +insertions -deletions が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: DIFF_STATS_SESSIONS,
      activeSession: 'session-1',
      diffStatsMap: {
        'session-1': { insertions: 42, deletions: 7 },
        'session-2': { insertions: 0, deletions: 0 },
        'session-3': { insertions: 120, deletions: 58 },
      },
    });
    await app.goto();
    await app.waitForReady();

    // session-1: +42 -7 が表示される
    await expect(app.message('+42')).toBeVisible();
    await expect(app.message('-7')).toBeVisible();

    // session-3: +120 -58 が表示される
    await expect(app.message('+120')).toBeVisible();
    await expect(app.message('-58')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-visible.png');
  });

  test('変更が 0/0 のセッションには diff stats が表示されない', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: DIFF_STATS_SESSIONS,
      activeSession: 'session-1',
      diffStatsMap: {
        'session-1': { insertions: 42, deletions: 7 },
        'session-2': { insertions: 0, deletions: 0 },
        'session-3': { insertions: 120, deletions: 58 },
      },
    });
    await app.goto();
    await app.waitForReady();

    // session-2 (Refactor: DB layer) には diff stats が表示されない
    const session2 = app.sessionItem('Refactor: DB layer');
    await expect(session2).toBeVisible();
    // session-2 の行に +0 や -0 が表示されていないことを確認
    const session2Item = session2.locator('..').locator('..');
    await expect(session2Item.getByText(/^\+0$/)).not.toBeVisible();
  });

  test('タイトルが長い場合、タイトルが省略され diff stats は完全に表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [
        {
          acpSessionId: 'session-long',
          repoId: 'repo-1',
          cwd: '/projects/my-very-long-project-name',
          title:
            'Implement comprehensive user authentication system with OAuth2 and SAML support for enterprise',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:30:00.000Z',
        },
      ],
      activeSession: 'session-long',
      diffStats: { insertions: 256, deletions: 89 },
    });
    await app.goto();
    await app.waitForReady();

    await expect(app.message('+256')).toBeVisible();
    await expect(app.message('-89')).toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-long-title.png');
  });

  test('diff stats が null のセッションには何も表示されない', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: [
        {
          acpSessionId: 'session-1',
          repoId: 'repo-1',
          cwd: '/projects/my-app',
          title: 'New Session',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      activeSession: 'session-1',
    });
    await app.goto();
    await app.waitForReady();

    // diff stats 要素が存在しないことを確認
    await expect(page.locator('.text-green-500')).not.toBeVisible();
    await expect(page.locator('.text-red-500')).not.toBeVisible();

    await expect(page).toHaveScreenshot('diff-stats-none.png');
  });
});
