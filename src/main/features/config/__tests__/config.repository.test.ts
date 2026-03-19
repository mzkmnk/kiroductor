import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { ConfigRepository } from '../config.repository';
import type { FileSystem } from '../../../shared/fs';

describe('ConfigRepository', () => {
  let tmpDir: string;
  let fsAdapter: FileSystem;
  let repo: ConfigRepository;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kiroductor-test-'));
    fsAdapter = {
      mkdir: (dirPath, opts) => fs.promises.mkdir(dirPath, opts),
      readFile: (filePath, encoding) => fs.promises.readFile(filePath, encoding),
      readFileBinary: (filePath) => fs.promises.readFile(filePath),
      writeFile: (filePath, content, encoding) =>
        fs.promises.writeFile(filePath, content, encoding),
      access: (filePath) => fs.promises.access(filePath),
      readdir: (dirPath) => fs.promises.readdir(dirPath),
    };
    repo = new ConfigRepository(fsAdapter, tmpDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getBaseDir()', () => {
    it('コンストラクタで指定したベースディレクトリを返す', () => {
      expect(repo.getBaseDir()).toBe(tmpDir);
    });
  });

  describe('ensureBaseDir()', () => {
    it('ベースディレクトリが存在しない場合、mkdir -p 相当で作成される', async () => {
      const newDir = path.join(tmpDir, 'nested', 'kiroductor');
      const newRepo = new ConfigRepository(fsAdapter, newDir);
      await newRepo.ensureBaseDir();
      const stat = await fs.promises.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
      const reposStat = await fs.promises.stat(path.join(newDir, 'repos'));
      expect(reposStat.isDirectory()).toBe(true);
    });

    it('既にディレクトリが存在する場合、エラーにならない', async () => {
      await repo.ensureBaseDir();
      await expect(repo.ensureBaseDir()).resolves.not.toThrow();
    });
  });

  describe('getReposRoot()', () => {
    it('baseDir + "/repos" のパスを返す', () => {
      expect(repo.getReposRoot()).toBe(path.join(tmpDir, 'repos'));
    });
  });

  describe('readSessions()', () => {
    it('ファイルが存在しない場合、空配列を返す', async () => {
      const sessions = await repo.readSessions();
      expect(sessions).toEqual([]);
    });

    it('ファイルが存在する場合、セッション一覧を返す', async () => {
      const mapping = {
        acpSessionId: 'session-1',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/worktree',
        title: 'My Session',
        currentBranch: 'kiroductor/tokyo',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      await fs.promises.writeFile(
        path.join(tmpDir, 'sessions.json'),
        JSON.stringify({ sessions: [mapping] }, null, 2),
        'utf-8',
      );
      const sessions = await repo.readSessions();
      expect(sessions).toEqual([mapping]);
    });
  });

  describe('writeSessions()', () => {
    it('sessions.json に JSON を整形して書き込む', async () => {
      const mapping = {
        acpSessionId: 'session-1',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/worktree',
        title: null,
        currentBranch: 'kiroductor/tokyo',
        sourceBranch: 'main',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.writeSessions([mapping]);
      const raw = await fs.promises.readFile(path.join(tmpDir, 'sessions.json'), 'utf-8');
      expect(JSON.parse(raw)).toEqual({ sessions: [mapping] });
    });
  });

  describe('upsertSession()', () => {
    it('存在しない acpSessionId の場合、新規追加される', async () => {
      const now = new Date('2026-03-15T00:00:00.000Z');
      vi.setSystemTime(now);

      const mapping = {
        acpSessionId: 'new-session',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/worktree',
        title: null,
        currentBranch: 'kiroductor/tokyo',
        sourceBranch: 'main',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.upsertSession(mapping);
      const sessions = await repo.readSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].acpSessionId).toBe('new-session');

      vi.useRealTimers();
    });

    it('同じ acpSessionId が存在する場合、更新される', async () => {
      const now = new Date('2026-03-15T00:00:00.000Z');
      vi.setSystemTime(now);

      const initial = {
        acpSessionId: 'session-1',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/worktree',
        title: null,
        currentBranch: 'kiroductor/tokyo',
        sourceBranch: 'main',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.upsertSession(initial);

      const later = new Date('2026-03-15T01:00:00.000Z');
      vi.setSystemTime(later);

      const updated = { ...initial, title: 'Updated Title' };
      await repo.upsertSession(updated);

      const sessions = await repo.readSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Updated Title');

      vi.useRealTimers();
    });

    it('updatedAt が現在時刻に更新される', async () => {
      const now = new Date('2026-03-15T00:00:00.000Z');
      vi.setSystemTime(now);

      const mapping = {
        acpSessionId: 'session-1',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/worktree',
        title: null,
        currentBranch: 'kiroductor/tokyo',
        sourceBranch: 'main',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      };
      await repo.upsertSession(mapping);

      const later = new Date('2026-03-15T12:00:00.000Z');
      vi.setSystemTime(later);

      await repo.upsertSession({ ...mapping, title: 'Updated' });

      const sessions = await repo.readSessions();
      expect(sessions[0].updatedAt).toBe('2026-03-15T12:00:00.000Z');

      vi.useRealTimers();
    });
  });

  describe('removeSession()', () => {
    it('指定した acpSessionId のセッションを削除する', async () => {
      const s1 = {
        acpSessionId: 'session-1',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/w1',
        title: null,
        currentBranch: 'kiroductor/tokyo',
        sourceBranch: 'main',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      const s2 = {
        acpSessionId: 'session-2',
        repoId: 'github.com/mzkmnk/kiroductor',
        cwd: '/tmp/w2',
        title: null,
        currentBranch: 'kiroductor/bourbon',
        sourceBranch: 'develop',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.writeSessions([s1, s2]);
      await repo.removeSession('session-1');
      const sessions = await repo.readSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].acpSessionId).toBe('session-2');
    });

    it('存在しない acpSessionId を指定してもエラーにならない', async () => {
      await expect(repo.removeSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('readRepos()', () => {
    it('ファイルが存在しない場合、空配列を返す', async () => {
      const repos = await repo.readRepos();
      expect(repos).toEqual([]);
    });

    it('ファイルが存在する場合、リポジトリ一覧を返す', async () => {
      const mapping = {
        repoId: 'abc123',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      await fs.promises.writeFile(
        path.join(tmpDir, 'repos.json'),
        JSON.stringify({ repos: [mapping] }, null, 2),
        'utf-8',
      );
      const repos = await repo.readRepos();
      expect(repos).toEqual([mapping]);
    });
  });

  describe('writeRepos()', () => {
    it('repos.json に JSON を整形して書き込む', async () => {
      const mapping = {
        repoId: 'abc123',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.writeRepos([mapping]);
      const raw = await fs.promises.readFile(path.join(tmpDir, 'repos.json'), 'utf-8');
      expect(JSON.parse(raw)).toEqual({ repos: [mapping] });
    });
  });

  describe('upsertRepo()', () => {
    it('存在しない repoId の場合、新規追加される', async () => {
      const mapping = {
        repoId: 'abc123',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.upsertRepo(mapping);
      const repos = await repo.readRepos();
      expect(repos).toHaveLength(1);
      expect(repos[0].repoId).toBe('abc123');
    });

    it('同じ repoId が存在する場合、更新される', async () => {
      const initial = {
        repoId: 'abc123',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.upsertRepo(initial);
      const updated = { ...initial, url: 'https://github.com/mzkmnk/kiroductor-v2.git' };
      await repo.upsertRepo(updated);
      const repos = await repo.readRepos();
      expect(repos).toHaveLength(1);
      expect(repos[0].url).toBe('https://github.com/mzkmnk/kiroductor-v2.git');
    });
  });

  describe('findRepoByPath()', () => {
    it('host/org/repo に一致するリポジトリを返す', async () => {
      const mapping = {
        repoId: 'abc123',
        url: 'https://github.com/mzkmnk/kiroductor.git',
        host: 'github.com',
        org: 'mzkmnk',
        name: 'kiroductor',
        clonedAt: '2026-03-15T00:00:00.000Z',
      };
      await repo.writeRepos([mapping]);
      const found = await repo.findRepoByPath('github.com', 'mzkmnk', 'kiroductor');
      expect(found).toEqual(mapping);
    });

    it('一致するリポジトリがない場合、undefined を返す', async () => {
      const found = await repo.findRepoByPath('github.com', 'mzkmnk', 'nonexistent');
      expect(found).toBeUndefined();
    });
  });
});
