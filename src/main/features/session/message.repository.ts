import { randomUUID } from 'crypto';
import type { ToolCallStatus } from '@agentclientprotocol/sdk';
import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { ImageAttachment } from '../../../shared/ipc';

/** ユーザーが入力したテキストメッセージ */
export type UserMessage = {
  /** メッセージの一意識別子 */
  id: string;
  /** メッセージ種別 */
  type: 'user';
  /** 入力テキスト */
  text: string;
  /** 添付画像一覧（画像なしの場合は `undefined`） */
  attachments?: ImageAttachment[];
};

/** エージェントの返答メッセージ */
export type AgentMessage = {
  /** メッセージの一意識別子 */
  id: string;
  /** メッセージ種別 */
  type: 'agent';
  /** 返答テキスト（ストリーミング中は逐次追記される） */
  text: string;
  /** ストリーミング状態。`'streaming'`: 受信中、`'completed'`: 確定済み */
  status: 'streaming' | 'completed';
};

/** エージェントが実行するツール呼び出し */
export type ToolCallMessage = {
  /** ツール呼び出しの一意識別子（ACP プロトコルから受け取った ID） */
  id: string;
  /** メッセージ種別 */
  type: 'tool_call';
  /** ツール名 */
  name: string;
  /** ツールへの入力パラメータ */
  input: unknown;
  /** 実行状態。SDK の {@link ToolCallStatus} をそのまま使用する */
  status: ToolCallStatus;
  /** ツール実行結果（完了後に設定される） */
  result?: string;
};

/** チャット上のメッセージを表すユニオン型 */
export type Message = UserMessage | AgentMessage | ToolCallMessage;

/**
 * メッセージ配列から `id` と `type` に一致するメッセージを返す。
 *
 * @param messages - 検索対象のメッセージ配列
 * @param id - 検索対象のメッセージ ID
 * @param type - メッセージ種別
 * @returns 一致するメッセージ、存在しない場合は `undefined`
 */
function findByType<T extends Message['type']>(
  messages: Message[],
  id: string,
  type: T,
): Extract<Message, { type: T }> | undefined {
  return messages.find((m) => m.id === id && m.type === type) as
    | Extract<Message, { type: T }>
    | undefined;
}

/**
 * チャット上のメッセージ一覧をインメモリで管理するリポジトリ。
 *
 * セッションごとにメッセージを分離して保持する。
 * ユーザーメッセージ・エージェントメッセージ・ツール呼び出しを追加順に保持する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class MessageRepository {
  /** セッション ID をキー、メッセージ配列を値とする Map */
  private sessions: Map<SessionId, Message[]> = new Map();

  /**
   * 指定セッション用の空メッセージ配列を初期化する。
   *
   * 既に存在する場合は上書きしない。
   *
   * @param sessionId - セッション ID
   */
  initSession(sessionId: SessionId): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
  }

  /**
   * 指定セッションのメッセージをクリアする。
   *
   * @param sessionId - セッション ID
   */
  clearSession(sessionId: SessionId): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 指定セッションのメッセージ配列を取得する。存在しなければ空配列を返す。
   *
   * @param sessionId - セッション ID
   * @returns メッセージ配列への参照
   */
  private getMessages(sessionId: SessionId): Message[] {
    let messages = this.sessions.get(sessionId);
    if (!messages) {
      messages = [];
      this.sessions.set(sessionId, messages);
    }
    return messages;
  }

  /**
   * ユーザーが入力したメッセージを追加する。
   *
   * @param sessionId - セッション ID
   * @param text - ユーザーが入力したテキスト
   * @param attachments - 添付画像一覧（省略可）
   * @returns 追加された {@link UserMessage}
   */
  addUserMessage(sessionId: SessionId, text: string, attachments?: ImageAttachment[]): UserMessage {
    const message: UserMessage = {
      id: randomUUID(),
      type: 'user',
      text,
      ...(attachments ? { attachments } : {}),
    };
    this.getMessages(sessionId).push(message);
    return message;
  }

  /**
   * エージェントの返答メッセージを追加する（ストリーミング開始）。
   *
   * 追加直後の `status` は `'streaming'`、`text` は空文字列。
   *
   * @param sessionId - セッション ID
   * @param id - メッセージの一意識別子（ACP プロトコルから受け取った ID）
   * @returns 追加された {@link AgentMessage}
   */
  addAgentMessage(sessionId: SessionId, id: string): AgentMessage {
    const message: AgentMessage = {
      id,
      type: 'agent',
      text: '',
      status: 'streaming',
    };
    this.getMessages(sessionId).push(message);
    return message;
  }

  /**
   * ストリーミング中のエージェントメッセージにテキストチャンクを追記する。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param sessionId - セッション ID
   * @param id - 対象メッセージの ID
   * @param chunk - 追記するテキストチャンク
   */
  appendAgentChunk(sessionId: SessionId, id: string, chunk: string): void {
    const message = findByType(this.getMessages(sessionId), id, 'agent');
    if (message) {
      message.text += chunk;
    }
  }

  /**
   * ストリーミング完了時にエージェントメッセージを確定状態にする。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param sessionId - セッション ID
   * @param id - 対象メッセージの ID
   */
  completeAgentMessage(sessionId: SessionId, id: string): void {
    const message = findByType(this.getMessages(sessionId), id, 'agent');
    if (message) {
      message.status = 'completed';
    }
  }

  /**
   * エージェントが実行しているツール呼び出しを追加する。
   *
   * 追加直後の `status` は `'running'`。
   *
   * @param sessionId - セッション ID
   * @param id - ツール呼び出しの一意識別子（ACP プロトコルから受け取った ID）
   * @param name - ツール名
   * @param input - ツールへの入力パラメータ
   * @returns 追加された {@link ToolCallMessage}
   */
  addToolCall(sessionId: SessionId, id: string, name: string, input: unknown): ToolCallMessage {
    const message: ToolCallMessage = {
      id,
      type: 'tool_call',
      name,
      input,
      status: 'in_progress',
    };
    this.getMessages(sessionId).push(message);
    return message;
  }

  /**
   * ツール呼び出しの結果・状態・名前・入力パラメータを更新する。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param sessionId - セッション ID
   * @param id - 対象ツール呼び出しの ID
   * @param update - 更新する値（`status`・`result`・`name`・`input` の部分更新）
   */
  updateToolCall(
    sessionId: SessionId,
    id: string,
    update: Partial<Pick<ToolCallMessage, 'status' | 'result' | 'name' | 'input'>>,
  ): void {
    const message = findByType(this.getMessages(sessionId), id, 'tool_call');
    if (message) {
      if (update.status !== undefined) {
        message.status = update.status;
      }
      if (update.result !== undefined) {
        message.result = update.result;
      }
      if (update.name !== undefined) {
        message.name = update.name;
      }
      if (update.input !== undefined) {
        message.input = update.input;
      }
    }
  }

  /**
   * 指定セッションのメッセージ一覧を全件取得する。
   *
   * @param sessionId - セッション ID
   * @returns 追加順のメッセージ配列（内部配列のコピー）
   */
  getAll(sessionId: SessionId): Message[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  /**
   * 全セッションのメッセージをクリアする。
   */
  clear(): void {
    this.sessions.clear();
  }
}
