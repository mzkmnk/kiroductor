import type { SessionService } from '../services/session.service';
import type { PromptService } from '../services/prompt.service';
import type { MessageRepository } from '../repositories/message.repository';
import type { SessionRepository } from '../repositories/session.repository';
import type { ConfigRepository } from '../repositories/config.repository';
import type { NotificationService } from '../interfaces/notification.service';
import { handle } from '../ipc';

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
   * @param configRepo - 設定・セッションマッピングを永続化するリポジトリ（依存注入）
   */
  constructor(
    private readonly sessionService: Pick<
      SessionService,
      'create' | 'cancel' | 'load' | 'setModel'
    >,
    private readonly promptService: Pick<PromptService, 'send'>,
    private readonly messageRepo: Pick<MessageRepository, 'getAll'>,
    private readonly sessionRepo: Pick<
      SessionRepository,
      | 'getActiveSessionId'
      | 'setActiveSession'
      | 'getAllSessionIds'
      | 'addProcessing'
      | 'removeProcessing'
      | 'getProcessingSessionIds'
      | 'isAcpConnected'
      | 'getModelState'
    >,
    private readonly notificationService: NotificationService,
    private readonly configRepo: Pick<ConfigRepository, 'readSessions'>,
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
   * - `session:all` — 管理中の全セッション ID を返す
   * - `session:list` — 永続化済みの全セッションマッピングを返す
   * - `session:is-acp-connected` — 指定セッションが ACP 接続済みかどうかを返す
   */
  register(): void {
    handle('session:new', (_event, cwd, currentBranch, sourceBranch) =>
      this.sessionService.create(cwd, currentBranch, sourceBranch),
    );
    handle('session:load', (_event, sessionId, cwd) => this.sessionService.load(sessionId, cwd));
    handle('session:prompt', async (_event, sessionId, text) => {
      this.sessionRepo.addProcessing(sessionId);
      try {
        const stopReason = await this.promptService.send(sessionId, text);
        return { stopReason };
      } finally {
        this.sessionRepo.removeProcessing(sessionId);
        this.notificationService.sendToRenderer('acp:prompt-completed', { sessionId });
      }
    });
    handle('session:cancel', (_event, sessionId) => {
      return this.sessionService.cancel(sessionId);
    });
    handle('session:messages', (_event, sessionId) => {
      return this.messageRepo.getAll(sessionId);
    });
    handle('session:switch', (_event, sessionId) => {
      this.sessionRepo.setActiveSession(sessionId);
      this.notificationService.sendToRenderer('acp:session-switched', { sessionId });
    });
    handle('session:active', () => {
      return this.sessionRepo.getActiveSessionId();
    });
    handle('session:all', () => {
      return this.sessionRepo.getAllSessionIds();
    });
    handle('session:list', () => {
      return this.configRepo.readSessions();
    });
    handle('session:processing-sessions', () => {
      return this.sessionRepo.getProcessingSessionIds();
    });
    handle('session:is-acp-connected', (_event, sessionId) => {
      return this.sessionRepo.isAcpConnected(sessionId);
    });
    handle('session:get-models', (_event, sessionId) => {
      return this.sessionRepo.getModelState(sessionId);
    });
    handle('session:set-model', async (_event, sessionId, modelId) => {
      await this.sessionService.setModel(sessionId, modelId);
      this.notificationService.sendToRenderer('acp:model-changed', { sessionId, modelId });
    });
  }
}
