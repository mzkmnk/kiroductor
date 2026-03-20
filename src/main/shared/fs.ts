/**
 * ファイルシステム操作の共通インターフェース。
 *
 * 依存注入によりテスト可能にするための抽象。
 * 各クラスは必要なメソッドのみを {@link https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys Pick} で宣言する。
 */
export interface FileSystem {
  /**
   * ファイルを読み込む。
   *
   * @param path - 読み込むファイルのパス
   * @param encoding - 文字エンコーディング
   * @returns ファイルの内容
   */
  readFile(path: string, encoding: BufferEncoding): Promise<string>;

  /**
   * ファイルに内容を書き込む。
   *
   * @param path - 書き込むファイルのパス
   * @param content - 書き込む内容
   * @param encoding - 文字エンコーディング
   */
  writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void>;

  /**
   * ディレクトリを作成する。
   *
   * @param path - 作成するディレクトリのパス
   * @param opts - オプション（`recursive: true` で `mkdir -p` 相当）
   * @returns 作成したディレクトリのパス（`recursive` 時は最初に作成されたパス）
   */
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<string | undefined>;

  /**
   * ファイルまたはディレクトリの存在を確認する。
   *
   * @param path - 確認するパス
   * @throws パスが存在しない場合にエラーをスロー
   */
  access(path: string): Promise<void>;

  /**
   * ディレクトリ内のエントリ一覧を返す。
   *
   * @param path - 読み取るディレクトリのパス
   * @returns エントリ名の配列
   */
  readdir(path: string): Promise<string[]>;

  /**
   * ファイルまたはディレクトリのメタ情報を返す。
   *
   * @param path - 対象のパス
   * @returns `isDirectory()` メソッドを持つオブジェクト
   */
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}
