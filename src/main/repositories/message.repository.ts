import { randomUUID } from 'crypto';

/** ユーザーが入力したテキストメッセージ */
export type UserMessage = {
  /** メッセージの一意識別子 */
  id: string;
  /** メッセージ種別 */
  type: 'user';
  /** 入力テキスト */
  text: string;
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
  /** 実行状態。`'running'`: 実行中、`'completed'`: 完了、`'error'`: エラー */
  status: 'running' | 'completed' | 'error';
  /** ツール実行結果（完了後に設定される） */
  result?: string;
};

/** チャット上のメッセージを表すユニオン型 */
export type Message = UserMessage | AgentMessage | ToolCallMessage;

/**
 * チャット上のメッセージ一覧をインメモリで管理するリポジトリ。
 *
 * ユーザーメッセージ・エージェントメッセージ・ツール呼び出しを追加順に保持する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class MessageRepository {
  private messages: Message[] = [];

  /**
   * ユーザーが入力したメッセージを追加する。
   *
   * @param text - ユーザーが入力したテキスト
   * @returns 追加された {@link UserMessage}
   */
  addUserMessage(text: string): UserMessage {
    const message: UserMessage = {
      id: randomUUID(),
      type: 'user',
      text,
    };
    this.messages.push(message);
    return message;
  }

  /**
   * エージェントの返答メッセージを追加する（ストリーミング開始）。
   *
   * 追加直後の `status` は `'streaming'`、`text` は空文字列。
   *
   * @param id - メッセージの一意識別子（ACP プロトコルから受け取った ID）
   * @returns 追加された {@link AgentMessage}
   */
  addAgentMessage(id: string): AgentMessage {
    const message: AgentMessage = {
      id,
      type: 'agent',
      text: '',
      status: 'streaming',
    };
    this.messages.push(message);
    return message;
  }

  /**
   * ストリーミング中のエージェントメッセージにテキストチャンクを追記する。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param id - 対象メッセージの ID
   * @param chunk - 追記するテキストチャンク
   */
  appendAgentChunk(id: string, chunk: string): void {
    const message = this.messages.find((m) => m.id === id && m.type === 'agent') as
      | AgentMessage
      | undefined;
    if (message) {
      message.text += chunk;
    }
  }

  /**
   * ストリーミング完了時にエージェントメッセージを確定状態にする。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param id - 対象メッセージの ID
   */
  completeAgentMessage(id: string): void {
    const message = this.messages.find((m) => m.id === id && m.type === 'agent') as
      | AgentMessage
      | undefined;
    if (message) {
      message.status = 'completed';
    }
  }

  /**
   * エージェントが実行しているツール呼び出しを追加する。
   *
   * 追加直後の `status` は `'running'`。
   *
   * @param id - ツール呼び出しの一意識別子（ACP プロトコルから受け取った ID）
   * @param name - ツール名
   * @param input - ツールへの入力パラメータ
   * @returns 追加された {@link ToolCallMessage}
   */
  addToolCall(id: string, name: string, input: unknown): ToolCallMessage {
    const message: ToolCallMessage = {
      id,
      type: 'tool_call',
      name,
      input,
      status: 'running',
    };
    this.messages.push(message);
    return message;
  }

  /**
   * ツール呼び出しの結果・状態を更新する。
   *
   * 指定した `id` のメッセージが存在しない場合は何もしない。
   *
   * @param id - 対象ツール呼び出しの ID
   * @param update - 更新する値（`status`・`result` の部分更新）
   */
  updateToolCall(
    id: string,
    update: Partial<Pick<ToolCallMessage, 'status' | 'result'>>,
  ): void {
    const message = this.messages.find((m) => m.id === id && m.type === 'tool_call') as
      | ToolCallMessage
      | undefined;
    if (message) {
      if (update.status !== undefined) {
        message.status = update.status;
      }
      if (update.result !== undefined) {
        message.result = update.result;
      }
    }
  }

  /**
   * メッセージ一覧を全件取得する。
   *
   * @returns 追加順のメッセージ配列（内部配列のコピー）
   */
  getAll(): Message[] {
    return [...this.messages];
  }

  /**
   * メッセージ一覧をリセットする。
   */
  clear(): void {
    this.messages = [];
  }
}
