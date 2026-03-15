/**
 * セッションに関するインメモリ状態を管理するリポジトリ。
 *
 * 複数のセッション ID を管理し、アクティブなセッションを追跡する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class SessionRepository {
  /** 現在 UI に表示中のセッション ID。 */
  private activeSessionId: string | null = null;

  /** 管理中の全セッション ID。 */
  private sessionIds: Set<string> = new Set();

  private loading: boolean = false;

  /**
   * セッションを追加する。
   *
   * @param sessionId - 追加するセッション ID。
   */
  addSession(sessionId: string): void {
    this.sessionIds.add(sessionId);
  }

  /**
   * セッションを削除する。
   *
   * アクティブセッションが削除された場合、`activeSessionId` は `null` になる。
   *
   * @param sessionId - 削除するセッション ID。
   */
  removeSession(sessionId: string): void {
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
  setActiveSession(sessionId: string): void {
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
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * 管理中の全セッション ID を配列で返す。
   *
   * @returns セッション ID の配列。
   */
  getAllSessionIds(): string[] {
    return [...this.sessionIds];
  }

  /**
   * 現在保持しているセッション ID を返す。
   *
   * 下位互換のため {@link activeSessionId} を返す。
   *
   * @returns セッション ID。未設定の場合は `null`。
   */
  getSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * セッション ID を設定する。
   *
   * 下位互換のため {@link activeSessionId} を更新する。
   * `null` を渡すとアクティブセッションをクリアする。
   *
   * @param id - 保持するセッション ID。クリアする場合は `null`。
   */
  setSessionId(id: string | null): void {
    if (id === null) {
      this.activeSessionId = null;
    } else {
      this.setActiveSession(id);
    }
  }

  /**
   * アクティブなセッションが存在するかどうかを返す。
   *
   * @returns セッション ID が設定されている場合は `true`、それ以外は `false`。
   */
  hasActiveSession(): boolean {
    return this.activeSessionId !== null;
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
