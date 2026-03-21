import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionRepository } from '../session/session.repository';
import type { NotificationService } from '../../shared/interfaces/notification.service';

/** `_kiro.dev/metadata` 拡張通知を処理できるオブジェクトの最小インターフェース。 */
export interface IMetadataMethod {
  /** `_kiro.dev/metadata` 通知パラメータを処理する。 */
  handle(params: Record<string, unknown>): Promise<void>;
}

/**
 * kiro-cli 固有の `_kiro.dev/metadata` 拡張通知を処理するメソッド（experimental）。
 *
 * セッションごとのコンテキスト使用率を {@link SessionRepository} に保存し、
 * レンダラーへ通知する。
 */
export class MetadataMethod implements IMetadataMethod {
  /**
   * @param sessionRepository - コンテキスト使用率を保持するリポジトリ（依存注入）
   * @param notificationService - レンダラーへの通知を担うサービス（依存注入）
   */
  constructor(
    private readonly sessionRepository: Pick<SessionRepository, 'setContextUsagePercentage'>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * `_kiro.dev/metadata` 通知パラメータを処理する。
   *
   * @param params - 通知パラメータ
   */
  async handle(params: Record<string, unknown>): Promise<void> {
    const sessionId = params.sessionId as SessionId;
    const contextUsagePercentage = params.contextUsagePercentage as number;

    this.sessionRepository.setContextUsagePercentage(sessionId, contextUsagePercentage);
    this.notificationService.sendToRenderer('acp:metadata', {
      sessionId,
      contextUsagePercentage,
    });
    // TODO: contextUsagePercentage が閾値（90%）を超えた場合に /compact を推奨するトーストを表示する
  }
}
