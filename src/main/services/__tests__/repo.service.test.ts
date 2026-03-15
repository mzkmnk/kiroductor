import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { RepoService, type SpawnForRepo } from '../repo.service';
import { ConfigRepository } from '../../repositories/config.repository';
import type { FileSystem } from '../../fs';

describe('RepoService', () => {
  let configRepo: ConfigRepository;
  let spawnFn: MockedFunction<SpawnForRepo>;
  let service: RepoService;
  let fs: FileSystem;

  beforeEach(() => {
    fs = {
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockRejectedValue(new Error('ENOENT')),
      readdir: vi.fn().mockResolvedValue([]),
    };
    configRepo = new ConfigRepository(fs, '/home/test/.kiroductor');
    spawnFn = vi.fn();
    service = new RepoService(configRepo, fs, spawnFn);
  });

  describe('parseRepoUrl(url)', () => {
    it('HTTPS URL（.git 付き）をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('https://github.com/mzkmnk/kiroductor.git');
      expect(result).toEqual({ host: 'github.com', org: 'mzkmnk', repo: 'kiroductor' });
    });

    it('SSH URL をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('git@github.com:mzkmnk/kiroductor.git');
      expect(result).toEqual({ host: 'github.com', org: 'mzkmnk', repo: 'kiroductor' });
    });

    it('HTTPS URL（.git なし）をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('https://gitlab.com/user/project');
      expect(result).toEqual({ host: 'gitlab.com', org: 'user', repo: 'project' });
    });

    it('不正な URL の場合エラーを投げること', () => {
      expect(() => service.parseRepoUrl('invalid-url')).toThrow();
    });
  });

  describe('getRepoPath(repoId)', () => {
    it('repoId から bare clone のパスを返すこと', () => {
      const result = service.getRepoPath('github.com/mzkmnk/kiroductor');
      expect(result).toBe('/home/test/.kiroductor/repos/github.com/mzkmnk/kiroductor.git');
    });
  });

  describe('clone(url)', () => {
    it('未クローンの場合 git clone --bare が実行されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(spawnFn).toHaveBeenCalledWith(
        'git',
        [
          'clone',
          '--bare',
          'https://github.com/mzkmnk/kiroductor.git',
          expect.stringContaining('kiroductor.git'),
        ],
        expect.any(Object),
      );
    });

    it('既にクローン済みの場合 git fetch --all が実行されること', async () => {
      (fs.access as MockedFunction<FileSystem['access']>).mockResolvedValue(undefined);
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(spawnFn).toHaveBeenCalledWith(
        'git',
        ['fetch', '--all'],
        expect.objectContaining({
          cwd: expect.stringContaining('kiroductor.git'),
        }),
      );
    });

    it('クローン先ディレクトリの親が存在しなければ作成すること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('github.com/mzkmnk'), {
        recursive: true,
      });
    });

    it('git コマンドが失敗した場合エラーを投げること', async () => {
      const mockProcess = createMockProcess(1, 'clone failed');
      spawnFn.mockReturnValue(mockProcess);

      await expect(service.clone('https://github.com/mzkmnk/kiroductor.git')).rejects.toThrow(
        'clone failed',
      );
    });

    it('clone が成功した場合 repoId を返すこと', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      const result = await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(result).toBe('github.com/mzkmnk/kiroductor');
    });
  });

  describe('createWorktree(repoId, branch?)', () => {
    it('git worktree add が実行されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.createWorktree('github.com/mzkmnk/kiroductor');

      expect(spawnFn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', expect.any(String), expect.any(String)],
        expect.objectContaining({
          cwd: expect.stringContaining('kiroductor.git'),
        }),
      );
    });

    it('branch を指定した場合その branch が使用されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.createWorktree('github.com/mzkmnk/kiroductor', 'feature/test');

      expect(spawnFn).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', expect.any(String), 'feature/test'],
        expect.any(Object),
      );
    });

    it('返されたパスが ~/.kiroductor/worktrees/{random}/{repoName} 形式であること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      const result = await service.createWorktree('github.com/mzkmnk/kiroductor');

      expect(result.cwd).toMatch(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+\/kiroductor$/);
    });

    it('worktrees/{random} ディレクトリが存在しなければ作成すること', async () => {
      const mockProcess = createMockProcess(0);
      spawnFn.mockReturnValue(mockProcess);

      await service.createWorktree('github.com/mzkmnk/kiroductor');

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+$/),
        { recursive: true },
      );
    });
  });

  describe('listClonedRepos()', () => {
    it('repos/ 配下のディレクトリ構造から repoId の一覧を生成すること', async () => {
      (fs.readdir as MockedFunction<FileSystem['readdir']>)
        .mockResolvedValueOnce(['github.com']) // hosts
        .mockResolvedValueOnce(['mzkmnk']) // orgs
        .mockResolvedValueOnce(['kiroductor.git']); // repos

      const result = await service.listClonedRepos();

      expect(result).toEqual(['github.com/mzkmnk/kiroductor']);
    });
  });
});

/** テスト用のモックプロセスを作成する。 */
function createMockProcess(exitCode: number, stderrOutput?: string): ReturnType<SpawnForRepo> {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const proc = {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
      // exit イベントを次の tick で発火
      if (event === 'close') {
        setTimeout(() => cb(exitCode), 0);
      }
      return proc;
    }),
    stdout: {
      on: vi.fn(),
    },
    stderr: {
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === 'data' && stderrOutput) {
          setTimeout(() => cb(Buffer.from(stderrOutput)), 0);
        }
        return proc.stderr;
      }),
    },
  };

  return proc as unknown as ReturnType<SpawnForRepo>;
}
