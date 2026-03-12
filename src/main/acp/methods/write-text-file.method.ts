import type {
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@agentclientprotocol/sdk/dist/schema/index';

/** `fs.writeFile` の最小インターフェース。依存注入・テスト用。 */
export interface FileSystem {
  /** ファイルへ書き込む。 */
  writeFile(path: string, content: string, encoding: string): Promise<void>;
}

/** `fs/writeTextFile` リクエストを処理できるオブジェクトの最小インターフェース。 */
export interface IWriteTextFileMethod {
  /** リクエストを処理する。 */
  handle(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
}

/**
 * ACP `fs/writeTextFile` メソッドの実装。
 *
 * エージェントが指定したパスへ内容を UTF-8 で書き込む。
 */
export class WriteTextFileMethod implements IWriteTextFileMethod {
  /**
   * @param fs - ファイルシステム操作を提供するオブジェクト（依存注入）
   */
  constructor(private readonly fs: FileSystem) {}

  /**
   * 指定されたパスへ内容を UTF-8 で書き込む。
   *
   * @param params - ACP リクエストパラメータ
   * @returns 空オブジェクト {@link WriteTextFileResponse}
   * @throws 書き込みに失敗した場合など `fs.writeFile` が投げるエラーをそのまま再スロー
   */
  async handle(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    await this.fs.writeFile(params.path, params.content, 'utf-8');
    return {};
  }
}
