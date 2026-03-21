import type { SessionId } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionModelState } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionModeState } from '@agentclientprotocol/sdk/dist/schema/index';

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

  /** prompt 実行中のセッション ID。 */
  private processingSessionIds: Set<SessionId> = new Set();

  /** ACP 接続が確立済みのセッション ID。アプリ終了まで保持される。 */
  private acpConnectedIds: Set<SessionId> = new Set();

  private loading: boolean = false;

  /** セッションごとのモデル状態。 */
  private modelStates: Map<SessionId, SessionModelState> = new Map();

  /** セッションごとの mode 状態。 */
  private modeStates: Map<SessionId, SessionModeState> = new Map();

  /** セッションごとのコンテキスト使用率（experimental）。 */
  private contextUsagePercentages: Map<SessionId, number> = new Map();

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
   * セッションを処理中としてマークする。
   *
   * @param sessionId - 処理中にするセッション ID
   */
  addProcessing(sessionId: SessionId): void {
    this.processingSessionIds.add(sessionId);
  }

  /**
   * セッションの処理中マークを解除する。
   *
   * @param sessionId - 解除するセッション ID
   */
  removeProcessing(sessionId: SessionId): void {
    this.processingSessionIds.delete(sessionId);
  }

  /**
   * セッションが処理中かどうかを返す。
   *
   * @param sessionId - 確認するセッション ID
   * @returns 処理中の場合は `true`
   */
  isProcessing(sessionId: SessionId): boolean {
    return this.processingSessionIds.has(sessionId);
  }

  /**
   * 処理中の全セッション ID を配列で返す。
   *
   * @returns 処理中セッション ID の配列
   */
  getProcessingSessionIds(): SessionId[] {
    return [...this.processingSessionIds];
  }

  /**
   * セッションを ACP 接続済みとしてマークする。
   *
   * @param sessionId - マークするセッション ID
   */
  markAcpConnected(sessionId: SessionId): void {
    this.acpConnectedIds.add(sessionId);
  }

  /**
   * セッションが ACP 接続済みかどうかを返す。
   *
   * @param sessionId - 確認するセッション ID
   * @returns ACP 接続済みの場合は `true`
   */
  isAcpConnected(sessionId: SessionId): boolean {
    return this.acpConnectedIds.has(sessionId);
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

  /**
   * セッションのモデル状態を設定する。
   *
   * @param sessionId - 対象セッション ID
   * @param state - モデル状態
   */
  setModelState(sessionId: SessionId, state: SessionModelState): void {
    this.modelStates.set(sessionId, {
      currentModelId: state.currentModelId,
      availableModels: [...state.availableModels],
    });
  }

  /**
   * セッションのモデル状態を取得する。
   *
   * @param sessionId - 対象セッション ID
   * @returns モデル状態
   * @throws モデル状態が未設定の場合
   */
  getModelState(sessionId: SessionId): SessionModelState {
    const state = this.modelStates.get(sessionId);
    if (!state) {
      throw new Error(`Model state for session "${sessionId}" is not set.`);
    }
    return state;
  }

  /**
   * セッションの現在のモデル ID を更新する。
   *
   * @param sessionId - 対象セッション ID
   * @param modelId - 新しいモデル ID
   * @throws モデル状態が未設定の場合
   */
  updateCurrentModelId(sessionId: SessionId, modelId: string): void {
    const state = this.modelStates.get(sessionId);
    if (!state) {
      throw new Error(`Model state for session "${sessionId}" is not set.`);
    }
    state.currentModelId = modelId;
  }

  /**
   * セッションの mode 状態を設定する。
   *
   * @param sessionId - 対象セッション ID
   * @param state - mode 状態
   */
  setModeState(sessionId: SessionId, state: SessionModeState): void {
    this.modeStates.set(sessionId, {
      ...state,
      availableModes: [...state.availableModes],
    });
  }

  /**
   * セッションの mode 状態を取得する。
   *
   * @param sessionId - 対象セッション ID
   * @returns mode 状態
   * @throws mode 状態が未設定の場合
   */
  getModeState(sessionId: SessionId): SessionModeState {
    const state = this.modeStates.get(sessionId);
    if (!state) {
      throw new Error(`Mode state for session "${sessionId}" is not set.`);
    }
    return state;
  }

  /**
   * セッションの現在の mode ID を更新する。
   *
   * @param sessionId - 対象セッション ID
   * @param modeId - 新しい mode ID
   * @throws mode 状態が未設定の場合
   */
  updateCurrentModeId(sessionId: SessionId, modeId: string): void {
    const state = this.modeStates.get(sessionId);
    if (!state) {
      throw new Error(`Mode state for session "${sessionId}" is not set.`);
    }
    this.modeStates.set(sessionId, { ...state, currentModeId: modeId });
  }

  /**
   * セッションのコンテキスト使用率を設定する（experimental）。
   *
   * `_kiro.dev/metadata` 通知から受け取った値を保持する。
   *
   * @param sessionId - 対象セッション ID
   * @param percentage - コンテキスト使用率（0〜100）
   */
  setContextUsagePercentage(sessionId: SessionId, percentage: number): void {
    this.contextUsagePercentages.set(sessionId, percentage);
  }

  /**
   * セッションのコンテキスト使用率を取得する（experimental）。
   *
   * @param sessionId - 対象セッション ID
   * @returns コンテキスト使用率。未設定の場合は `null`。
   */
  getContextUsagePercentage(sessionId: SessionId): number | null {
    return this.contextUsagePercentages.get(sessionId) ?? null;
  }
}
