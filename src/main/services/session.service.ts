import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import { createDebugLogger } from '../debug-logger';
import type { SessionRepository } from '../repositories/session.repository';
import type { MessageRepository } from '../repositories/message.repository';
import type { ConfigRepository } from '../repositories/config.repository';
import type { NotificationService } from '../interfaces/notification.service';

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
      'newSession' | 'cancel' | 'loadSession'
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
   * @param repoId - リポジトリの識別子（{@link RepoMapping.repoId} への参照）
   */
  async create(cwd: string, repoId: string = ''): Promise<void> {
    log.info(`newSession 開始 cwd=${cwd}`);
    // TODO: mcpServers に対応する
    const { sessionId } = await this.connection.newSession({ cwd, mcpServers: [] });
    log.info(`newSession 完了 sessionId=${sessionId}`);
    this.sessionRepo.addSession(sessionId);
    this.messageRepo.initSession(sessionId);
    this.sessionRepo.setActiveSession(sessionId);
    const now = new Date().toISOString();
    await this.configRepo.upsertSession({
      acpSessionId: sessionId,
      repoId,
      cwd,
      title: null,
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
   * 4. `ConfigRepository` のセッション情報を更新する
   *
   * @param sessionId - 復元するセッションの ID
   * @param cwd - セッションの作業ディレクトリ（絶対パス）
   */
  async load(sessionId: SessionId, cwd: string): Promise<void> {
    log.info(`loadSession 開始 sessionId=${sessionId} cwd=${cwd}`);
    this.sessionRepo.setIsLoading(true);
    this.notificationService.sendToRenderer('acp:session-loading', { loading: true });
    this.messageRepo.clearSession(sessionId);
    await this.connection.loadSession({ sessionId, cwd, mcpServers: [] });
    log.info(`loadSession 完了 sessionId=${sessionId}`);
    this.sessionRepo.addSession(sessionId);
    this.sessionRepo.setActiveSession(sessionId);
    this.sessionRepo.setIsLoading(false);
    this.notificationService.sendToRenderer('acp:session-loading', { loading: false });
    const now = new Date().toISOString();
    await this.configRepo.upsertSession({
      acpSessionId: sessionId,
      repoId: '',
      cwd,
      title: null,
      createdAt: now,
      updatedAt: now,
    });
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
   * 実行中のセッションをキャンセルする。
   *
   * アクティブなセッションが存在しない場合は何もしない。
   */
  async cancel(): Promise<void> {
    const sessionId = this.sessionRepo.getActiveSessionId();
    if (!sessionId) {
      log.info('cancel: アクティブなセッションがありません');
      return;
    }
    log.info(`cancel sessionId=${sessionId}`);
    await this.connection.cancel({ sessionId });
    log.info('cancel 完了');
  }
}
