import { AcpHandler } from './acp.handler';
import { SessionHandler } from './session.handler';
import { RepoHandler } from './repo.handler';

export { AcpHandler } from './acp.handler';
export { SessionHandler } from './session.handler';
export { RepoHandler } from './repo.handler';

/**
 * すべての IPC ハンドラーをまとめて登録する。
 *
 * @param acpHandler - ACP 接続ハンドラー
 * @param sessionHandler - セッション操作ハンドラー
 * @param repoHandler - リポジトリ操作・設定管理ハンドラー
 */
export function registerHandlers(
  acpHandler: AcpHandler,
  sessionHandler: SessionHandler,
  repoHandler: RepoHandler,
): void {
  acpHandler.register();
  sessionHandler.register();
  repoHandler.register();
}
