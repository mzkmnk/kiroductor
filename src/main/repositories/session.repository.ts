/**
 * セッションに関するインメモリ状態を管理するリポジトリ。
 *
 * セッション ID を保持し、アクティブなセッションの有無を判定する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class SessionRepository {
  private sessionId: string | null = null;
  private loading: boolean = false;

  /**
   * 現在保持しているセッション ID を返す。
   *
   * @returns セッション ID。未設定の場合は `null`。
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * セッション ID を設定する。
   *
   * @param id - 保持するセッション ID。クリアする場合は `null`。
   */
  setSessionId(id: string | null): void {
    this.sessionId = id;
  }

  /**
   * アクティブなセッションが存在するかどうかを返す。
   *
   * @returns セッション ID が設定されている場合は `true`、それ以外は `false`。
   */
  hasActiveSession(): boolean {
    return this.sessionId !== null;
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
