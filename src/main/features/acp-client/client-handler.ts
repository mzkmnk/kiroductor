import type { Client } from '@agentclientprotocol/sdk/dist/acp';
import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type { IReadTextFileMethod } from './methods/read-text-file.method';
import type { IWriteTextFileMethod } from './methods/write-text-file.method';
import type { IRequestPermissionMethod } from './methods/request-permission.method';
import type { ISessionUpdateMethod } from './methods/session-update.method';
import type { IMetadataMethod } from '../kiro-ext/metadata.method';

export type {
  IReadTextFileMethod,
  IWriteTextFileMethod,
  IRequestPermissionMethod,
  ISessionUpdateMethod,
  IMetadataMethod,
};

/**
 * ACP クライアント側ハンドラー。
 *
 * {@link Client} インターフェースを実装し、エージェントから届いた各リクエストを
 * 対応するメソッドクラスへ委譲する。
 */
export class KiroductorClientHandler implements Client {
  /**
   * @param readTextFileMethod - `fs/readTextFile` リクエストを処理するメソッド
   * @param writeTextFileMethod - `fs/writeTextFile` リクエストを処理するメソッド
   * @param requestPermissionMethod - `client/requestPermission` リクエストを処理するメソッド
   * @param sessionUpdateMethod - `session/update` 通知を処理するメソッド
   * @param metadataMethod - `_kiro.dev/metadata` 拡張通知を処理するメソッド
   */
  constructor(
    private readonly readTextFileMethod: IReadTextFileMethod,
    private readonly writeTextFileMethod: IWriteTextFileMethod,
    private readonly requestPermissionMethod: IRequestPermissionMethod,
    private readonly sessionUpdateMethod: ISessionUpdateMethod,
    private readonly metadataMethod: IMetadataMethod,
  ) {}

  /**
   * ファイルの読み込みリクエストを {@link ReadTextFileMethod} へ委譲する。
   *
   * @param params - ACP リクエストパラメータ
   * @returns ファイル内容を含むレスポンス
   */
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    return this.readTextFileMethod.handle(params);
  }

  /**
   * ファイルの書き込みリクエストを {@link WriteTextFileMethod} へ委譲する。
   *
   * @param params - ACP リクエストパラメータ
   * @returns 空オブジェクトのレスポンス
   */
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    return this.writeTextFileMethod.handle(params);
  }

  /**
   * 操作許可リクエストを {@link RequestPermissionMethod} へ委譲する。
   *
   * @param params - ACP リクエストパラメータ
   * @returns 承認結果を含むレスポンス
   */
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return this.requestPermissionMethod.handle(params);
  }

  /**
   * セッション更新通知を {@link SessionUpdateMethod} へ委譲する。
   *
   * @param params - ACP 通知パラメータ
   */
  sessionUpdate(params: SessionNotification): Promise<void> {
    return this.sessionUpdateMethod.handle(params);
  }

  /**
   * kiro-cli が送信する `_kiro.dev/` 拡張通知を処理する。
   *
   * `_kiro.dev/metadata` は {@link MetadataMethod} へ委譲する。
   * それ以外の拡張通知は無視する（未実装のままだと SDK が `-32601 Method not found` をログ出力し続けるため）。
   *
   * @param method - 通知メソッド名
   * @param params - 通知パラメータ
   */
  async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
    switch (method) {
      case '_kiro.dev/metadata':
        await this.metadataMethod.handle(params);
        break;
      default:
        break;
    }
  }
}
