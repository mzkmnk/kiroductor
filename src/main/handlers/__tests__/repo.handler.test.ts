import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { RepoHandler } from '../repo.handler';
import type { KiroductorSettings, RepoMapping } from '../../repositories/config.repository';
import type { DiffStats } from '../../../shared/ipc';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('RepoHandler', () => {
  let repoService: {
    clone: MockedFunction<(url: string) => Promise<string>>;
    listClonedRepos: MockedFunction<() => Promise<RepoMapping[]>>;
    createWorktree: MockedFunction<
      (
        repoId: string,
        branch?: string,
      ) => Promise<{ cwd: string; branch: string; sourceBranch: string }>
    >;
    listBranches: MockedFunction<(repoId: string) => Promise<string[]>>;
    getDiffStatsBySession: MockedFunction<(sessionId: string) => Promise<DiffStats | null>>;
    getDiffBySession: MockedFunction<(sessionId: string) => Promise<string | null>>;
  };
  let settingsService: {
    getSettings: MockedFunction<() => Promise<KiroductorSettings>>;
    updateSettings: MockedFunction<(partial: Partial<KiroductorSettings>) => Promise<void>>;
  };
  let handler: RepoHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    repoService = {
      clone: vi.fn().mockResolvedValue('repo-123'),
      listClonedRepos: vi.fn().mockResolvedValue([]),
      createWorktree: vi.fn().mockResolvedValue({ cwd: '/wt', branch: 'b', sourceBranch: 'main' }),
      listBranches: vi.fn().mockResolvedValue(['main', 'dev']),
      getDiffStatsBySession: vi.fn().mockResolvedValue(null),
      getDiffBySession: vi.fn().mockResolvedValue(null),
    };
    settingsService = {
      getSettings: vi.fn().mockResolvedValue({}),
      updateSettings: vi.fn().mockResolvedValue(undefined),
    };
    handler = new RepoHandler(repoService, settingsService);
  });

  describe('register()', () => {
    it('全チャンネルを登録する', () => {
      handler.register();

      const channels = ipcHandle.mock.calls.map((call) => call[0] as string);
      expect(channels).toContain('repo:clone');
      expect(channels).toContain('repo:list');
      expect(channels).toContain('repo:create-worktree');
      expect(channels).toContain('repo:list-branches');
      expect(channels).toContain('repo:diff-stats');
      expect(channels).toContain('repo:diff');
      expect(channels).toContain('config:get-settings');
      expect(channels).toContain('config:update-settings');
    });

    describe('repo:clone', () => {
      it('repoService.clone() を呼び、{ repoId } を返す', async () => {
        handler.register();
        const cloneHandler = ipcHandle.mock.calls.find((call) => call[0] === 'repo:clone')?.[1] as (
          _event: unknown,
          url: string,
        ) => Promise<{ repoId: string }>;

        const result = await cloneHandler(null, 'https://github.com/org/repo.git');

        expect(repoService.clone).toHaveBeenCalledWith('https://github.com/org/repo.git');
        expect(result).toEqual({ repoId: 'repo-123' });
      });
    });

    describe('repo:diff-stats', () => {
      it('repoService.getDiffStatsBySession() に sessionId を渡す', async () => {
        const stats = { filesChanged: 2, insertions: 10, deletions: 5 };
        repoService.getDiffStatsBySession.mockResolvedValue(stats);
        handler.register();
        const diffStatsHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'repo:diff-stats',
        )?.[1] as (_event: unknown, sessionId: string) => Promise<DiffStats | null>;

        const result = await diffStatsHandler(null, 'session-1');

        expect(repoService.getDiffStatsBySession).toHaveBeenCalledWith('session-1');
        expect(result).toEqual(stats);
      });
    });

    describe('repo:diff', () => {
      it('repoService.getDiffBySession() に sessionId を渡す', async () => {
        repoService.getDiffBySession.mockResolvedValue('diff output');
        handler.register();
        const diffHandler = ipcHandle.mock.calls.find((call) => call[0] === 'repo:diff')?.[1] as (
          _event: unknown,
          sessionId: string,
        ) => Promise<string | null>;

        const result = await diffHandler(null, 'session-1');

        expect(repoService.getDiffBySession).toHaveBeenCalledWith('session-1');
        expect(result).toBe('diff output');
      });
    });

    describe('config:get-settings', () => {
      it('settingsService.getSettings() の結果を返す', async () => {
        const settings: KiroductorSettings = {};
        settingsService.getSettings.mockResolvedValue(settings);
        handler.register();
        const getSettingsHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'config:get-settings',
        )?.[1] as () => Promise<KiroductorSettings>;

        const result = await getSettingsHandler();

        expect(result).toEqual(settings);
        expect(settingsService.getSettings).toHaveBeenCalledOnce();
      });
    });

    describe('config:update-settings', () => {
      it('settingsService.updateSettings() に partial を渡す', async () => {
        handler.register();
        const updateHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'config:update-settings',
        )?.[1] as (_event: unknown, partial: Partial<KiroductorSettings>) => Promise<void>;

        await updateHandler(null, {});

        expect(settingsService.updateSettings).toHaveBeenCalledWith({});
      });
    });
  });
});
