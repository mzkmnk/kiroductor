import path from 'path';
import type { spawn } from 'child_process';
import { nanoid } from 'nanoid';
import { createDebugLogger } from '../debug-logger';
import type { ConfigRepository } from '../repositories/config.repository';
import type { RepoMapping } from '../repositories/config.repository';
import type { FileSystem } from '../fs';

const log = createDebugLogger('Repo');

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
      'getBaseDir' | 'getReposRoot' | 'readRepos' | 'upsertRepo' | 'findRepoByPath'
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
      await this.execGit(['fetch', '--all'], repoPath);
      return existing.repoId;
    }

    const parentDir = path.dirname(repoPath);
    await this.fs.mkdir(parentDir, { recursive: true });

    log.info(`bare clone: ${url} → ${repoPath}`);
    await this.execGit(['clone', '--bare', url, repoPath]);

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
   * @param branch - チェックアウトするブランチ名（省略時はデフォルトブランチ）
   * @returns `{ cwd: string; branch: string }` — worktree のパスと使用ブランチ名
   * @throws リポジトリが見つからない場合、または git コマンドが失敗した場合
   */
  async createWorktree(repoId: string, branch?: string): Promise<{ cwd: string; branch: string }> {
    const repos = await this.configRepo.readRepos();
    const repo = repos.find((r) => r.repoId === repoId);
    if (!repo) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    const repoPath = this.getRepoPath(repo);
    const resolvedBranch = branch ?? (await this.resolveDefaultBranch(repoPath));

    const id = nanoid();
    const worktreeDir = path.join(this.configRepo.getBaseDir(), 'worktrees', id);
    await this.fs.mkdir(worktreeDir, { recursive: true });
    const worktreePath = path.join(worktreeDir, repo.name);

    log.info(`worktree add: ${worktreePath} (branch: ${resolvedBranch})`);
    await this.execGit(['worktree', 'add', worktreePath, resolvedBranch], repoPath);

    return { cwd: worktreePath, branch: resolvedBranch };
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
   * bare clone では `git branch -r` ではリモートトラッキングブランチが存在しないため、
   * `git branch` でローカルブランチ（= fetch 済みブランチ）を一覧する。
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

    log.info('listBranches: fetching all for repoId=%s, repoPath=%s', repoId, repoPath);
    await this.execGit(['fetch', '--all'], repoPath);
    const stdout = await this.execGit(['branch'], repoPath);
    log.info('listBranches: raw stdout=%s', JSON.stringify(stdout));

    const branches = stdout
      .split('\n')
      .map((line) => line.replace(/^[*+]?\s+/, '').trim())
      .filter((line) => line.length > 0)
      .sort();

    log.info('listBranches: parsed branches=%o', branches);
    return branches;
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
