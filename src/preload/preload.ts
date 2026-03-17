import { contextBridge, ipcRenderer } from 'electron';
import type { AcpStatus } from '../main/repositories/connection.repository';
import type { Message } from '../main/repositories/message.repository';
import type {
  RepoMapping,
  KiroductorSettings,
  SessionMapping,
} from '../main/repositories/config.repository';
import type { SessionId, SessionNotification } from '@agentclientprotocol/sdk/dist/schema/index';
import type { DiffStats, SessionModelState, IpcInvokeChannels, IpcOnChannels } from '../shared/ipc';

/**
 * 型付き `ipcRenderer.invoke` ヘルパー。
 *
 * チャネル名・引数・戻り値を {@link IpcInvokeChannels} で制約する。
 */
function invoke<K extends keyof IpcInvokeChannels>(
  channel: K,
  ...args: IpcInvokeChannels[K]['args']
): Promise<IpcInvokeChannels[K]['return']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcInvokeChannels[K]['return']>;
}

/**
 * 型付き `ipcRenderer.on` ヘルパー。
 *
 * チャネル名・ペイロード型を {@link IpcOnChannels} で制約し、
 * 購読解除関数を返す。
 */
function typedOn<K extends keyof IpcOnChannels>(
  channel: K,
  listener: (_event: Electron.IpcRendererEvent, data: IpcOnChannels[K]) => void,
): () => void {
  ipcRenderer.on(channel, listener as Parameters<typeof ipcRenderer.on>[1]);
  return () => {
    ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1]);
  };
}

/**
 * レンダラーに公開する ACP 接続操作 API。
 */
