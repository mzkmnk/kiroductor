import type { AcpStatus } from '../main/features/acp-connection/connection.repository';
import type { Message } from './message-types';
import type {
  SessionNotification,
  SessionId,
  ToolCallUpdate,
  PermissionOptionId,
  SessionModelState,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type {
  RepoMapping,
  KiroductorSettings,
  SessionMapping,
} from '../main/features/config/config.repository';

/** エージェントに送信する画像添付データ。 */
export interface ImageAttachment {
  /** MIME タイプ（例: `"image/png"`, `"image/jpeg"`） */
  mimeType: string;
  /** Base64 エンコード済み画像データ */
  data: string;
}

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
  'session:prompt': {
    args: [sessionId: SessionId, text: string, images?: ImageAttachment[]];
    return: { stopReason: string };
  };
  'session:cancel': { args: [sessionId: SessionId]; return: void };
  'session:processing-sessions': { args: []; return: SessionId[] };
  'session:is-acp-connected': { args: [sessionId: SessionId]; return: boolean };
  'session:messages': { args: [sessionId: SessionId]; return: Message[] };
  'session:switch': { args: [sessionId: SessionId]; return: void };
  'session:active': { args: []; return: SessionId | null };
  'session:all': { args: []; return: SessionId[] };
  'session:list': { args: []; return: SessionMapping[] };
  'session:get-models': { args: [sessionId: SessionId]; return: SessionModelState };
  'session:set-model': { args: [sessionId: SessionId, modelId: string]; return: void };
  'repo:clone': { args: [url: string]; return: { repoId: string } };
  'repo:list': { args: []; return: RepoMapping[] };
  'repo:create-worktree': {
    args: [repoId: string, branch?: string];
    return: { cwd: string; branch: string; sourceBranch: string };
  };
  'repo:list-branches': { args: [repoId: string]; return: string[] };
  'repo:diff-stats': { args: [sessionId: string]; return: DiffStats | null };
  'repo:diff': { args: [sessionId: string]; return: string | null };
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
  'acp:prompt-completed': { sessionId: SessionId };
  'acp:model-changed': { sessionId: SessionId; modelId: string };
  'acp:request-permission': {
    sessionId: SessionId;
    toolCall: ToolCallUpdate;
    selectedOptionId: PermissionOptionId;
  };
}
