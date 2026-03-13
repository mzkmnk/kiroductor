import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type { StopReason } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionRepository } from '../repositories/session.repository';
import type { MessageRepository } from '../repositories/message.repository';

/**
 * ユーザーの入力をエージェントへ送り、返答を受け取るサービス。
 *
 * `send()` でユーザーメッセージを送信し、エージェントの返答を
 * {@link MessageRepository} に記録する。
 */
export class PromptService {
  /**
   * @param sessionRepo - セッション ID を管理するリポジトリ（依存注入）
   * @param messageRepo - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param connection - ACP クライアント接続（依存注入）
   */
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly messageRepo: MessageRepository,
    private readonly connection: Pick<ClientSideConnection, 'prompt'>,
  ) {}

  /**
   * ユーザーのテキストをエージェントへ送信し、返答を受け取る。
   *
   * 1. ユーザーメッセージを `MessageRepository` に追加する
   * 2. エージェント返答用の空メッセージ（`status: 'streaming'`）を `MessageRepository` に追加する
   * 3. ACP 接続の `prompt()` を呼んでエージェントへテキストを送信する
   * 4. 返答が完了したらエージェントメッセージを確定状態（`status: 'completed'`）にする
   * 5. 完了理由（`stopReason`）を返す
   *
   * @param text - ユーザーが入力したテキスト
   * @returns エージェントが返した `stopReason`
   */
  async send(text: string): Promise<StopReason> {
    const sessionId = this.sessionRepo.getSessionId();
    if (!sessionId) {
      throw new Error('No active session');
    }

    this.messageRepo.addUserMessage(text);
    const agentMessage = this.messageRepo.addAgentMessage(crypto.randomUUID());

    const { stopReason } = await this.connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });

    this.messageRepo.completeAgentMessage(agentMessage.id);

    return stopReason;
  }
}
