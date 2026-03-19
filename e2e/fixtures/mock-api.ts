/**
 * VRT テスト用 window.kiroductor モック API の設定型と factory 関数。
 *
 * {@link installMockKiroductorAPI} は Playwright の `addInitScript` でブラウザに注入されるため、
 * 外部スコープへの参照を持たない自己完結した実装にすること。
 */

/** モック用画像添付データ型 */
export interface MockImageAttachment {
  mimeType: string;
  data: string;
}

/** モックメッセージ型 */
export interface MockMessage {
  id: string;
  type: 'user' | 'agent' | 'tool_call';
  text?: string;
  name?: string;
  input?: unknown;
  status?: string;
  result?: string;
  /** ユーザーメッセージの添付画像（type: 'user' のみ） */
  attachments?: MockImageAttachment[];
}

/** モックセッション型 */
export interface MockSession {
  acpSessionId: string;
  repoId: string;
  cwd: string;
  title: string;
  currentBranch?: string;
  sourceBranch?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * モック設定型。JSON シリアライズ可能なプレーンオブジェクトのみ使用する。
 *
 * 値を省略した場合のデフォルト動作は {@link installMockKiroductorAPI} を参照。
 */
export interface MockConfig {
  /** セッションに表示するメッセージ一覧（省略時: 空配列） */
  messages?: MockMessage[];
  /** サイドバーに表示するセッション一覧（省略時: {@link DEFAULT_SESSION} 1件） */
  sessions?: MockSession[];
  /** アクティブセッション ID（省略時: sessions[0].acpSessionId） */
  activeSession?: string;
  /** true にすると load() が永遠に resolve しない（セッション復元中状態の維持用） */
  loadNeverResolves?: boolean;
  /** prompt() 応答の遅延ミリ秒数（省略時: 即時 resolve） */
  promptDelayMs?: number;
  /** sessionId ごとの diff stats マップ（diffStats より優先） */
  diffStatsMap?: Record<
    string,
    { filesChanged?: number; insertions: number; deletions: number } | null
  >;
  /** 全セッション共通の diff stats（省略時: null） */
  diffStats?: { filesChanged?: number; insertions: number; deletions: number } | null;
  /** getDiff() が返す unified diff 文字列（省略時: null） */
  diff?: string | null;
  /** isAcpConnected() の戻り値（省略時: true） */
  acpConnected?: boolean;
  /** readFileBase64() が返す Base64 文字列のマップ（キー: filePath、省略時: null） */
  fileBase64Map?: Record<string, string>;
}

/** デフォルト 1 セッション設定 */
export const DEFAULT_SESSION: MockSession = {
  acpSessionId: 'mock-session-id',
  repoId: 'mock-repo',
  cwd: '/mock/cwd',
  title: 'Mock Session',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

/** ブランチ情報付きセッション */
export const SESSION_WITH_BRANCHES: MockSession = {
  acpSessionId: 'mock-session-id',
  repoId: 'mock-repo',
  cwd: '/mock/cwd',
  title: 'Mock Session',
  currentBranch: 'feature/add-header',
  sourceBranch: 'main',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

/**
 * ブラウザコンテキストに window.kiroductor モック API をインストールする。
 *
 * この関数は Playwright の `addInitScript(fn, arg)` でシリアライズされるため、
 * 外部スコープへの参照を持たない自己完結した実装にすること。
 *
 * @param config - モックの動作設定
 */
export function installMockKiroductorAPI(config: MockConfig): void {
  const sessions: MockSession[] = config.sessions ?? [
    {
      acpSessionId: 'mock-session-id',
      repoId: 'mock-repo',
      cwd: '/mock/cwd',
      title: 'Mock Session',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ];
  const activeSession = config.activeSession ?? sessions[0]?.acpSessionId ?? 'mock-session-id';

  (window as Record<string, unknown>).kiroductor = {
    acp: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      getStatus: () => Promise.resolve('disconnected'),
      onStatusChange: () => () => {},
    },
    session: {
      create: () => Promise.resolve(),
      load: () => (config.loadNeverResolves ? new Promise<void>(() => {}) : Promise.resolve()),
      switch: () => Promise.resolve(),
      prompt: () =>
        config.promptDelayMs != null
          ? new Promise<{ stopReason: string }>((resolve) =>
              setTimeout(() => resolve({ stopReason: 'end_turn' }), config.promptDelayMs),
            )
          : Promise.resolve({ stopReason: 'end_turn' }),
      cancel: () => Promise.resolve(),
      getActive: () => Promise.resolve(activeSession),
      getAll: () => Promise.resolve(sessions.map((s) => s.acpSessionId)),
      list: () => Promise.resolve(sessions),
      getMessages: () => Promise.resolve(config.messages ?? []),
      isAcpConnected: () => Promise.resolve(config.acpConnected ?? true),
      onUpdate: () => () => {},
      getProcessingSessions: () => Promise.resolve([]),
      onSessionSwitched: () => () => {},
      onSessionLoading: () => () => {},
      onPromptCompleted: () => () => {},
      getModels: () =>
        Promise.resolve({
          currentModelId: 'claude-sonnet-4.5',
          availableModels: [
            { modelId: 'auto', name: 'auto', description: 'Auto select' },
            { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
            { modelId: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5', description: 'Sonnet' },
          ],
        }),
      setModel: () => Promise.resolve(),
      onModelChanged: () => () => {},
      getModes: () =>
        Promise.resolve({
          currentModeId: 'kiro_default',
          availableModes: [
            { id: 'kiro_default', name: 'Default' },
            { id: 'test-reviewer', name: 'Test Reviewer' },
          ],
        }),
      setMode: () => Promise.resolve(),
      onModeChanged: () => () => {},
    },
    repo: {
      clone: () => Promise.resolve({ repoId: 'mock-repo' }),
      list: () => Promise.resolve([]),
      createWorktree: () => Promise.resolve({ cwd: '/mock/cwd' }),
      listBranches: () => Promise.resolve([]),
      getDiffStats: (sessionId: string) => {
        if (config.diffStatsMap != null) {
          return Promise.resolve(config.diffStatsMap[sessionId] ?? null);
        }
        return Promise.resolve(config.diffStats ?? null);
      },
      getDiff: () => Promise.resolve(config.diff ?? null),
      readFileBase64: (_cwd: string, filePath: string) =>
        Promise.resolve(config.fileBase64Map?.[filePath] ?? null),
    },
    config: {
      getSettings: () => Promise.resolve({}),
      updateSettings: () => Promise.resolve(),
    },
  };
}
