import { AcpHandler } from './acp.handler';
import { SessionHandler } from './session.handler';

export { AcpHandler } from './acp.handler';
export { SessionHandler } from './session.handler';

/**
 * すべての IPC ハンドラーをまとめて登録する。
 *
 * @param acpHandler - ACP 接続ハンドラー
 * @param sessionHandler - セッション操作ハンドラー
 */
export function registerHandlers(acpHandler: AcpHandler, sessionHandler: SessionHandler): void {
  acpHandler.register();
  sessionHandler.register();
}
