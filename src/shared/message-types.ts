import type { ToolCallStatus } from '@agentclientprotocol/sdk';
import type { ImageAttachment } from './ipc';

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

/** {@link UserMessage} かどうかを判定するユーザー定義型ガード。 */
export function isUserMessage(message: Message): message is UserMessage {
  return message.type === 'user';
}

/** {@link AgentMessage} かどうかを判定するユーザー定義型ガード。 */
export function isAgentMessage(message: Message): message is AgentMessage {
  return message.type === 'agent';
}
