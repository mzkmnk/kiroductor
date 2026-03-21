import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionRepository } from '../session/session.repository';
import type { NotificationService } from '../../shared/interfaces/notification.service';

/** `_kiro.dev/metadata` 通知パラメータ。 */
export interface MetadataParams {
  /** セッション ID */
  sessionId: SessionId;
  /** コンテキスト使用率（0〜100） */
  contextUsagePercentage: number;
}

/** `_kiro.dev/metadata` 拡張通知を処理できるオブジェクトの最小インターフェース。 */
export interface IMetadataMethod {
  /** `_kiro.dev/metadata` 通知パラメータを処理する。 */
  handle(params: MetadataParams): Promise<void>;
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
  async handle(params: MetadataParams): Promise<void> {
    this.sessionRepository.setContextUsagePercentage(
      params.sessionId,
      params.contextUsagePercentage,
    );
    this.notificationService.sendToRenderer('acp:metadata', {
      sessionId: params.sessionId,
      contextUsagePercentage: params.contextUsagePercentage,
    });
    // TODO: contextUsagePercentage が閾値（90%）を超えた場合に /compact を推奨するトーストを表示する
  }
}
