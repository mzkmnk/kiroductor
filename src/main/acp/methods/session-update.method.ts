import { randomUUID } from 'crypto';
import type {
  ContentChunk,
  SessionNotification,
  ToolCall,
  ToolCallUpdate,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type { MessageRepository } from '../../repositories/message.repository';

/** レンダラーへ通知を送信するサービスの最小インターフェース。依存注入・テスト用。 */
export interface NotificationService {
  /** 指定チャネルでレンダラーへデータを送信する。 */
  sendToRenderer(channel: string, data: unknown): void;
}

/**
 * ACP `session/update` 通知の実装。
 *
 * エージェントから送られてくる進捗・発言をリアルタイムで画面へ反映する。
 * `agent_message_chunk` / `tool_call` / `tool_call_update` を処理し、
 * その他のイベントはそのまま転送するフォールスルー処理を行う。
 */
export class SessionUpdateMethod {
  /**
   * @param messageRepository - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param notificationService - レンダラーへの通知を担うサービス（依存注入）
   */
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * セッション更新通知を処理する。
   *
   * @param params - ACP `session/update` 通知パラメータ
   */
  async handle(params: SessionNotification): Promise<void> {
    const { update } = params;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.handleAgentMessageChunk(update);
        break;
      case 'tool_call':
        this.handleToolCall(update);
        break;
      case 'tool_call_update':
        this.handleToolCallUpdate(update);
        break;
      default:
        // フォールスルー: レンダラーへ転送するだけ
        break;
    }

    this.notificationService.sendToRenderer('acp:session-update', params);
  }

  /**
   * `agent_message_chunk` イベントを処理する。
   *
   * `content.type === 'text'` のとき、`status: 'streaming'` の最新エージェントメッセージへ
   * チャンクを追記する。streaming 中のメッセージが存在しない場合はフォールバックとして新規追加する。
   *
   * @param update - `agent_message_chunk` イベントデータ
   */
  private handleAgentMessageChunk(update: ContentChunk): void {
    if (update.content.type !== 'text') return;

    const chunk = (update.content as Extract<ContentChunk['content'], { type: 'text' }>).text;

    const streamingMessage = this.messageRepository
      .getAll()
      .filter((m) => m.type === 'agent' && m.status === 'streaming')
      .at(-1);

    if (streamingMessage) {
      this.messageRepository.appendAgentChunk(streamingMessage.id, chunk);
    } else {
      const newMessage = this.messageRepository.addAgentMessage(randomUUID());
      this.messageRepository.appendAgentChunk(newMessage.id, chunk);
    }
  }

  /**
   * `tool_call` イベントを処理する。
   *
   * 同じ `toolCallId` のメッセージが未登録なら `addToolCall` を呼び、
   * 既存なら `updateToolCall` で `name` / `input` を更新する。
   *
   * @param update - `tool_call` イベントデータ
   */
  private handleToolCall(update: ToolCall): void {
    const { toolCallId, title, rawInput } = update;
    const existing = this.messageRepository
      .getAll()
      .find((m) => m.type === 'tool_call' && m.id === toolCallId);

    if (existing) {
      this.messageRepository.updateToolCall(toolCallId, { name: title, input: rawInput });
    } else {
      this.messageRepository.addToolCall(toolCallId, title, rawInput);
    }
  }

  /**
   * `tool_call_update` イベントを処理する。
   *
   * `status` と `rawOutput` を `updateToolCall` へ渡す。`rawOutput` が `undefined` の場合は `result` を更新しない。
   *
   * @param update - `tool_call_update` イベントデータ
   */
  private handleToolCallUpdate(update: ToolCallUpdate): void {
    const { toolCallId, status, rawOutput } = update;
    this.messageRepository.updateToolCall(toolCallId, {
      ...(status != null ? { status } : {}),
      ...(rawOutput !== undefined ? { result: JSON.stringify(rawOutput) } : {}),
    });
  }
}
