import { test, expect } from '@playwright/test';

import { AppPage } from './pages/app.page';
import type { MockSession } from './fixtures/mock-api';

/** セッション復元テスト用のセッション一覧 */
const RESTORE_SESSIONS: MockSession[] = [
  {
    acpSessionId: 'session-1',
    repoId: 'repo-1',
    cwd: '/projects/my-app',
    title: 'My App',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    acpSessionId: 'session-2',
    repoId: 'repo-2',
    cwd: '/projects/other-app',
    title: 'Other App',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

test.describe('セッション復元中の UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('復元中はスピナーと "Restoring session..." が表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: RESTORE_SESSIONS,
      activeSession: 'session-1',
      loadNeverResolves: true,
      acpConnected: false,
    });
    await app.goto();
    // session-1 がアクティブな状態でチャット画面が表示されるまで待機
    await app.waitForReady();
    // session-2 (Other App) をクリックして復元中状態に遷移
    await app.sessionItem('Other App').click();
    await expect(app.restoringIndicator).toBeVisible();
    await expect(page).toHaveScreenshot('session-restore-loading.png');
  });

  test('復元中は PromptInput が disabled になる', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: RESTORE_SESSIONS,
      activeSession: 'session-1',
      loadNeverResolves: true,
      acpConnected: false,
    });
    await app.goto();
    await app.waitForReady();
    await app.sessionItem('Other App').click();
    await expect(app.restoringIndicator).toBeVisible();
    await expect(app.promptInput).toBeDisabled();
  });

  test('復元完了後に過去のメッセージが表示される', async ({ page }) => {
    const app = new AppPage(page);
    await app.setup({
      sessions: RESTORE_SESSIONS,
      activeSession: 'session-1',
      acpConnected: false,
      messages: [
        { id: '1', type: 'user', text: 'Hello from restored session' },
        {
          id: '2',
          type: 'agent',
          text: 'Welcome back! Your session has been restored.',
          status: 'completed',
        },
      ],
    });
    await app.goto();
    await app.waitForReady();
    await app.sessionItem('Other App').click();
    await expect(app.message('Hello from restored session')).toBeVisible();
    await expect(app.message('Welcome back! Your session has been restored.')).toBeVisible();
    await expect(page).toHaveScreenshot('session-restore-completed.png');
  });
});
