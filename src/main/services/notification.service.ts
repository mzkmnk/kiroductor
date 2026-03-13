import type { BrowserWindow } from 'electron';
import type { NotificationService } from '../acp/methods/session-update.method';

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
   * @param channel - IPC チャネル名
   * @param data - 送信するデータ（シリアライズ可能なプレーンオブジェクト）
   */
  sendToRenderer(channel: string, data: unknown): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send(channel, data);
  }
}
