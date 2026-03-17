import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { ModelInfo } from '../../shared/ipc';
import { createDebugLogger } from '../debug-logger';
import type { SessionRepository } from '../repositories/session.repository';
import type { MessageRepository } from '../repositories/message.repository';
import type { ConfigRepository } from '../repositories/config.repository';
import type { NotificationService } from '../interfaces/notification.service';
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
      'newSession' | 'cancel' | 'loadSession' | 'unstable_setSessionModel'
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
   * @param sessionId - 復元するセッションの ID
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   */
  async load(sessionId: SessionId, cwd: string): Promise<void> {
    log.info(`loadSession 開始 sessionId=${sessionId} cwd=${cwd}`);
    this.sessionRepo.setIsLoading(true);
    this.notificationService.sendToRenderer('acp:session-loading', { loading: true });
    this.messageRepo.initSession(sessionId);
    const response = await this.connection.loadSession({ sessionId, cwd, mcpServers: [] });
    log.info(`loadSession 完了 sessionId=${sessionId}`);
    this.saveModelState(sessionId, response.models);
    this.completeAllStreamingMessages(sessionId);
    this.sessionRepo.addSession(sessionId);
    this.sessionRepo.markAcpConnected(sessionId);
    this.sessionRepo.setActiveSession(sessionId);
    this.sessionRepo.setIsLoading(false);
    this.notificationService.sendToRenderer('acp:session-loading', { loading: false });
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
   * ACP レスポンスの models フィールドをリポジトリに保存する。
   *
   * @param sessionId - 対象セッション ID
   * @param models - ACP レスポンスの models フィールド（undefined の場合は何もしない）
   */
  private saveModelState(
    sessionId: SessionId,
    models: { currentModelId: string; availableModels: Array<ModelInfo> } | null | undefined,
  ): void {
    if (!models) return;
    this.sessionRepo.setModelState(sessionId, {
      currentModelId: models.currentModelId,
      availableModels: models.availableModels.map((m) => ({
        modelId: m.modelId,
        name: m.name,
        description: m.description,
      })),
    });
  }
}
