import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk/dist/schema/index';
import type { NotificationService } from '../../interfaces/notification.service';

/** `client/requestPermission` リクエストを処理できるオブジェクトの最小インターフェース。 */
export interface IRequestPermissionMethod {
  /** リクエストを処理する。 */
  handle(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
}

/**
 * ACP `client/requestPermission` メソッドの実装。
 *
 * エージェントが操作の許可を求めてきたとき、MVP として最初の選択肢を自動承認して返す。
 * 承認内容はレンダラーへも通知する。
 */
export class RequestPermissionMethod implements IRequestPermissionMethod {
  /**
   * @param notificationService - レンダラーへの通知を担うサービス（依存注入）
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 最初の選択肢を自動承認してレスポンスを返す。
   *
   * @param params - ACP リクエストパラメータ
   * @returns 最初のオプションを選択した {@link RequestPermissionResponse}
   */
  async handle(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const firstOption = params.options[0];
    const response: RequestPermissionResponse = {
      outcome: {
        outcome: 'selected',
        optionId: firstOption.optionId,
      },
    };

    this.notificationService.sendToRenderer('acp:request-permission', {
      sessionId: params.sessionId,
      toolCall: params.toolCall,
      selectedOptionId: firstOption.optionId,
    });

    return response;
  }
}
