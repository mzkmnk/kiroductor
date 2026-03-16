import type { AcpStatus } from '../main/repositories/connection.repository';
import type { Message } from '../main/repositories/message.repository';
import type {
  SessionNotification,
  SessionId,
  ToolCallUpdate,
  PermissionOptionId,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type {
  RepoMapping,
  KiroductorSettings,
  SessionMapping,
} from '../main/repositories/config.repository';

/** `git diff --shortstat` の解析結果。 */
export interface DiffStats {
  /** 変更されたファイル数 */
  filesChanged: number;
  /** 追加行数 */
  insertions: number;
  /** 削除行数 */
  deletions: number;
}

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
  'session:new': { args: [cwd: string, currentBranch: string, sourceBranch: string]; return: void };
  'session:load': { args: [sessionId: SessionId, cwd: string]; return: void };
  'session:prompt': { args: [text: string]; return: { stopReason: string } };
  'session:cancel': { args: []; return: void };
  'session:messages': { args: [sessionId?: SessionId]; return: Message[] };
  'session:switch': { args: [sessionId: SessionId]; return: void };
  'session:active': { args: []; return: SessionId | null };
  'session:all': { args: []; return: SessionId[] };
  'session:list': { args: []; return: SessionMapping[] };
  'repo:clone': { args: [url: string]; return: { repoId: string } };
  'repo:list': { args: []; return: RepoMapping[] };
  'repo:create-worktree': {
    args: [repoId: string, branch?: string];
    return: { cwd: string; branch: string; sourceBranch: string };
  };
  'repo:list-branches': { args: [repoId: string]; return: string[] };
  'repo:diff-stats': { args: [sessionId: string]; return: DiffStats | null };
  'config:get-settings': { args: []; return: KiroductorSettings };
  'config:update-settings': { args: [settings: Partial<KiroductorSettings>]; return: void };
}

/**
 * main → renderer の send/on チャネルマップ。
 *
 * キーはチャネル名。値はペイロード型。
 */
export interface IpcOnChannels {
  'acp:status-change': { status: AcpStatus; reason?: string };
  'acp:session-update': SessionNotification;
  'acp:session-loading': { loading: boolean };
  'acp:session-switched': { sessionId: SessionId };
  'acp:request-permission': {
    sessionId: SessionId;
    toolCall: ToolCallUpdate;
    selectedOptionId: PermissionOptionId;
  };
}
