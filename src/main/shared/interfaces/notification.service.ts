import type { IpcOnChannels } from '../../../shared/ipc';

/** レンダラーへ通知を送信するサービスの最小インターフェース。依存注入・テスト用。 */
export interface NotificationService {
  /**
   * 指定チャネルでレンダラーへデータを送信する。
   *
   * @param channel - IPC チャネル名（{@link IpcOnChannels} のキー）
   * @param data - 送信するペイロード（チャネルに対応した型）
   */
  sendToRenderer<K extends keyof IpcOnChannels>(channel: K, data: IpcOnChannels[K]): void;
}
