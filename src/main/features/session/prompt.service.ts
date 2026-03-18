import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type {
  SessionId,
  StopReason,
  ContentBlock,
} from '@agentclientprotocol/sdk/dist/schema/index';
import { createDebugLogger } from '../../shared/debug-logger';
import type { ImageAttachment } from '../../../shared/ipc';
import type { MessageRepository } from './message.repository';

const log = createDebugLogger('Prompt');

/**
 * ユーザーの入力をエージェントへ送り、返答を受け取るサービス。
 *
 * `send()` でユーザーメッセージを送信し、エージェントの返答を
 * {@link MessageRepository} に記録する。
 */
export class PromptService {
  /**
   * @param messageRepo - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param connection - ACP クライアント接続（依存注入）
   */
  constructor(
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
   * @param sessionId - 送信先のセッション ID
   * @param text - ユーザーが入力したテキスト
   * @param images - 添付画像一覧（省略可）
   * @returns エージェントが返した `stopReason`
   */
  async send(sessionId: SessionId, text: string, images?: ImageAttachment[]): Promise<StopReason> {
    log.info(
      `send 開始 sessionId=${sessionId} text="${text.slice(0, 50)}${text.length > 50 ? '…' : ''}" images=${String(images?.length ?? 0)}`,
    );
    this.messageRepo.addUserMessage(sessionId, text, images);
    this.messageRepo.addAgentMessage(sessionId, crypto.randomUUID());

    const prompt: ContentBlock[] = [{ type: 'text', text }];
    if (images) {
      for (const img of images) {
        prompt.push({ type: 'image', mimeType: img.mimeType, data: img.data });
      }
    }

    const { stopReason } = await this.connection.prompt({
      sessionId,
      prompt,
    });
    log.info(`send 完了 stopReason=${stopReason}`);

    // ツール呼び出し後に SessionUpdateMethod が作成したメッセージも含め、
    // streaming 中の全エージェントメッセージを確定する
    const messages = this.messageRepo.getAll(sessionId);
    for (const msg of messages) {
      if (msg.type === 'agent' && msg.status === 'streaming') {
        this.messageRepo.completeAgentMessage(sessionId, msg.id);
      }
    }

    return stopReason;
  }
}
