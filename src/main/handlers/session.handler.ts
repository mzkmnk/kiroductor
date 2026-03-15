import type { SessionService } from '../services/session.service';
import type { PromptService } from '../services/prompt.service';
import type { MessageRepository } from '../repositories/message.repository';
import type { SessionRepository } from '../repositories/session.repository';
import type { IpcOnChannels } from '../../shared/ipc';
import { handle } from '../ipc';

/** レンダラーへ通知を送信するサービスの最小インターフェース。依存注入・テスト用。 */
export interface NotificationService {
  /** 指定チャネルでレンダラーへデータを送信する。 */
  sendToRenderer<K extends keyof IpcOnChannels>(channel: K, data: IpcOnChannels[K]): void;
}

/**
 * セッション操作を IPC 経由で受け付けるハンドラー。
 *
 * `register()` を呼ぶことで `ipcMain` に各チャンネルを登録する。
 */
export class SessionHandler {
  /**
   * @param sessionService - セッションのライフサイクルを管理するサービス（依存注入）
   * @param promptService - ユーザー入力をエージェントへ送るサービス（依存注入）
   * @param messageRepo - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param sessionRepo - セッション状態を管理するリポジトリ（依存注入）
   * @param notificationService - レンダラーへ通知を送るサービス（依存注入）
   */
  constructor(
    private readonly sessionService: Pick<SessionService, 'create' | 'cancel' | 'load'>,
    private readonly promptService: Pick<PromptService, 'send'>,
    private readonly messageRepo: Pick<MessageRepository, 'getAll'>,
    private readonly sessionRepo: Pick<
      SessionRepository,
      'getActiveSessionId' | 'setActiveSession'
    >,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * セッション関連の IPC チャンネルを `ipcMain` に登録する。
   *
   * 登録するチャンネル:
   * - `session:new` — 作業ディレクトリを受け取り新規セッションを開始する
   * - `session:load` — 既存セッションを復元する
   * - `session:prompt` — ユーザーテキストをエージェントへ送信する
   * - `session:cancel` — 実行中のセッションをキャンセルする
   * - `session:messages` — メッセージ一覧を返す（セッション ID 指定可）
   * - `session:switch` — アクティブセッションを切り替える
   * - `session:active` — 現在のアクティブセッション ID を返す
   */
  register(): void {
    handle('session:new', (_event, cwd) => this.sessionService.create(cwd));
    handle('session:load', (_event, sessionId, cwd) => this.sessionService.load(sessionId, cwd));
    handle('session:prompt', async (_event, text) => {
      const sessionId = this.sessionRepo.getActiveSessionId();
      if (!sessionId) throw new Error('No active session');
      const stopReason = await this.promptService.send(sessionId, text);
      return { stopReason };
    });
    handle('session:cancel', () => this.sessionService.cancel());
    handle('session:messages', (_event, sessionId?) => {
      const targetSessionId = sessionId ?? this.sessionRepo.getActiveSessionId();
      return targetSessionId ? this.messageRepo.getAll(targetSessionId) : [];
    });
    handle('session:switch', (_event, sessionId) => {
      this.sessionRepo.setActiveSession(sessionId);
      this.notificationService.sendToRenderer('acp:session-switched', { sessionId });
    });
    handle('session:active', () => {
      return this.sessionRepo.getActiveSessionId();
    });
  }
}
