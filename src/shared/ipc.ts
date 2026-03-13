import type { AcpStatus } from '../main/repositories/connection.repository';
import type { Message } from '../main/repositories/message.repository';
import type { SessionNotification } from '@agentclientprotocol/sdk/dist/schema/index';

/**
 * renderer → main の invoke/handle チャネルマップ。
 *
 * キーはチャネル名。値は `{ args: タプル; return: 型 }` 形式。
 * `args` の型はハンドラー・呼び出し元の残余引数タプルとして使用される。
 */
export interface IpcInvokeChannels {
  'acp:start': { args: []; return: void };
  'acp:stop': { args: []; return: void };
  'acp:status': { args: []; return: AcpStatus };
  'session:new': { args: [cwd: string]; return: { sessionId: string } };
  'session:prompt': { args: [text: string]; return: { stopReason: string } };
  'session:cancel': { args: []; return: void };
  'session:messages': { args: []; return: Message[] };
}

/**
 * main → renderer の send/on チャネルマップ。
 *
 * キーはチャネル名。値はペイロード型。
 */
export interface IpcOnChannels {
  'acp:status-change': { status: AcpStatus; reason?: string };
  'acp:session-update': SessionNotification;
}
