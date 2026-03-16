import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import { RepoService, parseDiffShortstat, type SpawnFn } from '../repo.service';
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

    it('git worktree add -b が実行されること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/main\n');
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(symbolicRefProcess).mockReturnValueOnce(worktreeProcess);

      await service.createWorktree('test-repo-id');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        [
          'worktree',
          'add',
          '-b',
          expect.stringMatching(/^kiroductor\//),
          expect.any(String),
          'main',
        ],
        expect.objectContaining({
          cwd: expect.stringContaining('kiroductor.git'),
        }),
      );
    });

    it('branch を指定した場合その branch が sourceBranch として使用されること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.createWorktree('test-repo-id', 'feature/test');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        [
          'worktree',
          'add',
          '-b',
          expect.stringMatching(/^kiroductor\//),
          expect.any(String),
          'feature/test',
        ],
        expect.any(Object),
      );
      expect(result.sourceBranch).toBe('feature/test');
    });

    it('branch を省略した場合 git symbolic-ref HEAD でデフォルトブランチを解決すること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/develop\n');
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(symbolicRefProcess).mockReturnValueOnce(worktreeProcess);

      const result = await service.createWorktree('test-repo-id');

      expect(spawnMock).toHaveBeenNthCalledWith(
        1,
        'git',
        ['symbolic-ref', 'HEAD'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
      expect(result.sourceBranch).toBe('develop');
    });

    it('result.branch が kiroductor/ プレフィックス付きの新ブランチ名であること', async () => {
      const mockProcess = createMockProcess(0);
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.createWorktree('test-repo-id', 'feature/test');

      expect(result.branch).toMatch(/^kiroductor\//);
    });

    it('返されたパスが ~/.kiroductor/worktrees/{nanoid}/{repoName} 形式であること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/main\n');
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(symbolicRefProcess).mockReturnValueOnce(worktreeProcess);

      const result = await service.createWorktree('test-repo-id');

      expect(result.cwd).toMatch(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+\/kiroductor$/);
    });

    it('worktrees/{nanoid} ディレクトリが存在しなければ作成すること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/main\n');
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(symbolicRefProcess).mockReturnValueOnce(worktreeProcess);

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

    it('bare clone のブランチ一覧を返すこと', async () => {
      // fetch --all 用
      const fetchProcess = createMockProcess(0);
      // git branch 用（bare clone では * main のようにカレントブランチに * が付く）
      const branchProcess = createMockProcess(0, undefined, '* main\n  feature/test\n  develop\n');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['develop', 'feature/test', 'main']);
    });

    it('他の worktree でチェックアウト中のブランチ（+ マーカー）を正しく処理すること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(0, undefined, '+ feature-wt\n* main\n  develop\n');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['develop', 'feature-wt', 'main']);
    });

    it('結果がアルファベット順にソートされること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(0, undefined, '  zebra\n* alpha\n  middle\n');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['alpha', 'middle', 'zebra']);
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

    it('git fetch --all と git branch が bare repo パスで実行されること', async () => {
      const fetchProcess = createMockProcess(0);
      const branchProcess = createMockProcess(0, undefined, '* main\n');
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(branchProcess);

      await service.listBranches('test-repo-id');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['fetch', '--all'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['branch'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
    });
  });

  describe('getDiffStats(cwd, sourceBranch)', () => {
    it('git diff --shortstat の結果をパースして DiffStats を返すこと', async () => {
      const mockProcess = createMockProcess(
        0,
        undefined,
        ' 3 files changed, 111 insertions(+), 51 deletions(-)\n',
      );
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['diff', '--shortstat', 'main'],
        expect.objectContaining({ cwd: '/worktree/path' }),
      );
      expect(result).toEqual({ filesChanged: 3, insertions: 111, deletions: 51 });
    });

    it('git コマンドが失敗した場合 null を返すこと', async () => {
      const mockProcess = createMockProcess(1, 'fatal: bad revision');
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(result).toBeNull();
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

describe('parseDiffShortstat(stdout)', () => {
  it('標準的な出力をパースすること', () => {
    expect(parseDiffShortstat(' 3 files changed, 111 insertions(+), 51 deletions(-)\n')).toEqual({
      filesChanged: 3,
      insertions: 111,
      deletions: 51,
    });
  });

  it('insertions のみの場合 deletions が 0 であること', () => {
    expect(parseDiffShortstat(' 2 files changed, 10 insertions(+)\n')).toEqual({
      filesChanged: 2,
      insertions: 10,
      deletions: 0,
    });
  });

  it('deletions のみの場合 insertions が 0 であること', () => {
    expect(parseDiffShortstat(' 1 file changed, 5 deletions(-)\n')).toEqual({
      filesChanged: 1,
      insertions: 0,
      deletions: 5,
    });
  });

  it('空文字列の場合すべて 0 を返すこと', () => {
    expect(parseDiffShortstat('')).toEqual({
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    });
  });

  it('singular "1 file changed" を正しくパースすること', () => {
    expect(parseDiffShortstat(' 1 file changed, 1 insertion(+), 1 deletion(-)\n')).toEqual({
      filesChanged: 1,
      insertions: 1,
      deletions: 1,
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
