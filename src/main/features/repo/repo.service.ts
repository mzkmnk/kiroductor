import path from 'path';
import type { spawn } from 'child_process';
import { nanoid } from 'nanoid';
import { createDebugLogger } from '../../shared/debug-logger';
import type { ConfigRepository } from '../config/config.repository';
import type { RepoMapping } from '../config/config.repository';
import type { FileSystem } from '../../shared/fs';
import { generateSessionTitle } from '../session/session-title.generator';
import type { DiffStats, FileEntry } from '../../../shared/ipc';

const log = createDebugLogger('Repo');

/** ファイル一覧から除外するディレクトリ名。 */
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', '.cache', '.turbo']);

/** パースされたリポジトリ URL の構成要素。 */
export interface ParsedRepoUrl {
  /** ホスト名（例: "github.com"） */
  host: string;
  /** 組織またはユーザー名（例: "mzkmnk"） */
  org: string;
  /** リポジトリ名（例: "kiroductor"） */
  name: string;
}

/** `child_process.spawn` と互換性のある型。テスト用に注入可能。 */
export type SpawnFn = typeof spawn;

/**
 * Bare リポジトリのクローンと worktree の管理を行うサービス。
 *
 * `~/.kiroductor/repos/` 配下にホスト/組織/リポジトリ名でディレクトリを構造化し、
 * bare clone を格納する。worktree は `~/.kiroductor/worktrees/` 配下に作成する。
 * クローン済みリポジトリの情報は `repos.json` に永続化する。
 */
export class RepoService {
  /**
   * @param configRepo - 設定ファイルとディレクトリ情報を提供する {@link ConfigRepository}
   * @param fs - ファイルシステム操作のアダプター
   * @param spawnFn - 子プロセスを起動する関数（テスト時にモック差し替え可能）
   */
  constructor(
    private readonly configRepo: Pick<
      ConfigRepository,
      'getBaseDir' | 'getReposRoot' | 'readRepos' | 'upsertRepo' | 'findRepoByPath' | 'readSessions'
    >,
    private readonly fs: FileSystem,
    private readonly spawnFn: SpawnFn,
  ) {}

  /**
   * リポジトリ URL をパースして構成要素を返す。
   *
   * HTTPS 形式（`https://github.com/org/repo.git`）と
   * SSH 形式（`git@github.com:org/repo.git`）の両方に対応する。
   *
   * @param url - リポジトリの URL
   * @returns パースされた {@link ParsedRepoUrl}
   * @throws URL のフォーマットが不正な場合
   */
  parseRepoUrl(url: string): ParsedRepoUrl {
    // SSH 形式: git@github.com:org/repo.git
    const sshMatch = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return { host: sshMatch[1], org: sshMatch[2], name: sshMatch[3] };
    }

