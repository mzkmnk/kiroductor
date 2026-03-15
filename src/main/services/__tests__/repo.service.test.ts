import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import { RepoService, type SpawnFn } from '../repo.service';
import { ConfigRepository } from '../../repositories/config.repository';
import type { RepoMapping } from '../../repositories/config.repository';
import type { FileSystem } from '../../fs';

describe('RepoService', () => {
  let configRepo: ConfigRepository;
  let spawnMock: ReturnType<typeof vi.fn>;
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
    spawnMock = vi.fn();
    service = new RepoService(configRepo, fs, spawnMock as unknown as SpawnFn);
  });

  describe('parseRepoUrl(url)', () => {
    it('HTTPS URL（.git 付き）をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('https://github.com/mzkmnk/kiroductor.git');
      expect(result).toEqual({ host: 'github.com', org: 'mzkmnk', name: 'kiroductor' });
    });

    it('SSH URL をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('git@github.com:mzkmnk/kiroductor.git');
      expect(result).toEqual({ host: 'github.com', org: 'mzkmnk', name: 'kiroductor' });
    });

    it('HTTPS URL（.git なし）をパースして { host, org, repo } を返すこと', () => {
      const result = service.parseRepoUrl('https://gitlab.com/user/project');
      expect(result).toEqual({ host: 'gitlab.com', org: 'user', name: 'project' });
    });

    it('不正な URL の場合エラーを投げること', () => {
      expect(() => service.parseRepoUrl('invalid-url')).toThrow();
    });
  });

  describe('getRepoPath(parsed)', () => {
    it('パース結果から bare clone のパスを返すこと', () => {
      const result = service.getRepoPath({
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
      });
      expect(result).toBe('/home/test/.kiroductor/repos/github.com/mzkmnk/kiroductor.git');
    });
  });

  describe('clone(url)', () => {
    it('未クローンの場合 git clone --bare が実行されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(spawnMock).toHaveBeenCalledWith(
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
      // repos.json に既存エントリを設定
      const existing: RepoMapping = {
        repoId: 'existing-id',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      (fs.access as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) => {
        if (p.endsWith('repos.json')) return;
        throw new Error('ENOENT');
      });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ repos: [existing] }),
      );
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const repoId = await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(repoId).toBe('existing-id');
      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['fetch', '--all'],
        expect.objectContaining({
          cwd: expect.stringContaining('kiroductor.git'),
        }),
      );
    });

    it('クローン先ディレクトリの親が存在しなければ作成すること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('github.com/mzkmnk'), {
        recursive: true,
      });
    });

    it('git コマンドが失敗した場合エラーを投げること', async () => {
      const mockProcess = createMockProcess(1, 'clone failed');
      spawnMock.mockReturnValue(mockProcess);

      await expect(service.clone('https://github.com/mzkmnk/kiroductor.git')).rejects.toThrow(
        'clone failed',
      );
    });

    it('clone が成功した場合 nanoid の repoId を返すこと', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.clone('https://github.com/mzkmnk/kiroductor.git');

      // nanoid は 21 文字のデフォルト長
      expect(result).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('clone 後に repos.json にエントリが書き込まれること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const repoId = await service.clone('https://github.com/mzkmnk/kiroductor.git');

      // writeFile が repos.json に呼ばれたことを検証
      const writeFileMock = fs.writeFile as ReturnType<typeof vi.fn>;
      const reposJsonCall = writeFileMock.mock.calls.find((call: unknown[]) =>
        (call[0] as string).endsWith('repos.json'),
      );
      expect(reposJsonCall).toBeDefined();
      const written = JSON.parse(reposJsonCall![1] as string) as { repos: RepoMapping[] };
      expect(written.repos).toHaveLength(1);
      expect(written.repos[0].repoId).toBe(repoId);
      expect(written.repos[0].host).toBe('github.com');
      expect(written.repos[0].org).toBe('mzkmnk');
      expect(written.repos[0].name).toBe('kiroductor');
    });
  });

  describe('createWorktree(repoId, branch?)', () => {
    const repoMapping: RepoMapping = {
      repoId: 'test-repo-id',
      url: 'https://github.com/mzkmnk/kiroductor.git',
      host: 'github.com',
      org: 'mzkmnk',
      name: 'kiroductor',
      clonedAt: '2026-03-15T00:00:00.000Z',
    };

    beforeEach(() => {
      // repos.json に既存エントリを設定
      (fs.access as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) => {
        if (p.endsWith('repos.json')) return;
        throw new Error('ENOENT');
      });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ repos: [repoMapping] }),
      );
    });

    it('git worktree add が実行されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      await service.createWorktree('test-repo-id');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', expect.any(String), expect.any(String)],
        expect.objectContaining({
          cwd: expect.stringContaining('kiroductor.git'),
        }),
      );
    });

    it('branch を指定した場合その branch が使用されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      await service.createWorktree('test-repo-id', 'feature/test');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', expect.any(String), 'feature/test'],
        expect.any(Object),
      );
    });

    it('返されたパスが ~/.kiroductor/worktrees/{nanoid}/{repoName} 形式であること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.createWorktree('test-repo-id');

      expect(result.cwd).toMatch(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+\/kiroductor$/);
    });

    it('worktrees/{nanoid} ディレクトリが存在しなければ作成すること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      await service.createWorktree('test-repo-id');

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+$/),
        { recursive: true },
      );
    });

    it('存在しない repoId の場合エラーを投げること', async () => {
      await expect(service.createWorktree('nonexistent-id')).rejects.toThrow(
        'Repository not found: nonexistent-id',
      );
    });
  });

  describe('listBranches(repoId)', () => {
    const repoMapping: RepoMapping = {
      repoId: 'test-repo-id',
      url: 'https://github.com/mzkmnk/kiroductor.git',
      host: 'github.com',
      org: 'mzkmnk',
      name: 'kiroductor',
      clonedAt: '2026-03-15T00:00:00.000Z',
    };

    beforeEach(() => {
      (fs.access as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) => {
        if (p.endsWith('repos.json')) return;
        throw new Error('ENOENT');
      });
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ repos: [repoMapping] }),
      );
    });

    it('origin/ プレフィックス付きでリモートブランチ一覧を返すこと', async () => {
      // fetch --all 用
      const fetchProcess = createMockProcess(0);
      // branch -r 用
      const branchProcess = createMockProcess(
        0,
        undefined,
        '  origin/main\n  origin/feature/test\n  origin/develop\n',
      );
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['origin/develop', 'origin/feature/test', 'origin/main']);
    });

    it('HEAD -> origin/main のようなポインタ行は除外すること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(
        0,
        undefined,
        '  origin/HEAD -> origin/main\n  origin/main\n  origin/develop\n',
      );
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['origin/develop', 'origin/main']);
    });

    it('結果がアルファベット順にソートされること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(
        0,
        undefined,
        '  origin/zebra\n  origin/alpha\n  origin/middle\n',
      );
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['origin/alpha', 'origin/middle', 'origin/zebra']);
    });

    it('存在しない repoId の場合エラーを投げること', async () => {
      await expect(service.listBranches('nonexistent-id')).rejects.toThrow(
        'Repository not found: nonexistent-id',
      );
    });

    it('ブランチが無い場合は空配列を返すこと', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual([]);
    });

    it('git fetch --all と git branch -r が bare repo パスで実行されること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(0, undefined, '  origin/main\n');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      await service.listBranches('test-repo-id');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['fetch', '--all'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['branch', '-r'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
    });
  });

  describe('listClonedRepos()', () => {
    it('repos.json からリポジトリ一覧を返すこと', async () => {
      const repos: RepoMapping[] = [
        {
          repoId: 'abc123',
          url: 'https://github.com/mzkmnk/kiroductor.git',
          host: 'github.com',
          org: 'mzkmnk',
          name: 'kiroductor',
          clonedAt: '2026-03-15T00:00:00.000Z',
        },
      ];
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ repos }));

      const result = await service.listClonedRepos();

      expect(result).toEqual(repos);
    });
  });
});

/** テスト用のモックプロセスを作成する。 */
function createMockProcess(
  exitCode: number,
  stderrOutput?: string,
  stdoutOutput?: string,
): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stderr = new EventEmitter() as ChildProcess['stderr'];
  proc.stdout = new EventEmitter() as ChildProcess['stdout'];

  setTimeout(() => {
    if (stdoutOutput) {
      proc.stdout!.emit('data', Buffer.from(stdoutOutput));
    }
    if (stderrOutput) {
      proc.stderr!.emit('data', Buffer.from(stderrOutput));
    }
    proc.emit('close', exitCode);
  }, 0);

  return proc;
}
