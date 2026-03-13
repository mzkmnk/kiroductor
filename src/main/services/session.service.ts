import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type { SessionRepository } from '../repositories/session.repository';
import type { MessageRepository } from '../repositories/message.repository';

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
    private readonly connection: Pick<ClientSideConnection, 'newSession' | 'cancel'>,
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
    // TODO: mcpServers に対応する
    const { sessionId } = await this.connection.newSession({ cwd, mcpServers: [] });
    this.sessionRepo.setSessionId(sessionId);
    this.messageRepo.clear();
  }

  /**
   * 実行中のセッションをキャンセルする。
   *
   * アクティブなセッションが存在しない場合は何もしない。
   */
  async cancel(): Promise<void> {
    const sessionId = this.sessionRepo.getSessionId();
    if (!sessionId) {
      return;
    }
    await this.connection.cancel({ sessionId });
  }
}
