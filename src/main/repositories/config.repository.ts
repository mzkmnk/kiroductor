import os from 'os';
import path from 'path';
import type { FileSystem } from '../fs';

/** クローン済みリポジトリの情報。`repos.json` に永続化される。 */
export interface RepoMapping {
  /** リポジトリの識別子（nanoid で生成） */
  repoId: string;
  /** クローン元 URL */
  url: string;
  /** ホスト名（例: "github.com"） */
  host: string;
  /** 組織またはユーザー名（例: "mzkmnk"） */
  org: string;
  /** リポジトリ名（例: "kiroductor"） */
  name: string;
  /** クローン日時（ISO 8601） */
  clonedAt: string;
}

/** `repos.json` のファイル構造 */
interface ReposFile {
  /** リポジトリ一覧 */
  repos: RepoMapping[];
}

/** ACP セッションとリポジトリの紐付け情報。`sessions.json` に永続化される。 */
export interface SessionMapping {
  /** kiro-cli の ACP セッション ID */
  acpSessionId: string;
  /** リポジトリの識別子（{@link RepoMapping.repoId} への参照） */
  repoId: string;
  /** セッション作成時の作業ディレクトリ */
  cwd: string;
  /** セッションのタイトル（kiro-cli から取得、または null） */
  title: string | null;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 最終更新日時（ISO 8601） */
  updatedAt: string;
}

/** `sessions.json` のファイル構造 */
interface SessionsFile {
  /** セッション一覧 */
  sessions: SessionMapping[];
}

/**
 * `.kiroductor/` ディレクトリの読み書きを管理するリポジトリ。
 *
 * `repos.json`・`sessions.json` の永続化と、
 * ベースディレクトリ・`repos/` サブディレクトリの作成を担う。
 * ファイルシステム操作は {@link FileSystem} を介して行い、テスト可能にしている。
 */
export class ConfigRepository {
  private readonly baseDir: string;

  /**
   * @param fs - ファイルシステム操作のアダプター
   * @param baseDir - ベースディレクトリのパス（省略時は `~/.kiroductor/`）
   */
  constructor(
    private readonly fs: FileSystem,
    baseDir?: string,
  ) {
    this.baseDir = baseDir ?? path.join(os.homedir(), '.kiroductor');
  }

  /**
   * `~/.kiroductor/` のパスを返す。
   *
   * @returns ベースディレクトリの絶対パス
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * bare repo のルートディレクトリのパスを返す。
   *
   * @returns `~/.kiroductor/repos/` の絶対パス
   */
  getReposRoot(): string {
    return path.join(this.baseDir, 'repos');
  }

  /**
   * ベースディレクトリと `repos/` サブディレクトリが存在しなければ作成する。
   *
   * `mkdir -p` 相当の処理を行い、既に存在する場合はエラーにならない。
   */
  async ensureBaseDir(): Promise<void> {
    await this.fs.mkdir(this.baseDir, { recursive: true });
    await this.fs.mkdir(path.join(this.baseDir, 'repos'), { recursive: true });
  }

  /**
   * `repos.json` を読み込み、リポジトリ一覧を返す。
   *
   * ファイルが存在しない場合は空配列を返す。
   *
   * @returns {@link RepoMapping} の配列
   */
  async readRepos(): Promise<RepoMapping[]> {
    const filePath = path.join(this.baseDir, 'repos.json');
    try {
      await this.fs.access(filePath);
      const raw = await this.fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as ReposFile;
      return data.repos;
    } catch {
      return [];
    }
  }

  /**
   * `repos.json` を書き込む。
   *
   * @param repos - 書き込む {@link RepoMapping} の配列
   */
  async writeRepos(repos: RepoMapping[]): Promise<void> {
    const filePath = path.join(this.baseDir, 'repos.json');
    const data: ReposFile = { repos };
    await this.fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * `repoId` をキーにリポジトリを追加または更新する。
   *
   * 同じ `repoId` が存在する場合は上書き更新する。
   * 存在しない場合は新規追加する。
   *
   * @param mapping - 追加または更新する {@link RepoMapping}
   */
  async upsertRepo(mapping: RepoMapping): Promise<void> {
    const repos = await this.readRepos();
    const idx = repos.findIndex((r) => r.repoId === mapping.repoId);

    if (idx >= 0) {
      repos[idx] = mapping;
    } else {
      repos.push(mapping);
    }

    await this.writeRepos(repos);
  }

  /**
   * URL に一致するリポジトリを検索する。
   *
   * @param host - ホスト名
   * @param org - 組織名
   * @param repo - リポジトリ名
   * @returns 一致する {@link RepoMapping}、存在しない場合は `undefined`
   */
  async findRepoByPath(host: string, org: string, repo: string): Promise<RepoMapping | undefined> {
    const repos = await this.readRepos();
    return repos.find((r) => r.host === host && r.org === org && r.name === repo);
  }

  /**
   * `sessions.json` を読み込み、セッション一覧を返す。
   *
   * ファイルが存在しない場合は空配列を返す。
   *
   * @returns {@link SessionMapping} の配列
   */
  async readSessions(): Promise<SessionMapping[]> {
    const filePath = path.join(this.baseDir, 'sessions.json');
    try {
      await this.fs.access(filePath);
      const raw = await this.fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as SessionsFile;
      return data.sessions;
    } catch {
      return [];
    }
  }

  /**
   * `sessions.json` を書き込む。
   *
   * @param sessions - 書き込む {@link SessionMapping} の配列
   */
  async writeSessions(sessions: SessionMapping[]): Promise<void> {
    const filePath = path.join(this.baseDir, 'sessions.json');
    const data: SessionsFile = { sessions };
    await this.fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * `acpSessionId` をキーにセッションを追加または更新する。
   *
   * 同じ `acpSessionId` が存在する場合は上書き更新し、`updatedAt` を現在時刻に設定する。
   * 存在しない場合は新規追加する。
   *
   * @param mapping - 追加または更新する {@link SessionMapping}
   */
  async upsertSession(mapping: SessionMapping): Promise<void> {
    const sessions = await this.readSessions();
    const now = new Date().toISOString();
    const idx = sessions.findIndex((s) => s.acpSessionId === mapping.acpSessionId);
    const updated: SessionMapping = { ...mapping, updatedAt: now };

    if (idx >= 0) {
      sessions[idx] = updated;
    } else {
      sessions.push(updated);
    }

    await this.writeSessions(sessions);
  }

  /**
   * 指定した `acpSessionId` のセッションを削除する。
   *
   * 存在しない `acpSessionId` を指定してもエラーにならない。
   *
   * @param acpSessionId - 削除するセッションの ID
   */
  async removeSession(acpSessionId: string): Promise<void> {
    const sessions = await this.readSessions();
    const filtered = sessions.filter((s) => s.acpSessionId !== acpSessionId);
    await this.writeSessions(filtered);
  }
}
