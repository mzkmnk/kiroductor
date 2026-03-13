import { contextBridge, ipcRenderer } from 'electron';
import type { AcpStatus } from '../main/repositories/connection.repository';
import type { Message } from '../main/repositories/message.repository';
import type { SessionNotification } from '@agentclientprotocol/sdk/dist/schema/index';
import type { IpcInvokeChannels, IpcOnChannels } from '../shared/ipc';

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
  create: (cwd: string) => Promise<void>;
  /** ユーザーテキストをエージェントへ送信する。 */
  prompt: (text: string) => Promise<{ stopReason: string }>;
  /** 実行中のセッションをキャンセルする。 */
  cancel: () => Promise<void>;
  /** メッセージ一覧を取得する。 */
  getMessages: () => Promise<Message[]>;
  /**
   * セッション更新通知を購読する。
   *
   * @param callback - 通知を受け取るコールバック
   * @returns 購読を解除するクリーンアップ関数
   */
  onUpdate: (callback: (update: SessionNotification) => void) => () => void;
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
    create: (cwd) => invoke('session:new', cwd),
    prompt: (text) => invoke('session:prompt', text),
    cancel: () => invoke('session:cancel'),
    getMessages: () => invoke('session:messages'),
    onUpdate: (callback) => typedOn('acp:session-update', (_event, update) => callback(update)),
  },
};

contextBridge.exposeInMainWorld('kiroductor', kiroductorAPI);
