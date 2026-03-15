import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type { FileSystem } from '../../fs';

/** `fs/readTextFile` リクエストを処理できるオブジェクトの最小インターフェース。 */
export interface IReadTextFileMethod {
  /** リクエストを処理する。 */
  handle(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
}

/**
 * ACP `fs/readTextFile` メソッドの実装。
 *
 * エージェントが指定したパスのファイルを UTF-8 で読み込み、内容を返す。
 * `params.limit`（最大行数）/ `params.line`（開始行）は MVP では無視する。
 */
export class ReadTextFileMethod implements IReadTextFileMethod {
  /**
   * @param fs - ファイルシステム操作を提供するオブジェクト（依存注入）
   */
  constructor(private readonly fs: Pick<FileSystem, 'readFile'>) {}

  /**
   * 指定されたパスのファイルを UTF-8 で読み込んで返す。
   *
   * @param params - ACP リクエストパラメータ
   * @returns ファイルの内容を含む {@link ReadTextFileResponse}
   * @throws ファイルが存在しない場合など `fs.readFile` が投げるエラーをそのまま再スロー
   */
  async handle(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    const content = await this.fs.readFile(params.path, 'utf-8');
    return { content };
  }
}
