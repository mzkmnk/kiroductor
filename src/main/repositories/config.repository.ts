import os from 'os';
import path from 'path';

/** アプリ全体の設定。`settings.json` に永続化される。 */
export interface KiroductorSettings {
  /** kiro-cli の実行パス（デフォルト: "kiro-cli"） */
  kiroCli: {
    /** kiro-cli 実行ファイルのパス */
    path: string;
  };
  /** bare repo のルートディレクトリ（デフォルト: "~/.kiroductor/repos"） */
  reposRoot: string;
}

/** ACP セッションとリポジトリの紐付け情報。`sessions.json` に永続化される。 */
export interface SessionMapping {
  /** kiro-cli の ACP セッション ID */
  acpSessionId: string;
  /** リポジトリの識別子（例: "github.com/mzkmnk/kiroductor"） */
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

/** ファイルシステム操作の抽象。依存注入によりテスト可能にする。 */
export interface FsAdapter {
  /**
   * ディレクトリを再帰的に作成する。
   *
   * @param dirPath - 作成するディレクトリのパス
   * @param opts - オプション（`recursive` など）
   */
  mkdir(dirPath: string, opts?: { recursive?: boolean }): Promise<string | undefined>;

  /**
   * ファイルを読み込む。
   *
   * @param filePath - 読み込むファイルのパス
   * @param encoding - 文字エンコーディング
   * @returns ファイルの内容
   */
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;

  /**
   * ファイルに内容を書き込む。
   *
   * @param filePath - 書き込むファイルのパス
   * @param content - 書き込む内容
   * @param encoding - 文字エンコーディング
   */
  writeFile(filePath: string, content: string, encoding: BufferEncoding): Promise<void>;

  /**
   * ファイルまたはディレクトリの存在を確認する。
   *
   * @param filePath - 確認するパス
   * @throws ファイルが存在しない場合にエラーをスロー
   */
  access(filePath: string): Promise<void>;
}

/**
 * `.kiroductor/` ディレクトリの読み書きを管理するリポジトリ。
 *
 * `settings.json` および `sessions.json` の永続化と、
 * ベースディレクトリ・`repos/` サブディレクトリの作成を担う。
 * ファイルシステム操作は {@link FsAdapter} を介して行い、テスト可能にしている。
 */
export class ConfigRepository {
  private readonly baseDir: string;

  /**
   * @param fs - ファイルシステム操作のアダプター
   * @param baseDir - ベースディレクトリのパス（省略時は `~/.kiroductor/`）
   */
  constructor(
    private readonly fs: FsAdapter,
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
   * ベースディレクトリと `repos/` サブディレクトリが存在しなければ作成する。
   *
   * `mkdir -p` 相当の処理を行い、既に存在する場合はエラーにならない。
   */
  async ensureBaseDir(): Promise<void> {
    await this.fs.mkdir(this.baseDir, { recursive: true });
    await this.fs.mkdir(path.join(this.baseDir, 'repos'), { recursive: true });
  }

  /**
   * `settings.json` を読み込み、デフォルト値とマージして返す。
   *
   * ファイルが存在しない場合はデフォルト設定を返す。
   *
   * @returns {@link KiroductorSettings}
   */
  async readSettings(): Promise<KiroductorSettings> {
    const defaultSettings: KiroductorSettings = {
      kiroCli: { path: 'kiro-cli' },
      reposRoot: path.join(this.baseDir, 'repos'),
    };

    const filePath = path.join(this.baseDir, 'settings.json');
    try {
      await this.fs.access(filePath);
      const raw = await this.fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as KiroductorSettings;
    } catch {
      return defaultSettings;
    }
  }

  /**
   * `settings.json` を書き込む。
   *
   * JSON を 2 スペースインデントで整形して書き込む。
   *
   * @param settings - 書き込む {@link KiroductorSettings}
   */
  async writeSettings(settings: KiroductorSettings): Promise<void> {
    const filePath = path.join(this.baseDir, 'settings.json');
    await this.fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
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
