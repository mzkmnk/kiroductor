import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import { RepoService, parseDiffShortstat, buildNewFileDiff, type SpawnFn } from '../repo.service';
import { ConfigRepository } from '../../config/config.repository';
import type { RepoMapping, SessionMapping } from '../../config/config.repository';
import type { FileSystem } from '../../../shared/fs';

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
      stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
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
      const cloneProcess = createMockProcess(0);
      const configProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(cloneProcess).mockReturnValueOnce(configProcess);

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

    it('bare clone 後に fetch refspec が設定されること', async () => {
      const cloneProcess = createMockProcess(0);
      const configProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(cloneProcess).mockReturnValueOnce(configProcess);

      await service.clone('https://github.com/mzkmnk/kiroductor.git');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['config', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
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
      const cloneProcess = createMockProcess(0);
      const configProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(cloneProcess).mockReturnValueOnce(configProcess);

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
      const cloneProcess = createMockProcess(0);
      const configProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(cloneProcess).mockReturnValueOnce(configProcess);

      const result = await service.clone('https://github.com/mzkmnk/kiroductor.git');

      // nanoid は 21 文字のデフォルト長
      expect(result).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('clone 後に repos.json にエントリが書き込まれること', async () => {
      const cloneProcess = createMockProcess(0);
      const configProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(cloneProcess).mockReturnValueOnce(configProcess);

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
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock
        .mockReturnValueOnce(symbolicRefProcess)
        .mockReturnValueOnce(fetchProcess)
        .mockReturnValueOnce(worktreeProcess);

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
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(worktreeProcess);

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
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock
        .mockReturnValueOnce(symbolicRefProcess)
        .mockReturnValueOnce(fetchProcess)
        .mockReturnValueOnce(worktreeProcess);

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
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock.mockReturnValueOnce(fetchProcess).mockReturnValueOnce(worktreeProcess);

      const result = await service.createWorktree('test-repo-id', 'feature/test');

      expect(result.branch).toMatch(/^kiroductor\//);
    });

    it('返されたパスが ~/.kiroductor/worktrees/{nanoid}/{repoName} 形式であること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/main\n');
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock
        .mockReturnValueOnce(symbolicRefProcess)
        .mockReturnValueOnce(fetchProcess)
        .mockReturnValueOnce(worktreeProcess);

      const result = await service.createWorktree('test-repo-id');

      expect(result.cwd).toMatch(/\.kiroductor\/worktrees\/[A-Za-z0-9_-]+\/kiroductor$/);
    });

    it('worktrees/{nanoid} ディレクトリが存在しなければ作成すること', async () => {
      const symbolicRefProcess = createMockProcess(0, undefined, 'refs/heads/main\n');
      const fetchProcess = createMockProcess(0);
      const worktreeProcess = createMockProcess(0);
      spawnMock
        .mockReturnValueOnce(symbolicRefProcess)
        .mockReturnValueOnce(fetchProcess)
        .mockReturnValueOnce(worktreeProcess);

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
      // git ls-remote --heads origin 用
      const lsRemoteProcess = createMockProcess(
        0,
        undefined,
        'abc123\trefs/heads/main\ndef456\trefs/heads/feature/test\nghi789\trefs/heads/develop\n',
      );
      spawnMock.mockReturnValueOnce(lsRemoteProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['develop', 'feature/test', 'main']);
    });

    it('ls-remote の出力からブランチ名を正しくパースすること', async () => {
      const lsRemoteProcess = createMockProcess(
        0,
        undefined,
        'abc123\trefs/heads/feature-wt\ndef456\trefs/heads/main\nghi789\trefs/heads/develop\n',
      );
      spawnMock.mockReturnValueOnce(lsRemoteProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['develop', 'feature-wt', 'main']);
    });

    it('結果がアルファベット順にソートされること', async () => {
      const lsRemoteProcess = createMockProcess(
        0,
        undefined,
        'abc123\trefs/heads/zebra\ndef456\trefs/heads/alpha\nghi789\trefs/heads/middle\n',
      );
      spawnMock.mockReturnValueOnce(lsRemoteProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('存在しない repoId の場合エラーを投げること', async () => {
      await expect(service.listBranches('nonexistent-id')).rejects.toThrow(
        'Repository not found: nonexistent-id',
      );
    });

    it('ブランチが無い場合は空配列を返すこと', async () => {
      const lsRemoteProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(lsRemoteProcess);

      const result = await service.listBranches('test-repo-id');

      expect(result).toEqual([]);
    });

    it('git ls-remote --heads origin が bare repo パスで実行されること', async () => {
      const lsRemoteProcess = createMockProcess(0, undefined, 'abc123\trefs/heads/main\n');
      spawnMock.mockReturnValueOnce(lsRemoteProcess);

      await service.listBranches('test-repo-id');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['ls-remote', '--heads', 'origin'],
        expect.objectContaining({ cwd: expect.stringContaining('kiroductor.git') }),
      );
    });
  });

  describe('getDiffStats(cwd, sourceBranch)', () => {
    it('tracked な変更のみの場合 git diff --shortstat の結果を返すこと', async () => {
      const diffProcess = createMockProcess(
        0,
        undefined,
        ' 3 files changed, 111 insertions(+), 51 deletions(-)\n',
      );
      const lsFilesProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['diff', '--shortstat', 'main'],
        expect.objectContaining({ cwd: '/worktree/path' }),
      );
      expect(result).toEqual({ filesChanged: 3, insertions: 111, deletions: 51 });
    });

    it('untracked ファイルの行数が insertions に加算されること', async () => {
      const diffProcess = createMockProcess(0, undefined, '');
      const lsFilesProcess = createMockProcess(0, undefined, 'newfile.md\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('line1\nline2\nline3');

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(result).toEqual({ filesChanged: 1, insertions: 3, deletions: 0 });
    });

    it('tracked と untracked の両方がある場合に合算されること', async () => {
      const diffProcess = createMockProcess(
        0,
        undefined,
        ' 2 files changed, 10 insertions(+), 5 deletions(-)\n',
      );
      const lsFilesProcess = createMockProcess(0, undefined, 'a.txt\nb.txt\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('line1\nline2')
        .mockResolvedValueOnce('single');

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(result).toEqual({ filesChanged: 4, insertions: 13, deletions: 5 });
    });

    it('バイナリファイル（readFile 失敗）はスキップされること', async () => {
      const diffProcess = createMockProcess(0, undefined, '');
      const lsFilesProcess = createMockProcess(0, undefined, 'image.png\ntext.txt\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('binary'))
        .mockResolvedValueOnce('hello\nworld');

      const result = await service.getDiffStats('/worktree/path', 'main');

      // image.png はスキップされるが filesChanged にはカウントされる
      expect(result).toEqual({ filesChanged: 2, insertions: 2, deletions: 0 });
    });

    it('git diff コマンドが失敗した場合 null を返すこと', async () => {
      const mockProcess = createMockProcess(1, 'fatal: bad revision');
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.getDiffStats('/worktree/path', 'main');

      expect(result).toBeNull();
    });
  });

  describe('getDiff(cwd, sourceBranch)', () => {
    it('tracked な変更のみの場合 git diff の結果を返すこと', async () => {
      const diffOutput =
        'diff --git a/src/main.ts b/src/main.ts\n--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,3 +1,4 @@\n import { app } from "electron";\n+import { something } from "somewhere";';
      const diffProcess = createMockProcess(0, undefined, diffOutput);
      const lsFilesProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);

      const result = await service.getDiff('/worktree/path', 'main');

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['diff', 'main'],
        expect.objectContaining({ cwd: '/worktree/path' }),
      );
      expect(result).toBe(diffOutput);
    });

    it('untracked ファイルの diff が含まれること', async () => {
      const diffProcess = createMockProcess(0, undefined, '');
      const lsFilesProcess = createMockProcess(0, undefined, 'newfile.ts\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        'const x = 1;\nexport { x };',
      );

      const result = await service.getDiff('/worktree/path', 'main');

      expect(result).toContain('diff --git a/newfile.ts b/newfile.ts');
      expect(result).toContain('--- /dev/null');
      expect(result).toContain('+++ b/newfile.ts');
      expect(result).toContain('+const x = 1;');
    });

    it('tracked と untracked の両方の diff が結合されること', async () => {
      const trackedDiff =
        'diff --git a/src/main.ts b/src/main.ts\n--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,3 +1,4 @@\n line1\n+line2';
      const diffProcess = createMockProcess(0, undefined, trackedDiff);
      const lsFilesProcess = createMockProcess(0, undefined, 'new.ts\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('hello');

      const result = await service.getDiff('/worktree/path', 'main');

      expect(result).toContain('diff --git a/src/main.ts b/src/main.ts');
      expect(result).toContain('diff --git a/new.ts b/new.ts');
    });

    it('差分がない場合（tracked も untracked もなし）は null を返すこと', async () => {
      const diffProcess = createMockProcess(0, undefined, '');
      const lsFilesProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);

      const result = await service.getDiff('/worktree/path', 'main');

      expect(result).toBeNull();
    });

    it('git コマンドが失敗した場合 null を返すこと', async () => {
      const mockProcess = createMockProcess(1, 'fatal: bad revision');
      spawnMock.mockReturnValue(mockProcess);

      const result = await service.getDiff('/worktree/path', 'main');

      expect(result).toBeNull();
    });

    it('バイナリの untracked ファイルはスキップされること', async () => {
      const diffProcess = createMockProcess(0, undefined, '');
      const lsFilesProcess = createMockProcess(0, undefined, 'image.png\ntext.ts\n');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);
      (fs.readFile as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('binary'))
        .mockResolvedValueOnce('hello');

      const result = await service.getDiff('/worktree/path', 'main');

      expect(result).not.toContain('image.png');
      expect(result).toContain('diff --git a/text.ts b/text.ts');
    });
  });

  describe('getDiffStatsBySession(sessionId)', () => {
    const SESSION: SessionMapping = {
      acpSessionId: 'session-1',
      repoId: 'repo-1',
      cwd: '/worktree/path',
      title: 'Test',
      currentBranch: 'kiroductor/test',
      sourceBranch: 'main',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('セッションが見つかった場合、getDiffStats() に委譲する', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ sessions: [SESSION] }),
      );
      const diffProcess = createMockProcess(0, undefined, ' 2 files changed, 10 insertions(+)\n');
      const lsFilesProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);

      const result = await service.getDiffStatsBySession('session-1');

      expect(result).toEqual({ filesChanged: 2, insertions: 10, deletions: 0 });
    });

    it('セッションが見つからない場合、null を返す', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ sessions: [] }));

      const result = await service.getDiffStatsBySession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDiffBySession(sessionId)', () => {
    const SESSION: SessionMapping = {
      acpSessionId: 'session-1',
      repoId: 'repo-1',
      cwd: '/worktree/path',
      title: 'Test',
      currentBranch: 'kiroductor/test',
      sourceBranch: 'main',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('セッションが見つかった場合、getDiff() に委譲する', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ sessions: [SESSION] }),
      );
      const trackedDiff = 'diff --git a/file.ts b/file.ts\n+new line';
      const diffProcess = createMockProcess(0, undefined, trackedDiff);
      const lsFilesProcess = createMockProcess(0, undefined, '');
      spawnMock.mockReturnValueOnce(diffProcess).mockReturnValueOnce(lsFilesProcess);

      const result = await service.getDiffBySession('session-1');

      expect(result).toContain('diff --git a/file.ts b/file.ts');
    });

    it('セッションが見つからない場合、null を返す', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ sessions: [] }));

      const result = await service.getDiffBySession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listFiles(cwd, dirPath, depth)', () => {
    const CWD = '/worktree/project';

    it('ディレクトリ配下のファイルとフォルダを返すこと', async () => {
      (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['src', 'README.md']);
      (fs.stat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });

      const result = await service.listFiles(CWD, '');

      expect(result).toEqual([
        { name: 'src', path: 'src', isDirectory: true },
        { name: 'README.md', path: 'README.md', isDirectory: false },
      ]);
    });

    it('.git と node_modules を除外すること', async () => {
      (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        '.git',
        'node_modules',
        'src',
        'index.ts',
      ]);
      (fs.stat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });

      const result = await service.listFiles(CWD, '');

      const names = result.map((e) => e.name);
      expect(names).not.toContain('.git');
      expect(names).not.toContain('node_modules');
      expect(names).toContain('src');
      expect(names).toContain('index.ts');
    });

    it('ディレクトリ優先・名前順でソートされること', async () => {
      (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        'z-file.ts',
        'a-dir',
        'b-file.ts',
        'a-file.ts',
      ]);
      (fs.stat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isDirectory: () => false })
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false })
        .mockResolvedValueOnce({ isDirectory: () => false });

      const result = await service.listFiles(CWD, '');

      expect(result.map((e) => e.name)).toEqual(['a-dir', 'a-file.ts', 'b-file.ts', 'z-file.ts']);
    });

    it('パストラバーサルを防止すること', async () => {
      await expect(service.listFiles(CWD, '../../etc')).rejects.toThrow();
    });

    it('depth=2 でサブディレクトリの中身も返すこと', async () => {
      // ルートの readdir
      (fs.readdir as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(['src'])
        // src の readdir
        .mockResolvedValueOnce(['index.ts']);
      (fs.stat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });

      const result = await service.listFiles(CWD, '', 2);

      expect(result).toEqual([
        { name: 'src', path: 'src', isDirectory: true },
        { name: 'index.ts', path: 'src/index.ts', isDirectory: false },
      ]);
    });

    it('存在しないディレクトリは空配列を返すこと', async () => {
      (fs.readdir as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.listFiles(CWD, 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('listFilesBySession(sessionId, dirPath)', () => {
    const SESSION: SessionMapping = {
      acpSessionId: 'session-1',
      repoId: 'repo-1',
      cwd: '/worktree/project',
      title: 'Test',
      currentBranch: 'kiroductor/test',
      sourceBranch: 'main',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('セッションが見つかった場合、listFiles() に委譲する', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ sessions: [SESSION] }),
      );
      (fs.readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['file.ts']);
      (fs.stat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isDirectory: () => false });

      const result = await service.listFilesBySession('session-1', '');

      expect(result).toEqual([{ name: 'file.ts', path: 'file.ts', isDirectory: false }]);
    });

    it('セッションが見つからない場合、空配列を返す', async () => {
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ sessions: [] }));

      const result = await service.listFilesBySession('nonexistent', '');

      expect(result).toEqual([]);
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

describe('buildNewFileDiff(filePath, content)', () => {
  it('新規ファイルの unified diff を生成すること', () => {
    const result = buildNewFileDiff('src/new.ts', 'const x = 1;\nexport { x };');

    expect(result).toContain('diff --git a/src/new.ts b/src/new.ts');
    expect(result).toContain('new file mode 100644');
    expect(result).toContain('--- /dev/null');
    expect(result).toContain('+++ b/src/new.ts');
    expect(result).toContain('@@ -0,0 +1,2 @@');
    expect(result).toContain('+const x = 1;');
    expect(result).toContain('+export { x };');
  });

  it('単一行ファイルのハンクヘッダーが正しいこと', () => {
    const result = buildNewFileDiff('readme.md', 'hello');

    expect(result).toContain('@@ -0,0 +1,1 @@');
    expect(result).toContain('+hello');
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
