import type { AcpConnectionService } from './acp-connection.service';
import { handle } from '../../shared/ipc';

/**
 * ACP 接続の開始・終了・状態確認を IPC 経由で受け付けるハンドラー。
 *
 * `register()` を呼ぶことで `ipcMain` に各チャンネルを登録する。
 */
export class AcpHandler {
  /**
   * @param acpConnectionService - ACP 接続のライフサイクルを管理するサービス（依存注入）
   */
  constructor(
    private readonly acpConnectionService: Pick<
      AcpConnectionService,
      'start' | 'stop' | 'getStatus'
    >,
  ) {}

  /**
   * ACP 関連の IPC チャンネルを `ipcMain` に登録する。
   *
   * 登録するチャンネル:
   * - `acp:start` — ACP 接続を開始する
   * - `acp:stop` — ACP 接続を終了する
   * - `acp:status` — 現在の接続状態を返す
   */
  register(): void {
    handle('acp:start', () => this.acpConnectionService.start());
    handle('acp:stop', () => this.acpConnectionService.stop());
    handle('acp:status', () => this.acpConnectionService.getStatus());
  }
}