export interface AcpAPI {
  /** ACP 接続を開始する。 */
  start: () => Promise<void>;
  /** ACP 接続を終了する。 */
  stop: () => Promise<void>;
  /** 現在の接続ステータスを取得する。 */
  getStatus: () => Promise<AcpStatus>;
  /**
   * ACP 接続状態の変化を購読する。
   *
   * @param callback - 新しいステータスを受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onStatusChange: (
    callback: (payload: { status: AcpStatus; reason?: string }) => void,
  ) => () => void;
}

/**
 * レンダラーに公開するセッション操作 API。
 */
export interface SessionAPI {
  /** 指定した作業ディレクトリで新規セッションを作成する。 */
  create: (cwd: string, currentBranch: string, sourceBranch: string) => Promise<void>;
  /** 既存セッションを指定した作業ディレクトリで復元する。 */
  load: (sessionId: SessionId, cwd: string) => Promise<void>;
  /** ユーザーテキストをエージェントへ送信する。 */
  prompt: (text: string, sessionId: SessionId) => Promise<{ stopReason: string }>;
  /** 実行中のセッションをキャンセルする。 */
  cancel: (sessionId: SessionId) => Promise<void>;
  /** メッセージ一覧を取得する。 */
  getMessages: (sessionId: SessionId) => Promise<Message[]>;
  /** 処理中の全セッション ID を取得する。 */
  getProcessingSessions: () => Promise<SessionId[]>;
  /** アクティブセッションを切り替える。 */
  switch: (sessionId: SessionId) => Promise<void>;
  /** 現在のアクティブセッション ID を取得する。 */
  getActive: () => Promise<SessionId | null>;
  /** 管理中の全セッション ID を取得する。 */
  getAll: () => Promise<SessionId[]>;
  /** 永続化済みの全セッションマッピングを取得する。 */
  list: () => Promise<SessionMapping[]>;
  /** 指定セッションが ACP 接続済みかどうかを返す。 */
  isAcpConnected: (sessionId: SessionId) => Promise<boolean>;
  /** セッションのモデル状態を取得する。 */
  getModels: (sessionId: SessionId) => Promise<SessionModelState>;
  /** セッションのモデルを切り替える。 */
  setModel: (sessionId: SessionId, modelId: string) => Promise<void>;
  /**
   * モデル変更通知を購読する。
   *
   * @param callback - 変更されたセッション ID とモデル ID を受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onModelChanged: (
    callback: (payload: { sessionId: SessionId; modelId: string }) => void,
  ) => () => void;
  /**
   * セッション更新通知を購読する。
   *
   * @param callback - 通知を受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onUpdate: (callback: (update: SessionNotification) => void) => () => void;
  /**
   * セッション復元中状態の変化を購読する。
   *
   * @param callback - `{ loading: boolean }` を受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onSessionLoading: (callback: (payload: { loading: boolean }) => void) => () => void;
  /**
   * セッション切り替え通知を購読する。
   *
   * @param callback - 切り替え先のセッション ID を含むペイロードを受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onSessionSwitched: (callback: (payload: { sessionId: SessionId }) => void) => () => void;
  /**
   * プロンプト完了通知を購読する。
   *
   * @param callback - 完了したセッション ID を含むペイロードを受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onPromptCompleted: (callback: (payload: { sessionId: SessionId }) => void) => () => void;
}

/**
 * レンダラーに公開するリポジトリ操作 API。
 */
export interface RepoAPI {
  /** リポジトリを bare clone し、`repoId` を返す。 */
  clone: (url: string) => Promise<{ repoId: string }>;
  /** クローン済みリポジトリの一覧を返す。 */
  list: () => Promise<RepoMapping[]>;
  /** bare repo から worktree を作成し、`cwd`・作業ブランチ名・ベースブランチ名を返す。 */
  createWorktree: (
    repoId: string,
    branch?: string,
  ) => Promise<{ cwd: string; branch: string; sourceBranch: string }>;
  /** 指定リポジトリのリモートブランチ一覧を返す。 */
  listBranches: (repoId: string) => Promise<string[]>;
  /** 指定セッションの git diff 統計情報を取得する。 */
  getDiffStats: (sessionId: string) => Promise<DiffStats | null>;
  /** 指定セッションの unified diff 本文を取得する。 */
  getDiff: (sessionId: string) => Promise<string | null>;
}

/**
 * レンダラーに公開するアプリ設定 API。
 */
export interface ConfigAPI {
  /** アプリ設定を取得する。 */
  getSettings: () => Promise<KiroductorSettings>;
  /** アプリ設定を部分更新する。 */
  updateSettings: (settings: Partial<KiroductorSettings>) => Promise<void>;
}

/**
 * `window.kiroductor` として公開される型付き API。
 *
 * レンダラーはこのインターフェースを通じてメインプロセスと通信する。
 * `ipcRenderer` は直接公開しない（セキュリティのため）。
 */
export interface KiroductorAPI {
  /** ACP 接続管理 API。 */
  acp: AcpAPI;
  /** セッション操作 API。 */
  session: SessionAPI;
  /** リポジトリ操作 API。 */
  repo: RepoAPI;
  /** アプリ設定 API。 */
  config: ConfigAPI;
}

const kiroductorAPI: KiroductorAPI = {
  acp: {
    start: () => invoke('acp:start'),
    stop: () => invoke('acp:stop'),
    getStatus: () => invoke('acp:status'),
    onStatusChange: (callback) =>
      typedOn('acp:status-change', (_event, payload) => callback(payload)),
  },
  session: {
    create: (cwd, currentBranch, sourceBranch) =>
      invoke('session:new', cwd, currentBranch, sourceBranch),
    load: (sessionId, cwd) => invoke('session:load', sessionId, cwd),
    prompt: (text, sessionId) => invoke('session:prompt', sessionId, text),
    cancel: (sessionId) => invoke('session:cancel', sessionId),
    getMessages: (sessionId) => invoke('session:messages', sessionId),
    getProcessingSessions: () => invoke('session:processing-sessions'),
    switch: (sessionId) => invoke('session:switch', sessionId),
    getActive: () => invoke('session:active'),
    getAll: () => invoke('session:all'),
    list: () => invoke('session:list'),
    isAcpConnected: (sessionId) => invoke('session:is-acp-connected', sessionId),
    getModels: (sessionId) => invoke('session:get-models', sessionId),
    setModel: (sessionId, modelId) => invoke('session:set-model', sessionId, modelId),
    onModelChanged: (callback) =>
      typedOn('acp:model-changed', (_event, payload) => callback(payload)),
    onUpdate: (callback) => typedOn('acp:session-update', (_event, update) => callback(update)),
    onSessionLoading: (callback) =>
      typedOn('acp:session-loading', (_event, payload) => callback(payload)),
    onSessionSwitched: (callback) =>
      typedOn('acp:session-switched', (_event, payload) => callback(payload)),
    onPromptCompleted: (callback) =>
      typedOn('acp:prompt-completed', (_event, payload) => callback(payload)),
  },
  repo: {
    clone: (url) => invoke('repo:clone', url),
    list: () => invoke('repo:list'),
    createWorktree: (repoId, branch) => invoke('repo:create-worktree', repoId, branch),
    listBranches: (repoId) => invoke('repo:list-branches', repoId),
    getDiffStats: (sessionId) => invoke('repo:diff-stats', sessionId),
    getDiff: (sessionId) => invoke('repo:diff', sessionId),
  },
  config: {
    getSettings: () => invoke('config:get-settings'),
    updateSettings: (settings) => invoke('config:update-settings', settings),
  },
};

contextBridge.exposeInMainWorld('kiroductor', kiroductorAPI);
