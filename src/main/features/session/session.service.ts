import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionModelState } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionModeState } from '@agentclientprotocol/sdk/dist/schema/index';
import { createDebugLogger } from '../../shared/debug-logger';
import type { SessionRepository } from './session.repository';
import type { MessageRepository } from './message.repository';
import type { Message } from '../../../shared/message-types';
import type { ConfigRepository, SessionMapping } from '../config/config.repository';
import type { NotificationService } from '../../shared/interfaces/notification.service';
import { generateSessionTitle } from './session-title.generator';

const log = createDebugLogger('Session');

/**
 * エージェントとの会話セッションのライフサイクルを管理するサービス。
 *
 * `create()` で新規セッションを開始し、`cancel()` で実行中のセッションをキャンセルする。
 * セッション情報は {@link ConfigRepository} を通じて `sessions.json` に永続化される。
 */
export class SessionService {
  /**
   * @param sessionRepo - セッション ID を管理するリポジトリ（依存注入）
   * @param messageRepo - メッセージ一覧を管理するリポジトリ（依存注入）
   * @param connection - ACP クライアント接続（依存注入）
   * @param notificationService - レンダラーへの通知を担うサービス（依存注入）
   * @param configRepo - セッション情報の永続化を担うリポジトリ（依存注入）
   */
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly messageRepo: MessageRepository,
    private readonly connection: Pick<
      ClientSideConnection,
      'newSession' | 'cancel' | 'loadSession' | 'unstable_setSessionModel' | 'setSessionMode'
    >,
    private readonly notificationService: NotificationService,
    private readonly configRepo: Pick<ConfigRepository, 'upsertSession' | 'readSessions'>,
  ) {}

  /**
   * 指定した作業ディレクトリで新しいセッションを開始する。
   *
   * 1. ACP 接続の `newSession()` を呼んでセッションを作成する
   * 2. 返却された `sessionId` を `SessionRepository` に保存する
   * 3. `MessageRepository` をクリアしてメッセージ履歴をリセットする
   * 4. `ConfigRepository` にセッション情報を永続化する
   *
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   * @param currentBranch - worktree 上で作成された作業ブランチ名
   * @param sourceBranch - worktree 作成時のベースブランチ名
   * @param repoId - リポジトリの識別子（{@link RepoMapping.repoId} への参照）
   */
  async create(
    cwd: string,
    currentBranch: string,
    sourceBranch: string,
    repoId: string = '',
  ): Promise<void> {
    log.info(`newSession 開始 cwd=${cwd}`);
    // TODO: mcpServers に対応する
    const response = await this.connection.newSession({ cwd, mcpServers: [] });
    const { sessionId } = response;
    log.info(`newSession 完了 sessionId=${sessionId}`);
    this.sessionRepo.addSession(sessionId);
    this.sessionRepo.markAcpConnected(sessionId);
    this.messageRepo.initSession(sessionId);
    this.sessionRepo.setActiveSession(sessionId);
    this.saveModelState(sessionId, response.models);
    this.saveModeState(sessionId, response.modes);
    const now = new Date().toISOString();
    await this.configRepo.upsertSession({
      acpSessionId: sessionId,
      repoId,
      cwd,
      title: generateSessionTitle(),
      currentBranch,
      sourceBranch,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * 既存セッションを復元する。
   *
   * 1. `MessageRepository` をクリアしてメッセージ履歴をリセットする
   * 2. ACP 接続の `loadSession()` を呼んでセッションを復元する
   * 3. 指定した `sessionId` を `SessionRepository` に保存する
   *
   * セッションが別プロセスにロックされている場合は、stale プロセスを
   * kill してからリトライする（クラッシュ後のリカバリ）。
   *
   * @param sessionId - 復元するセッションの ID
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   */
  async load(sessionId: SessionId, cwd: string): Promise<void> {
    log.info(`loadSession 開始 sessionId=${sessionId} cwd=${cwd}`);
    this.sessionRepo.setIsLoading(true);
    this.notificationService.sendToRenderer('acp:session-loading', { loading: true });
    this.messageRepo.initSession(sessionId);
    try {
      const response = await this.connection.loadSession({ sessionId, cwd, mcpServers: [] });
      this.applyLoadResponse(sessionId, response);
    } catch (error: unknown) {
      const stalePid = this.extractStalePid(error);
      if (stalePid === null) throw error;

      log.info(
        `セッション ${sessionId} は PID ${String(stalePid)} にロックされています。リカバリを試みます`,
      );
      await this.killStaleProcess(stalePid);
      const response = await this.connection.loadSession({ sessionId, cwd, mcpServers: [] });
      this.applyLoadResponse(sessionId, response);
    } finally {
      this.sessionRepo.setIsLoading(false);
      this.notificationService.sendToRenderer('acp:session-loading', { loading: false });
    }
  }

  /**
   * `loadSession` のレスポンスをリポジトリに反映する共通処理。
   *
   * @param sessionId - 対象セッション ID
   * @param response - `loadSession` のレスポンス
   */
  private applyLoadResponse(
    sessionId: SessionId,
    response: { models?: SessionModelState | null; modes?: SessionModeState | null },
  ): void {
    log.info(`loadSession 完了 sessionId=${sessionId}`);
    this.saveModelState(sessionId, response.models);
    this.saveModeState(sessionId, response.modes);
    this.completeAllStreamingMessages(sessionId);
    this.sessionRepo.addSession(sessionId);
    this.sessionRepo.markAcpConnected(sessionId);
    this.sessionRepo.setActiveSession(sessionId);

    // 復元されたメッセージのサマリーをログに出力する
    const messages = this.messageRepo.getAll(sessionId);
    const typeCounts = { user: 0, agent: 0, tool_call: 0 };
    for (const msg of messages) {
      typeCounts[msg.type]++;
    }
    log.info(
      `loadSession 復元メッセージ: 合計=${String(messages.length)} ` +
        `user=${String(typeCounts.user)} agent=${String(typeCounts.agent)} ` +
        `tool_call=${String(typeCounts.tool_call)}`,
    );
  }

  /**
   * セッションロック競合エラーからロックを保持している PID を抽出する。
   *
   * `Error` インスタンスと JSON-RPC エラーオブジェクト（`data` フィールド）の両方に対応する。
   *
   * @param error - 判定するエラー
   * @returns ロックを保持している PID。セッションロック競合でない場合は `null`
   */
  private extractStalePid(error: unknown): number | null {
    const pattern = /Session is active in another process \(PID (\d+)\)/;
    let text = '';
    if (error instanceof Error) {
      text = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const obj = error as Record<string, unknown>;
      text = `${String(obj.message ?? '')} ${String(obj.data ?? '')}`;
    }
    const match = pattern.exec(text);
    return match ? Number(match[1]) : null;
  }

  /**
   * stale プロセスを SIGTERM で kill し、終了するまで待機する。
   *
   * プロセスが既に終了している場合は即座に返る。
   * 最大 5 秒間ポーリングし、タイムアウトした場合はそのまま続行する。
   *
   * @param pid - kill 対象のプロセス ID
   */
  private async killStaleProcess(pid: number): Promise<void> {
    try {
      process.kill(pid, 'SIGTERM');
      log.info(`stale プロセス PID ${String(pid)} に SIGTERM を送信しました`);
    } catch {
      log.info(`PID ${String(pid)} は既に終了しています`);
      return;
    }

    // プロセスが終了するまでポーリング（最大 5 秒）
    const maxWait = 5000;
    const interval = 200;
    let elapsed = 0;
    while (elapsed < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
      try {
        process.kill(pid, 0);
        // まだ生きている
      } catch {
        log.info(`PID ${String(pid)} の終了を確認しました（${String(elapsed)}ms）`);
        return;
      }
    }
    log.info(`PID ${String(pid)} の終了待ちがタイムアウトしました（${String(maxWait)}ms）`);
  }

  /**
   * `sessions.json` から過去のセッション一覧を読み込み、{@link SessionRepository} に復元する。
   *
   * アプリ起動時に呼び出し、前回のセッション情報をインメモリ状態に反映する。
   */
  async restoreSessions(): Promise<void> {
    const sessions = await this.configRepo.readSessions();
    for (const session of sessions) {
      this.sessionRepo.addSession(session.acpSessionId);
    }
    log.info(`restoreSessions: ${String(sessions.length)} セッションを復元`);
  }

  /**
   * 指定セッション内でストリーミング中のエージェントメッセージをすべて確定状態にする。
   *
   * セッション復元時、`loadSession` 完了後に呼び出して
   * 残留する `streaming` 状態のメッセージを `completed` へ遷移させる。
   *
   * @param sessionId - 対象セッション ID
   */
  private completeAllStreamingMessages(sessionId: SessionId): void {
    const messages = this.messageRepo.getAll(sessionId);
    for (const msg of messages) {
      if (msg.type === 'agent' && msg.status === 'streaming') {
        this.messageRepo.completeAgentMessage(sessionId, msg.id);
      }
    }
  }

  /**
   * 指定セッションの実行をキャンセルする。
   *
   * @param sessionId - キャンセルするセッション ID
   */
  async cancel(sessionId: SessionId): Promise<void> {
    log.info(`cancel sessionId=${sessionId}`);
    await this.connection.cancel({ sessionId });
    log.info('cancel 完了');
  }

  /**
   * 指定セッションのモデルを切り替える。
   *
   * ACP の `unstable_setSessionModel` を呼び出し、成功したらリポジトリを更新する。
   *
   * @param sessionId - 対象セッション ID
   * @param modelId - 切り替え先のモデル ID
   */
  async setModel(sessionId: SessionId, modelId: string): Promise<void> {
    log.info(`setModel sessionId=${sessionId} modelId=${modelId}`);
    await this.connection.unstable_setSessionModel({ sessionId, modelId });
    this.sessionRepo.updateCurrentModelId(sessionId, modelId);
    log.info('setModel 完了');
  }

  /**
   * 指定セッションのモデル状態を取得する。
   *
   * @param sessionId - 対象セッション ID
   * @returns モデル状態
   */
  getModelState(sessionId: SessionId): SessionModelState {
    return this.sessionRepo.getModelState(sessionId);
  }

  /**
   * 指定セッションの mode を切り替える。
   *
   * ACP の `setSessionMode` を呼び出し、成功したらリポジトリを更新する。
   *
   * @param sessionId - 対象セッション ID
   * @param modeId - 切り替え先の mode ID
   */
  async setMode(sessionId: SessionId, modeId: string): Promise<void> {
    log.info(`setMode sessionId=${sessionId} modeId=${modeId}`);
    await this.connection.setSessionMode({ sessionId, modeId });
    this.sessionRepo.updateCurrentModeId(sessionId, modeId);
    log.info('setMode 完了');
  }

  /**
   * 指定セッションの mode 状態を取得する。
   *
   * @param sessionId - 対象セッション ID
   * @returns mode 状態
   */
  getModeState(sessionId: SessionId): SessionModeState {
    return this.sessionRepo.getModeState(sessionId);
  }

  /**
   * 指定セッションのコンテキスト使用率を取得する（experimental）。
   *
   * @param sessionId - 対象セッション ID
   * @returns コンテキスト使用率。未設定の場合は `null`。
   */
  getContextUsagePercentage(sessionId: SessionId): number | null {
    return this.sessionRepo.getContextUsagePercentage(sessionId);
  }

  /**
   * 指定セッションのメッセージ一覧を返す。
   *
   * @param sessionId - 対象セッション ID
   * @returns メッセージ配列
   */
  getMessages(sessionId: SessionId): Message[] {
    return this.messageRepo.getAll(sessionId);
  }

  /**
   * アクティブセッションを切り替える。
   *
   * @param sessionId - 切り替え先のセッション ID
   */
  switchSession(sessionId: SessionId): void {
    this.sessionRepo.setActiveSession(sessionId);
  }

  /**
   * 現在のアクティブセッション ID を返す。
   *
   * @returns アクティブセッション ID。未設定の場合は `null`。
   */
  getActiveSessionId(): SessionId | null {
    return this.sessionRepo.getActiveSessionId();
  }

  /**
   * 管理中の全セッション ID を配列で返す。
   *
   * @returns セッション ID の配列
   */
  getAllSessionIds(): SessionId[] {
    return this.sessionRepo.getAllSessionIds();
  }

  /**
   * 永続化済みの全セッション一覧を返す。
   *
   * @returns {@link SessionMapping} の配列
   */
  async listSessions(): Promise<SessionMapping[]> {
    return this.configRepo.readSessions();
  }

  /**
   * 処理中の全セッション ID を返す。
   *
   * @returns 処理中セッション ID の配列
   */
  getProcessingSessionIds(): SessionId[] {
    return this.sessionRepo.getProcessingSessionIds();
  }

  /**
   * 指定セッションが ACP 接続済みかどうかを返す。
   *
   * @param sessionId - 確認するセッション ID
   * @returns ACP 接続済みの場合は `true`
   */
  isAcpConnected(sessionId: SessionId): boolean {
    return this.sessionRepo.isAcpConnected(sessionId);
  }

  /**
   * セッションを処理中としてマークする。
   *
   * @param sessionId - 処理中にするセッション ID
   */
  addProcessing(sessionId: SessionId): void {
    this.sessionRepo.addProcessing(sessionId);
  }

  /**
   * セッションの処理中マークを解除する。
   *
   * @param sessionId - 解除するセッション ID
   */
  removeProcessing(sessionId: SessionId): void {
    this.sessionRepo.removeProcessing(sessionId);
  }

  /**
   * ACP レスポンスの models フィールドをリポジトリに保存する。
   *
   * @param sessionId - 対象セッション ID
   * @param models - ACP レスポンスの models フィールド（undefined の場合は何もしない）
   */
  private saveModelState(sessionId: SessionId, models?: SessionModelState | null): void {
    if (!models) {
      log.info(`saveModelState: models なし sessionId=${sessionId}`);
      return;
    }
    log.info(
      `saveModelState: sessionId=${sessionId} currentModelId=${models.currentModelId} availableModels=${String(models.availableModels.length)}`,
    );
    this.sessionRepo.setModelState(sessionId, models);
  }

  /**
   * ACP レスポンスの modes フィールドをリポジトリに保存する。
   *
   * @param sessionId - 対象セッション ID
   * @param modes - ACP レスポンスの modes フィールド（undefined の場合は何もしない）
   */
  private saveModeState(sessionId: SessionId, modes?: SessionModeState | null): void {
    if (!modes) {
      log.info(`saveModeState: modes なし sessionId=${sessionId}`);
      return;
    }
    log.info(
      `saveModeState: sessionId=${sessionId} currentModeId=${modes.currentModeId} availableModes=${String(modes.availableModes.length)}`,
    );
    this.sessionRepo.setModeState(sessionId, modes);
  }
}
