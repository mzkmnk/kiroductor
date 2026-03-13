import { contextBridge, ipcRenderer } from 'electron';
import type { AcpStatus } from '../main/repositories/connection.repository';
import type { Message } from '../main/repositories/message.repository';
import type { SessionNotification } from '@agentclientprotocol/sdk/dist/schema/index';

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
  create: (cwd: string) => Promise<{ sessionId: string }>;
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
    start: () => ipcRenderer.invoke('acp:start') as Promise<void>,
    stop: () => ipcRenderer.invoke('acp:stop') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('acp:status') as Promise<AcpStatus>,
    onStatusChange: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { status: AcpStatus; reason?: string },
      ) => {
        callback(payload);
      };
      ipcRenderer.on('acp:status-change', listener);
      return () => {
        ipcRenderer.removeListener('acp:status-change', listener);
      };
    },
  },
  session: {
    create: (cwd) => ipcRenderer.invoke('session:new', cwd) as Promise<{ sessionId: string }>,
    prompt: (text) => ipcRenderer.invoke('session:prompt', text) as Promise<{ stopReason: string }>,
    cancel: () => ipcRenderer.invoke('session:cancel') as Promise<void>,
    getMessages: () => ipcRenderer.invoke('session:messages') as Promise<Message[]>,
    onUpdate: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, update: SessionNotification) => {
        callback(update);
      };
      ipcRenderer.on('acp:session-update', listener);
      return () => {
        ipcRenderer.removeListener('acp:session-update', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('kiroductor', kiroductorAPI);
