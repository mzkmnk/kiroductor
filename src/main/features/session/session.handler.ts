import type { SessionService } from './session.service';
import type { PromptService } from './prompt.service';
import type { NotificationService } from '../../shared/interfaces/notification.service';
import { handle } from '../../shared/ipc';
import { createDebugLogger } from '../../shared/debug-logger';

const log = createDebugLogger('SessionHandler');

/**
 * セッション操作を IPC 経由で受け付けるハンドラー。
 *
 * `register()` を呼ぶことで `ipcMain` に各チャンネルを登録する。
 */
export class SessionHandler {
  /**
   * @param sessionService - セッションのライフサイクルを管理するサービス（依存注入）
   * @param promptService - ユーザー入力をエージェントへ送るサービス（依存注入）
   * @param notificationService - レンダラーへ通知を送るサービス（依存注入）
   */
  constructor(
    private readonly sessionService: Pick<
      SessionService,
      | 'create'
      | 'cancel'
      | 'load'
      | 'setModel'
      | 'getModelState'
      | 'setMode'
      | 'getModeState'
      | 'getContextUsagePercentage'
      | 'getMessages'
      | 'switchSession'
      | 'getActiveSessionId'
      | 'getAllSessionIds'
      | 'listSessions'
      | 'getProcessingSessionIds'
      | 'isAcpConnected'
      | 'addProcessing'
      | 'removeProcessing'
    >,
    private readonly promptService: Pick<PromptService, 'send'>,
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
   * - `session:all` — 管理中の全セッション ID を返す
   * - `session:list` — 永続化済みの全セッションマッピングを返す
   * - `session:is-acp-connected` — 指定セッションが ACP 接続済みかどうかを返す
   */
  register(): void {
    handle('session:new', (_event, cwd, currentBranch, sourceBranch) =>
      this.sessionService.create(cwd, currentBranch, sourceBranch),
    );
    handle('session:load', (_event, sessionId, cwd) => this.sessionService.load(sessionId, cwd));
    handle('session:prompt', async (_event, sessionId, text, images) => {
      this.sessionService.addProcessing(sessionId);
      try {
        const stopReason = await this.promptService.send(sessionId, text, images);
        return { stopReason };
      } finally {
        this.sessionService.removeProcessing(sessionId);
        this.notificationService.sendToRenderer('acp:prompt-completed', { sessionId });
      }
    });
    handle('session:cancel', (_event, sessionId) => {
      return this.sessionService.cancel(sessionId);
    });
    handle('session:messages', (_event, sessionId) => {
      return this.sessionService.getMessages(sessionId);
    });
    handle('session:switch', (_event, sessionId) => {
      this.sessionService.switchSession(sessionId);
      this.notificationService.sendToRenderer('acp:session-switched', { sessionId });
    });
    handle('session:active', () => {
      return this.sessionService.getActiveSessionId();
    });
    handle('session:all', () => {
      return this.sessionService.getAllSessionIds();
    });
    handle('session:list', () => {
      return this.sessionService.listSessions();
    });
    handle('session:processing-sessions', () => {
      return this.sessionService.getProcessingSessionIds();
    });
    handle('session:is-acp-connected', (_event, sessionId) => {
      return this.sessionService.isAcpConnected(sessionId);
    });
    handle('session:get-models', (_event, sessionId) => {
      log.info(`session:get-models sessionId=${sessionId}`);
      return this.sessionService.getModelState(sessionId);
    });
    handle('session:set-model', async (_event, sessionId, modelId) => {
      log.info(`session:set-model sessionId=${sessionId} modelId=${modelId}`);
      await this.sessionService.setModel(sessionId, modelId);
      this.notificationService.sendToRenderer('acp:model-changed', { sessionId, modelId });
      log.info(`session:set-model 完了 → acp:model-changed 通知済み`);
    });
    handle('session:get-modes', (_event, sessionId) => {
      log.info(`session:get-modes sessionId=${sessionId}`);
      return this.sessionService.getModeState(sessionId);
    });
    handle('session:set-mode', async (_event, sessionId, modeId) => {
      log.info(`session:set-mode sessionId=${sessionId} modeId=${modeId}`);
      await this.sessionService.setMode(sessionId, modeId);
      this.notificationService.sendToRenderer('acp:mode-changed', { sessionId, modeId });
      log.info(`session:set-mode 完了 → acp:mode-changed 通知済み`);
    });
    handle('session:get-context-usage', (_event, sessionId) => {
      return this.sessionService.getContextUsagePercentage(sessionId);
    });
  }
}
