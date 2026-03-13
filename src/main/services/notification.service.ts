import type { BrowserWindow } from 'electron';
import type { NotificationService } from '../acp/methods/session-update.method';
import type { IpcOnChannels } from '../../shared/ipc';

/**
 * メインプロセスからレンダラー（画面）へ通知を送るサービス。
 *
 * `BrowserWindow.webContents.send()` をラップし、ウィンドウが存在しない・
 * 破棄済みの場合は安全に何もしない。
 */
export class ElectronNotificationService implements NotificationService {
  /**
   * @param getWindow - 現在の {@link BrowserWindow} を返すゲッター。
   *   ウィンドウが存在しない場合は `null` を返す。
   */
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  /**
   * 指定チャネルでレンダラーへデータを送信する。
   *
   * ウィンドウが存在しない・破棄済みの場合は何もしない。
   *
   * @param channel - IPC チャネル名（{@link IpcOnChannels} のキー）
   * @param data - 送信するペイロード（チャネルに対応した型）
   */
  sendToRenderer<K extends keyof IpcOnChannels>(channel: K, data: IpcOnChannels[K]): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send(channel, data);
  }
}
