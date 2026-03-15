import path from 'path';
import type { ChildProcess } from 'child_process';
import { nanoid } from 'nanoid';
import { createDebugLogger } from '../debug-logger';
import type { ConfigRepository } from '../repositories/config.repository';
import type { FileSystem } from '../fs';

const log = createDebugLogger('Repo');

/** パースされたリポジトリ URL の構成要素。 */
export interface ParsedRepoUrl {
  /** ホスト名（例: "github.com"） */
  host: string;
  /** 組織またはユーザー名（例: "mzkmnk"） */
  org: string;
  /** リポジトリ名（例: "kiroductor"） */
  repo: string;
}

/** `child_process.spawn` と互換性のある最小インターフェース。テスト用に注入可能。 */
export type SpawnForRepo = (
  command: string,
  args: string[],
  options: { cwd?: string; stdio?: string },
) => ChildProcess;

/**
 * Bare リポジトリのクローンと worktree の管理を行うサービス。
 *
 * `~/.kiroductor/repos/` 配下にホスト/組織/リポジトリ名でディレクトリを構造化し、
 * bare clone を格納する。worktree は `~/.kiroductor/worktrees/` 配下に作成する。
 */
export class RepoService {
  /**
   * @param configRepo - ベースディレクトリ情報を提供する {@link ConfigRepository}
   * @param fs - ファイルシステム操作のアダプター
   * @param spawnFn - 子プロセスを起動する関数（テスト時にモック差し替え可能）
   */
  constructor(
    private readonly configRepo: Pick<ConfigRepository, 'getBaseDir' | 'getReposRoot'>,
    private readonly fs: FileSystem,
    private readonly spawnFn: SpawnForRepo,
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
      return { host: sshMatch[1], org: sshMatch[2], repo: sshMatch[3] };
    }

    // HTTPS 形式: https://github.com/org/repo.git
    const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { host: httpsMatch[1], org: httpsMatch[2], repo: httpsMatch[3] };
    }

    throw new Error(`Unsupported repository URL format: ${url}`);
  }

  /**
   * リポジトリ ID から bare clone のパスを返す。
   *
   * @param repoId - リポジトリの識別子（例: "github.com/mzkmnk/kiroductor"）
   * @returns bare clone ディレクトリの絶対パス
   */
  getRepoPath(repoId: string): string {
    return path.join(this.configRepo.getReposRoot(), `${repoId}.git`);
  }

  /**
   * リポジトリを bare clone する。
   *
   * 既にクローン済みの場合は `git fetch --all` で最新に更新する。
   * クローン先ディレクトリの親が存在しなければ再帰的に作成する。
   *
   * @param url - クローンするリポジトリの URL
   * @returns リポジトリの識別子（repoId）
   * @throws git コマンドが失敗した場合
   */
  async clone(url: string): Promise<string> {
    const parsed = this.parseRepoUrl(url);
    const repoId = `${parsed.host}/${parsed.org}/${parsed.repo}`;
    const repoPath = this.getRepoPath(repoId);

    const exists = await this.pathExists(repoPath);

    if (exists) {
      log.info(`既にクローン済み: ${repoId} → fetch --all`);
      await this.execGit(['fetch', '--all'], repoPath);
    } else {
      const parentDir = path.dirname(repoPath);
      await this.fs.mkdir(parentDir, { recursive: true });

      log.info(`bare clone: ${url} → ${repoPath}`);
      await this.execGit(['clone', '--bare', url, repoPath]);
    }

    return repoId;
  }

  /**
   * bare repo から worktree を作成し、パスを返す。
   *
   * worktree は `~/.kiroductor/worktrees/{nanoid}/{repoName}` に作成する。
   * branch を省略した場合はデフォルトブランチ（HEAD）を使用する。
   *
   * @param repoId - リポジトリの識別子
   * @param branch - チェックアウトするブランチ名（省略時は HEAD）
   * @returns `{ cwd: string }` — worktree のパス
   * @throws git コマンドが失敗した場合
   */
  async createWorktree(repoId: string, branch?: string): Promise<{ cwd: string }> {
    const repoPath = this.getRepoPath(repoId);
    const parts = repoId.split('/');
    const repoName = parts[parts.length - 1];
    const id = nanoid();
    const worktreeDir = path.join(this.configRepo.getBaseDir(), 'worktrees', id);
    await this.fs.mkdir(worktreeDir, { recursive: true });
    const worktreePath = path.join(worktreeDir, repoName);

    const targetBranch = branch ?? 'HEAD';

    log.info(`worktree add: ${worktreePath} (branch: ${targetBranch})`);
    await this.execGit(['worktree', 'add', worktreePath, targetBranch], repoPath);

    return { cwd: worktreePath };
  }

  /**
   * クローン済みリポジトリの repoId 一覧を返す。
   *
   * `~/.kiroductor/repos/` 配下のディレクトリ構造を走査し、
   * `host/org/repo` 形式の repoId を生成する。
   *
   * @returns repoId の配列
   */
  async listClonedRepos(): Promise<string[]> {
    const reposRoot = this.configRepo.getReposRoot();
    const repoIds: string[] = [];

    try {
      const hosts = await this.fs.readdir(reposRoot);
      for (const host of hosts) {
        const orgs = await this.fs.readdir(path.join(reposRoot, host));
        for (const org of orgs) {
          const repos = await this.fs.readdir(path.join(reposRoot, host, org));
          for (const repo of repos) {
            if (repo.endsWith('.git')) {
              repoIds.push(`${host}/${org}/${repo.replace(/\.git$/, '')}`);
            }
          }
        }
      }
    } catch {
      // ディレクトリが存在しない場合は空配列を返す
    }

    return repoIds;
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

  /** git コマンドを実行し、終了コードが 0 でない場合はエラーを投げる。 */
  private execGit(args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnFn('git', args, { cwd, stdio: 'pipe' });
      let stderr = '';

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
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
