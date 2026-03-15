import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { createDebugLogger } from '../debug-logger';
import type { SessionRepository } from '../repositories/session.repository';
import type { MessageRepository } from '../repositories/message.repository';

const log = createDebugLogger('Session');

/**
 * エージェントとの会話セッションのライフサイクルを管理するサービス。
 *
 * `create()` で新規セッションを開始し、`cancel()` で実行中のセッションをキャンセルする。
 */
export class SessionService {
  /**
   * @param sessionRepo - セッション ID を管理するリポジトリ（依存注入）
   * @param messageRepo - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param connection - ACP クライアント接続（依存注入）
   */
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly messageRepo: MessageRepository,
    private readonly connection: Pick<
      ClientSideConnection,
      'newSession' | 'cancel' | 'loadSession'
    >,
  ) {}

  /**
   * 指定した作業ディレクトリで新しいセッションを開始する。
   *
   * 1. ACP 接続の `newSession()` を呼んでセッションを作成する
   * 2. 返却された `sessionId` を `SessionRepository` に保存する
   * 3. `MessageRepository` をクリアしてメッセージ履歴をリセットする
   *
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   */
  async create(cwd: string): Promise<void> {
    log.info(`newSession 開始 cwd=${cwd}`);
    // TODO: mcpServers に対応する
    const { sessionId } = await this.connection.newSession({ cwd, mcpServers: [] });
    log.info(`newSession 完了 sessionId=${sessionId}`);
    this.sessionRepo.setSessionId(sessionId);
    this.messageRepo.clear();
  }

  /**
   * 既存セッションを復元する。
   *
   * 1. `MessageRepository` をクリアしてメッセージ履歴をリセットする
   * 2. ACP 接続の `loadSession()` を呼んでセッションを復元する
   * 3. 指定した `sessionId` を `SessionRepository` に保存する
   *
   * @param sessionId - 復元するセッションの ID
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   */
  async load(sessionId: string, cwd: string): Promise<void> {
    log.info(`loadSession 開始 sessionId=${sessionId} cwd=${cwd}`);
    this.messageRepo.clear();
    await this.connection.loadSession({ sessionId, cwd, mcpServers: [] });
    log.info(`loadSession 完了 sessionId=${sessionId}`);
    this.sessionRepo.setSessionId(sessionId);
  }

  /**
   * 実行中のセッションをキャンセルする。
   *
   * アクティブなセッションが存在しない場合は何もしない。
   */
  async cancel(): Promise<void> {
    const sessionId = this.sessionRepo.getSessionId();
    if (!sessionId) {
      log.info('cancel: アクティブなセッションがありません');
      return;
    }
    log.info(`cancel sessionId=${sessionId}`);
    await this.connection.cancel({ sessionId });
    log.info('cancel 完了');
  }
}
