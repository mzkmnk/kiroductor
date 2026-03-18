import { randomUUID } from 'crypto';
import type {
  ContentChunk,
  SessionId,
  SessionNotification,
  ToolCall,
  ToolCallUpdate,
} from '@agentclientprotocol/sdk/dist/schema/index';
import { createDebugLogger } from '../../../shared/debug-logger';
import type { MessageRepository } from '../../session/message.repository';
import type { NotificationService } from '../../../shared/interfaces/notification.service';

const log = createDebugLogger('SessionUpdate');

/** `session/update` 通知を処理できるオブジェクトの最小インターフェース。 */
export interface ISessionUpdateMethod {
  /** 通知を処理する。 */
  handle(params: SessionNotification): Promise<void>;
}

/**
 * ACP `session/update` 通知の実装。
 *
 * エージェントから送られてくる進捗・発言をリアルタイムで画面へ反映する。
 * `agent_message_chunk` / `tool_call` / `tool_call_update` を処理し、
 * その他のイベントはそのまま転送するフォールスルー処理を行う。
 */
export class SessionUpdateMethod implements ISessionUpdateMethod {
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
    const { sessionId, update } = params;
    log.info(`sessionUpdate=${update.sessionUpdate}`);

    switch (update.sessionUpdate) {
      case 'user_message_chunk':
        this.handleUserMessageChunk(sessionId, update);
        break;
      case 'agent_message_chunk':
        this.handleAgentMessageChunk(sessionId, update);
        break;
      case 'tool_call':
        this.handleToolCall(sessionId, update);
        break;
      case 'tool_call_update':
        this.handleToolCallUpdate(sessionId, update);
        break;
      default:
        // フォールスルー: レンダラーへ転送するだけ
        log.info(`フォールスルー: ${update.sessionUpdate}`);
        break;
    }

    this.notificationService.sendToRenderer('acp:session-update', params);
  }

  /**
   * `user_message_chunk` イベントを処理する。
   *
   * - `content.type === 'text'`: ユーザーメッセージをリポジトリに追加する。
   * - `content.type === 'image'`: 直近の UserMessage に添付画像を追加する。
   *   セッション復元時に ACP サーバーから画像チャンクが再送されるケースに対応する。
   *
   * @param sessionId - セッション ID
   * @param update - `user_message_chunk` イベントデータ
   */
  private handleUserMessageChunk(sessionId: SessionId, update: ContentChunk): void {
    log.info(
      `handleUserMessageChunk: content.type=${update.content.type} sessionId=${sessionId} keys=${Object.keys(update.content).join(',')}`,
    );

    if (update.content.type === 'text') {
      const text = (update.content as Extract<ContentChunk['content'], { type: 'text' }>).text;
      log.info(`handleUserMessageChunk: text="${text.slice(0, 100)}"`);
      this.messageRepository.addUserMessage(sessionId, text);
    } else if (update.content.type === 'image') {
      const { data, mimeType } = update.content as Extract<
        ContentChunk['content'],
        { type: 'image' }
      >;
      log.info(
        `handleUserMessageChunk: image mimeType=${mimeType} dataLength=${data?.length ?? 'undefined'}`,
      );
      const messages = this.messageRepository.getAll(sessionId);
      const lastUserMsg = [...messages].reverse().find((m) => m.type === 'user');
      log.info(
        `handleUserMessageChunk: lastUserMsg=${lastUserMsg ? `id=${lastUserMsg.id}` : 'null'} totalMessages=${String(messages.length)}`,
      );
      if (lastUserMsg) {
        this.messageRepository.addAttachmentToUserMessage(sessionId, lastUserMsg.id, {
          mimeType,
          data,
        });
        log.info('handleUserMessageChunk: attachment added successfully');
      } else {
        log.info('handleUserMessageChunk: no UserMessage found, image chunk dropped');
      }
    } else {
      log.info(
        `handleUserMessageChunk: unknown content.type="${String(update.content.type)}" — skipped`,
      );
    }
  }

  /**
   * `agent_message_chunk` イベントを処理する。
   *
   * `content.type === 'text'` のとき、`status: 'streaming'` の最新エージェントメッセージへ
   * チャンクを追記する。ただし直前のメッセージが `tool_call` の場合は新しいエージェント
   * メッセージを作成する（ツール呼び出し後の返答を分離するため）。
   * streaming 中のメッセージが存在しない場合もフォールバックとして新規追加する。
   *
   * @param sessionId - セッション ID
   * @param update - `agent_message_chunk` イベントデータ
   */
  private handleAgentMessageChunk(sessionId: SessionId, update: ContentChunk): void {
    if (update.content.type !== 'text') return;

    const chunk = (update.content as Extract<ContentChunk['content'], { type: 'text' }>).text;

    const messages = this.messageRepository.getAll(sessionId);
    const shouldCreateNew = messages.at(-1)?.type === 'tool_call';

    const streamingMessage = shouldCreateNew
      ? undefined
      : messages.filter((m) => m.type === 'agent' && m.status === 'streaming').at(-1);

    if (streamingMessage) {
      this.messageRepository.appendAgentChunk(sessionId, streamingMessage.id, chunk);
    } else {
      const newMessage = this.messageRepository.addAgentMessage(sessionId, randomUUID());
      this.messageRepository.appendAgentChunk(sessionId, newMessage.id, chunk);
    }
  }

  /**
   * `tool_call` イベントを処理する。
   *
   * ツール呼び出しが来た時点で、streaming 中のエージェントメッセージを `completed` にする。
   * 同じ `toolCallId` のメッセージが未登録なら `addToolCall` を呼び、
   * 既存なら `updateToolCall` で `name` / `input` を更新する。
   *
   * @param sessionId - セッション ID
   * @param update - `tool_call` イベントデータ
   */
  private handleToolCall(sessionId: SessionId, update: ToolCall): void {
    // ツール呼び出し前の streaming メッセージを確定する
    this.completeStreamingMessages(sessionId);

    const { toolCallId, title, rawInput } = update;
    const existing = this.messageRepository
      .getAll(sessionId)
      .find((m) => m.type === 'tool_call' && m.id === toolCallId);

    if (existing) {
      this.messageRepository.updateToolCall(sessionId, toolCallId, {
        name: title,
        input: rawInput,
      });
    } else {
      this.messageRepository.addToolCall(sessionId, toolCallId, title, rawInput);
    }
  }

  /**
   * streaming 中のすべてのエージェントメッセージを `completed` に変更する。
   *
   * @param sessionId - セッション ID
   */
  private completeStreamingMessages(sessionId: SessionId): void {
    const streamingMessages = this.messageRepository
      .getAll(sessionId)
      .filter((m) => m.type === 'agent' && m.status === 'streaming');

    for (const msg of streamingMessages) {
      this.messageRepository.completeAgentMessage(sessionId, msg.id);
    }
  }

  /**
   * `tool_call_update` イベントを処理する。
   *
   * `status` と `rawOutput` を `updateToolCall` へ渡す。`rawOutput` が `undefined` の場合は `result` を更新しない。
   *
   * @param sessionId - セッション ID
   * @param update - `tool_call_update` イベントデータ
   */
  private handleToolCallUpdate(sessionId: SessionId, update: ToolCallUpdate): void {
    const { toolCallId, status, rawOutput } = update;
    this.messageRepository.updateToolCall(sessionId, toolCallId, {
      ...(status != null ? { status } : {}),
      ...(rawOutput !== undefined ? { result: JSON.stringify(rawOutput) } : {}),
    });
  }
}