    // HTTPS 形式: https://github.com/org/repo.git
    const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { host: httpsMatch[1], org: httpsMatch[2], name: httpsMatch[3] };
    }

    throw new Error(`Unsupported repository URL format: ${url}`);
  }

  /**
   * リポジトリの bare clone パスを返す。
   *
   * @param parsed - パース済みのリポジトリ URL 構成要素
   * @returns bare clone ディレクトリの絶対パス
   */
  getRepoPath(parsed: ParsedRepoUrl): string {
    return path.join(this.configRepo.getReposRoot(), parsed.host, parsed.org, `${parsed.name}.git`);
  }

  /**
   * リポジトリを bare clone する。
   *
   * 既にクローン済みの場合は `git fetch --all` で最新に更新し、既存の repoId を返す。
   * クローン先ディレクトリの親が存在しなければ再帰的に作成する。
   * クローン情報は `repos.json` に永続化する。
   *
   * @param url - クローンするリポジトリの URL
   * @returns リポジトリの識別子（nanoid）
   * @throws git コマンドが失敗した場合
   */
  async clone(url: string): Promise<string> {
    const parsed = this.parseRepoUrl(url);
    const repoPath = this.getRepoPath(parsed);

    // 既にクローン済みか repos.json で確認
    const existing = await this.configRepo.findRepoByPath(parsed.host, parsed.org, parsed.name);

    if (existing) {
      log.info(`既にクローン済み: ${existing.repoId} → fetch --all`);
      try {
        await this.execGit(['fetch', '--all'], repoPath);
      } catch (err) {
        log.warn('fetch --all failed (worktree branch conflict), continuing: %s', err);
      }
      return existing.repoId;
    }

    const parentDir = path.dirname(repoPath);
    await this.fs.mkdir(parentDir, { recursive: true });

    log.info(`bare clone: ${url} → ${repoPath}`);
    await this.execGit(['clone', '--bare', url, repoPath]);
    await this.execGit(['config', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*'], repoPath);

    const repoId = nanoid();
    const mapping: RepoMapping = {
      repoId,
      url,
      host: parsed.host,
      org: parsed.org,
      name: parsed.name,
      clonedAt: new Date().toISOString(),
    };
    await this.configRepo.upsertRepo(mapping);

    return repoId;
  }

  /**
   * bare repo から worktree を作成し、パスと使用ブランチ名を返す。
   *
   * worktree は `~/.kiroductor/worktrees/{nanoid}/{repoName}` に作成する。
   * branch を省略した場合は `git symbolic-ref HEAD` でデフォルトブランチを解決する。
   *
   * @param repoId - リポジトリの識別子（nanoid）
   * @param branch - ベースブランチ名（省略時はデフォルトブランチ）
   * @returns `{ cwd, branch, sourceBranch }` — worktree のパス、新規作業ブランチ名、ベースブランチ名
   * @throws リポジトリが見つからない場合、または git コマンドが失敗した場合
   */
  async createWorktree(
    repoId: string,
    branch?: string,
  ): Promise<{ cwd: string; branch: string; sourceBranch: string }> {
    const repos = await this.configRepo.readRepos();
    const repo = repos.find((r) => r.repoId === repoId);
    if (!repo) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    const repoPath = this.getRepoPath(repo);
    const sourceBranch = branch ?? (await this.resolveDefaultBranch(repoPath));
    const newBranch = `kiroductor/${generateSessionTitle().toLowerCase().replace(/\s+/g, '-')}`;

    const id = nanoid();
    const worktreeDir = path.join(this.configRepo.getBaseDir(), 'worktrees', id);
    await this.fs.mkdir(worktreeDir, { recursive: true });
    const worktreePath = path.join(worktreeDir, repo.name);

    // sourceBranch の最新をリモートから取得（worktree チェックアウト中なら無視して続行）
    try {
      await this.execGit(['fetch', 'origin', `${sourceBranch}:${sourceBranch}`], repoPath);
    } catch (err) {
      log.warn(
        `fetch origin ${sourceBranch} failed (may be checked out in a worktree), continuing: %s`,
        err,
      );
    }

    log.info(`worktree add: ${worktreePath} (branch: ${newBranch}, source: ${sourceBranch})`);
    await this.execGit(['worktree', 'add', '-b', newBranch, worktreePath, sourceBranch], repoPath);

    return { cwd: worktreePath, branch: newBranch, sourceBranch };
  }

  /**
   * bare repo のデフォルトブランチ名を解決する。
   *
   * `git symbolic-ref HEAD` の出力（例: `refs/heads/main`）から
   * `refs/heads/` プレフィックスを除去してブランチ名を返す。
   *
   * @param repoPath - bare repo のパス
   * @returns デフォルトブランチ名
   */
  private async resolveDefaultBranch(repoPath: string): Promise<string> {
    const ref = await this.execGit(['symbolic-ref', 'HEAD'], repoPath);
    return ref.trim().replace(/^refs\/heads\//, '');
  }

  /**
   * クローン済みリポジトリの一覧を返す。
   *
   * `repos.json` から読み込む。
   *
   * @returns {@link RepoMapping} の配列
   */
  async listClonedRepos(): Promise<RepoMapping[]> {
    return this.configRepo.readRepos();
  }

  /**
   * 指定リポジトリのブランチ一覧を返す。
   *
   * `git ls-remote --heads origin` でリモートのブランチ一覧を直接取得する。
   * ローカル refs を更新しないため、worktree でチェックアウト中のブランチとの
   * 競合（`refusing to fetch into branch`）が発生しない。
   *
   * @param repoId - リポジトリの識別子
   * @returns ブランチ名の配列（アルファベット順）
   * @throws リポジトリが見つからない場合
   */
  async listBranches(repoId: string): Promise<string[]> {
    const repos = await this.configRepo.readRepos();
    const repo = repos.find((r) => r.repoId === repoId);
    if (!repo) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    const repoPath = this.getRepoPath(repo);

    log.info('listBranches: ls-remote for repoId=%s, repoPath=%s', repoId, repoPath);
    const stdout = await this.execGit(['ls-remote', '--heads', 'origin'], repoPath);
    log.info('listBranches: raw stdout=%s', JSON.stringify(stdout));

    const branches = stdout
      .split('\n')
      .map((line) => line.replace(/^.*refs\/heads\//, '').trim())
      .filter((line) => line.length > 0)
      .sort();

    log.info('listBranches: parsed branches=%o', branches);
    return branches;
  }

  /**
   * ワーキングツリーの差分統計を取得する。
   *
   * `git diff --shortstat sourceBranch` を実行し、結果をパースして返す。
   * ワーキングツリーの未コミット変更も含めた差分を返す。
   * git コマンドが失敗した場合は `null` を返す。
   *
   * @param cwd - worktree のパス
   * @param sourceBranch - ベースブランチ名
   * @returns {@link DiffStats} または `null`
   */
  async getDiffStats(cwd: string, sourceBranch: string): Promise<DiffStats | null> {
    log.info(`getDiffStats: cwd=${cwd}, sourceBranch=${sourceBranch}`);
    try {
      const stdout = await this.execGit(['diff', '--shortstat', sourceBranch], cwd);
      const stats = parseDiffShortstat(stdout);
      log.info(`getDiffStats: stdout=${JSON.stringify(stdout)}, parsed=`, stats);

      // untracked ファイルも集計対象に含める
      const untrackedStdout = await this.execGit(
        ['ls-files', '--others', '--exclude-standard'],
        cwd,
      );
      const untrackedFiles = untrackedStdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);

      let untrackedInsertions = 0;
      for (const file of untrackedFiles) {
        try {
          const content = await this.fs.readFile(path.join(cwd, file), 'utf-8');
          untrackedInsertions += content.split('\n').length;
        } catch {
          // バイナリファイル等はスキップ
        }
      }

      const result: DiffStats = {
        filesChanged: stats.filesChanged + untrackedFiles.length,
        insertions: stats.insertions + untrackedInsertions,
        deletions: stats.deletions,
      };
      log.info(`getDiffStats: untracked=${untrackedFiles.length}, final=`, result);
      return result;
    } catch (err) {
      log.error(`getDiffStats: failed cwd=${cwd}, sourceBranch=${sourceBranch}, error=`, err);
      return null;
    }
  }

  /**
   * ワーキングツリーの差分本文（unified diff）を取得する。
   *
   * `git diff sourceBranch` を実行し、tracked ファイルの差分を取得する。
   * さらに untracked ファイルについても unified diff 形式で差分を生成し結合する。
   * 差分がない場合や git コマンドが失敗した場合は `null` を返す。
   *
   * @param cwd - worktree のパス
   * @param sourceBranch - ベースブランチ名
   * @returns unified diff 文字列または `null`
   */
  async getDiff(cwd: string, sourceBranch: string): Promise<string | null> {
    try {
      const trackedDiff = await this.execGit(['diff', sourceBranch], cwd);

      // untracked ファイルの差分を生成
      const untrackedStdout = await this.execGit(
        ['ls-files', '--others', '--exclude-standard'],
        cwd,
      );
      const untrackedFiles = untrackedStdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);

      let untrackedDiff = '';
      for (const file of untrackedFiles) {
        try {
          const content = await this.fs.readFile(path.join(cwd, file), 'utf-8');
          untrackedDiff += buildNewFileDiff(file, content);
        } catch {
          // バイナリファイル等はスキップ
        }
      }

      const combined = (trackedDiff + untrackedDiff).trimEnd();
      return combined || null;
    } catch {
      return null;
    }
  }

  /**
   * セッション ID から作業ディレクトリとベースブランチを解決し、diff 統計情報を返す。
   *
   * セッションが見つからない場合は `null` を返す。
   *
   * @param sessionId - 対象セッション ID
   * @returns {@link DiffStats} または `null`
   */
  async getDiffStatsBySession(sessionId: string): Promise<DiffStats | null> {
    const sessions = await this.configRepo.readSessions();
    const session = sessions.find((s) => s.acpSessionId === sessionId);
    if (!session) return null;
    return this.getDiffStats(session.cwd, session.sourceBranch);
  }

  /**
   * セッション ID から作業ディレクトリとベースブランチを解決し、unified diff を返す。
   *
   * セッションが見つからない場合は `null` を返す。
   *
   * @param sessionId - 対象セッション ID
   * @returns unified diff 文字列または `null`
   */
  async getDiffBySession(sessionId: string): Promise<string | null> {
    const sessions = await this.configRepo.readSessions();
    const session = sessions.find((s) => s.acpSessionId === sessionId);
    if (!session) return null;
    return this.getDiff(session.cwd, session.sourceBranch);
  }

  /**
   * 指定ディレクトリ配下のファイル・フォルダ一覧を返す。
   *
   * `depth` パラメータで取得階層を制御する。depth=1 で直下のみ、
   * depth=2 で直下 + サブディレクトリの中身も含むフラットリストを返す。
   * `.git` や `node_modules` などの一般的な除外対象は結果に含めない。
   *
   * @param cwd - プロジェクトルート（worktree パス）
   * @param dirPath - cwd からの相対ディレクトリパス（`""` でルート）
   * @param depth - 取得する階層の深さ（デフォルト1、最大3）
   * @returns {@link FileEntry} の配列（ディレクトリ優先・名前順）
   */
  async listFiles(cwd: string, dirPath: string, depth: number = 1): Promise<FileEntry[]> {
    const clampedDepth = Math.min(Math.max(depth, 1), 3);
    const targetDir = path.resolve(cwd, dirPath);

    // パストラバーサル防止
    const resolvedCwd = path.resolve(cwd);
    if (!targetDir.startsWith(resolvedCwd)) {
      throw new Error('Directory path is outside the working directory');
    }

    return this.readDirRecursive(resolvedCwd, targetDir, clampedDepth);
  }

  /**
   * セッション ID からファイル一覧を取得する。
   *
   * @param sessionId - 対象セッション ID
   * @param dirPath - cwd からの相対ディレクトリパス
   * @param depth - 取得する階層の深さ
   * @returns {@link FileEntry} の配列、セッションが見つからない場合は空配列
   */
  async listFilesBySession(
    sessionId: string,
    dirPath: string,
    depth?: number,
  ): Promise<FileEntry[]> {
    const sessions = await this.configRepo.readSessions();
    const session = sessions.find((s) => s.acpSessionId === sessionId);
    if (!session) return [];
    return this.listFiles(session.cwd, dirPath, depth);
  }

  /**
   * セッション ID からファイルの内容を読み取る。
   *
   * @param sessionId - 対象セッション ID
   * @param filePath - cwd からの相対ファイルパス
   * @returns ファイルの内容（UTF-8）
   * @throws セッションが見つからない場合、またはパスが cwd 外の場合
   */
  async readFileBySession(sessionId: string, filePath: string): Promise<string> {
    const sessions = await this.configRepo.readSessions();
    const session = sessions.find((s) => s.acpSessionId === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const resolvedCwd = path.resolve(session.cwd);
    const resolvedFile = path.resolve(session.cwd, filePath);
    if (!resolvedFile.startsWith(resolvedCwd + path.sep) && resolvedFile !== resolvedCwd) {
      throw new Error('File path is outside the working directory');
    }
    return this.fs.readFile(resolvedFile, 'utf-8');
  }

  /**
   * セッション ID からファイルに内容を書き込む。
   *
   * @param sessionId - 対象セッション ID
   * @param filePath - cwd からの相対ファイルパス
   * @param content - 書き込む内容
   * @throws セッションが見つからない場合、またはパスが cwd 外の場合
   */
  async writeFileBySession(sessionId: string, filePath: string, content: string): Promise<void> {
    const sessions = await this.configRepo.readSessions();
    const session = sessions.find((s) => s.acpSessionId === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const resolvedCwd = path.resolve(session.cwd);
    const resolvedFile = path.resolve(session.cwd, filePath);
    if (!resolvedFile.startsWith(resolvedCwd + path.sep) && resolvedFile !== resolvedCwd) {
      throw new Error('File path is outside the working directory');
    }
    await this.fs.writeFile(resolvedFile, content, 'utf-8');
  }

  /** パスが存在するか確認する。 */
  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await this.fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリを再帰的に読み取り、{@link FileEntry} のフラットリストを返す。
   *
   * @param cwd - プロジェクトルートの絶対パス
   * @param dir - 読み取る絶対ディレクトリパス
   * @param depth - 残りの再帰深さ
   * @returns ディレクトリ優先・名前順でソートされた {@link FileEntry} の配列
   */
  private async readDirRecursive(cwd: string, dir: string, depth: number): Promise<FileEntry[]> {
    let names: string[];
    try {
      names = await this.fs.readdir(dir);
    } catch {
      return [];
    }

    const entries: FileEntry[] = [];

    // stat を並列で実行して高速化
    const statResults = await Promise.all(
      names
        .filter((name) => !EXCLUDED_DIRS.has(name))
        .map(async (name) => {
          const fullPath = path.join(dir, name);
          try {
            const s = await this.fs.stat(fullPath);
            const relativePath = path.relative(cwd, fullPath);
            return { name, path: relativePath, isDirectory: s.isDirectory() };
          } catch {
            return null;
          }
        }),
    );

    // ディレクトリ優先 → 名前順でソート
    const sorted = statResults
      .filter((e): e is FileEntry => e !== null)
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      entries.push(entry);
      if (entry.isDirectory && depth > 1) {
        const children = await this.readDirRecursive(cwd, path.join(dir, entry.name), depth - 1);
        entries.push(...children);
      }
    }

    return entries;
  }

  /** git コマンドを実行し、終了コードが 0 でない場合はエラーを投げる。stdout を返す。 */
  private execGit(args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnFn('git', args, { cwd, stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr.trim() || `git ${args[0]} failed with code ${String(code)}`));
        }
      });

      proc.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}

/**
 * 新規ファイルの unified diff 文字列を生成する。
 *
 * `git diff --no-index` と同等の出力を手動で構築する。
 *
 * @param filePath - ファイルのパス（worktree ルートからの相対パス）
 * @param content - ファイルの内容
 * @returns unified diff 形式の文字列
 */
export function buildNewFileDiff(filePath: string, content: string): string {
  const lines = content.split('\n');
  const plusLines = lines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    plusLines,
    '',
  ].join('\n');
}

/**
 * `git diff --shortstat` の出力をパースして {@link DiffStats} を返す。
 *
 * 出力例: `" 3 files changed, 111 insertions(+), 51 deletions(-)\n"`
 * 差分がない場合（空文字列）は全て 0 を返す。
 *
 * @param stdout - `git diff --shortstat` の標準出力
 * @returns パース済みの {@link DiffStats}
 */
export function parseDiffShortstat(stdout: string): DiffStats {
  const trimmed = stdout.trim();
  if (trimmed === '') {
    return { filesChanged: 0, insertions: 0, deletions: 0 };
  }

  const filesMatch = trimmed.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = trimmed.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = trimmed.match(/(\d+)\s+deletions?\(-\)/);

  return {
    filesChanged: filesMatch ? Number(filesMatch[1]) : 0,
    insertions: insertionsMatch ? Number(insertionsMatch[1]) : 0,
    deletions: deletionsMatch ? Number(deletionsMatch[1]) : 0,
  };
}
