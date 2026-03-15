import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';

/**
 * セッションに関するインメモリ状態を管理するリポジトリ。
 *
 * 複数のセッション ID を管理し、アクティブなセッションを追跡する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class SessionRepository {
  /** 現在チャットエリアに表示中のセッション ID。 */
  private activeSessionId: SessionId | null = null;

  /** 管理中の全セッション ID。 */
  private sessionIds: Set<SessionId> = new Set();

  private loading: boolean = false;

  /**
   * セッションを追加する。
   *
   * @param sessionId - 追加するセッション ID。
   */
  addSession(sessionId: SessionId): void {
    this.sessionIds.add(sessionId);
  }

  /**
   * セッションを削除する。
   *
   * アクティブセッションが削除された場合、`activeSessionId` は `null` になる。
   *
   * @param sessionId - 削除するセッション ID。
   */
  removeSession(sessionId: SessionId): void {
    this.sessionIds.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  /**
   * アクティブセッションを切り替える。
   *
   * @param sessionId - 切り替え先のセッション ID。{@link sessionIds} に含まれている必要がある。
   * @throws セッション ID が管理外の場合。
   */
  setActiveSession(sessionId: SessionId): void {
    if (!this.sessionIds.has(sessionId)) {
      throw new Error(`Session "${sessionId}" is not managed. Add it first with addSession().`);
    }
    this.activeSessionId = sessionId;
  }

  /**
   * アクティブセッション ID を返す。
   *
   * @returns アクティブセッション ID。未設定の場合は `null`。
   */
  getActiveSessionId(): SessionId | null {
    return this.activeSessionId;
  }

  /**
   * 管理中の全セッション ID を配列で返す。
   *
   * @returns セッション ID の配列。
   */
  getAllSessionIds(): SessionId[] {
    return [...this.sessionIds];
  }

  /**
   * セッション復元中かどうかを返す。
   *
   * @returns 復元処理中の場合は `true`、それ以外は `false`。
   */
  getIsLoading(): boolean {
    return this.loading;
  }

  /**
   * セッション復元中フラグを設定する。
   *
   * @param loading - 復元処理中の場合は `true`、完了時は `false`。
   */
  setIsLoading(loading: boolean): void {
    this.loading = loading;
  }
}
