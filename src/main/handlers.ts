import { AcpHandler } from './features/acp-connection/acp.handler';
import { SessionHandler } from './features/session/session.handler';
import { RepoHandler } from './features/repo/repo.handler';

export { AcpHandler } from './features/acp-connection/acp.handler';
export { SessionHandler } from './features/session/session.handler';
export { RepoHandler } from './features/repo/repo.handler';

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
