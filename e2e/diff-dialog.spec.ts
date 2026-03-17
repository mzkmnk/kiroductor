import { test, expect } from '@playwright/test';

/** テスト用のサンプル unified diff 文字列。 */
const SAMPLE_DIFF = [
  'diff --git a/src/main.ts b/src/main.ts',
  'index abc1234..def5678 100644',
  '--- a/src/main.ts',
  '+++ b/src/main.ts',
  '@@ -1,5 +1,7 @@',
  ' import { app } from "electron";',
  '+import { BrowserWindow } from "electron";',
  '+import { ipcMain } from "electron";',
  ' ',
  ' app.whenReady().then(() => {',
  '-  console.log("ready");',
  '+  const win = new BrowserWindow();',
  '+  win.loadURL("http://localhost:5173");',
  ' });',
  'diff --git a/src/utils.ts b/src/utils.ts',
  'new file mode 100644',
  'index 0000000..1234567',
  '--- /dev/null',
  '+++ b/src/utils.ts',
  '@@ -0,0 +1,3 @@',
  '+export function add(a: number, b: number): number {',
  '+  return a + b;',
  '+}',
].join('\n');

/**
 * Electron の preload スクリプトが注入する window.kiroductor API のモック。
 *
 * @param diffResponse - getDiff が返す unified diff 文字列（null = 変更なし）
 */
function mockKiroductorAPI(diffResponse: string | null) {
  const hasChanges = diffResponse !== null;
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
            currentBranch: 'feature/add-header',
            sourceBranch: 'main',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      getMessages: () =>
        Promise.resolve([
          { id: '1', type: 'user', text: 'Hello' },
          { id: '2', type: 'agent', text: 'Hi there!', status: 'completed' },
        ]),
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
      getDiffStats: () =>
        Promise.resolve(hasChanges ? { filesChanged: 2, insertions: 5, deletions: 1 } : null),
      getDiff: () => Promise.resolve(diffResponse),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}

test.describe('DiffDialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2025-01-01T00:00:00.000Z') });
  });

  test('diff ボタンが ChatView ヘッダーに表示されること', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI, null);
    await page.goto('http://localhost:5173');
    await expect(page.getByLabel('Show diff')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-button-in-header.png');
  });

  test('diff ボタンクリックで split diff ビューが表示されること', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI, SAMPLE_DIFF);
    await page.goto('http://localhost:5173');
    await page.getByLabel('Show diff').click();
    await expect(page.getByText('src/main.ts')).toBeVisible();
    await expect(page.getByText('src/utils.ts')).toBeVisible();
    await expect(page).toHaveScreenshot('diff-dialog-with-changes.png');
  });

  test('diff データが空の場合ボタンが無効化されること', async ({ page }) => {
    await page.addInitScript(mockKiroductorAPI, null);
    await page.goto('http://localhost:5173');
    await expect(page.getByLabel('Show diff')).toBeDisabled();
  });
});
