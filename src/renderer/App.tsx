import { useState, useReducer, useEffect, useRef } from 'react';
import type { AgentMessage, Message, UserMessage } from '../shared/message-types';
import type { SessionMapping } from '../main/features/config/config.repository';
import type { ModelInfo } from '@agentclientprotocol/sdk/dist/schema/index';
import type { DiffStats, ImageAttachment } from '../shared/ipc';
import { ChatView } from './components/ChatView';
import type { ChatViewHandle } from './components/ChatView';
import { PromptInput } from './components/PromptInput';
import { SessionSidebar } from './components/SessionSidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DiffDialog } from './components/DiffDialog';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';
import { useDiffComments } from './hooks/use-diff-comments';
import { buildReviewPrompt } from './lib/build-review-prompt';

/**
 * チャット UI の状態。
 *
 * `messages` と `animSplits` を一括管理することで、
 * 新規チャンクのアニメーション分割点を正確に算出する。
 */
interface ChatState {
  /** 現在表示中のメッセージ一覧。 */
  messages: Message[];
  /**
   * ストリーミング中メッセージのアニメーション開始オフセット（文字数）の辞書。
   *
   * キーはメッセージ ID。前回の `messages` を参照して算出するため、
   * `messages` と同じ reducer で更新する。
   */
  animSplits: Record<string, number>;
}

/** チャット状態を更新するアクション。 */
type ChatAction =
  | { type: 'set'; messages: Message[] }
  | { type: 'clear' }
  | { type: 'append'; message: UserMessage };

/**
 * チャット状態の reducer。
 *
 * `set` アクション時は前回の `messages` からストリーミング中メッセージの
 * テキスト長を取得し、新規チャンクのアニメーション分割点を計算する。
 *
 * @param state - 現在の状態
 * @param action - 適用するアクション
 * @returns 次の状態
 */
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'clear':
      return { messages: [], animSplits: {} };

    case 'append':
      return { ...state, messages: [...state.messages, action.message] };

    case 'set': {
      const prevLengths = new Map(
        state.messages
          .filter((m): m is UserMessage | AgentMessage => m.type !== 'tool_call')
          .map((m) => [m.id, m.text.length]),
      );
      const animSplits: Record<string, number> = {};

      for (const msg of action.messages) {
        if (msg.type !== 'user') {
          const agentMsg = msg as AgentMessage;
          if (agentMsg.status === 'streaming') {
            // 前回のテキスト長を分割点とし、それ以降が新規チャンク（アニメーション対象）
            animSplits[msg.id] = prevLengths.get(msg.id) ?? 0;
          }
        }
      }

      return { messages: action.messages, animSplits };
    }
  }
}

/**
 * アプリケーションのルートコンポーネント。
 *
 * Sidebar + Main の2カラムレイアウトを提供する。
 * セッション管理は {@link SessionSidebar} が担い、
 * チャットエリアはアクティブセッションのメッセージを表示する。
 */
function App() {
  const [promptCompletedCount, setPromptCompletedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [chatState, dispatchChat] = useReducer(chatReducer, { messages: [], animSplits: {} });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [processingSessionIds, setProcessingSessionIds] = useState<Set<string>>(new Set());
  const [sessionMappings, setSessionMappings] = useState<SessionMapping[]>([]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [diffData, setDiffData] = useState<string | null>(null);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const { comments, addComment, removeComment, clearComments } = useDiffComments();

  // ref でアクティブセッション ID を追跡（コールバック内で最新値を参照するため）
  const activeSessionIdRef = useRef(activeSessionId);
  const chatViewRef = useRef<ChatViewHandle>(null);
  /** セッションIDごとのスクロール位置。 */
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const [restoreScrollTop, setRestoreScrollTop] = useState<number | undefined>(undefined);

  /** アクティブセッションの diff stats を取得する。 */
  async function fetchDiffStats(sessionId: string) {
    const stats = await window.kiroductor.repo.getDiffStats(sessionId);
    setDiffStats(stats);
  }

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  /** 指定セッションのモデル情報を取得して state に反映する。 */
  function fetchModels(sessionId: string) {
    window.kiroductor.session.getModels(sessionId).then((state) => {
      if (state) {
        setCurrentModelId(state.currentModelId);
        setAvailableModels(state.availableModels);
      } else {
        setCurrentModelId(null);
        setAvailableModels([]);
      }
    });
  }

  useEffect(() => {
    // 初回: セッション一覧を取得
    window.kiroductor.session.list().then(setSessionMappings);

    // 初回: アクティブセッション ID とメッセージを取得
    window.kiroductor.session.getActive().then((id) => {
      setActiveSessionId(id);
      activeSessionIdRef.current = id;
      if (id) {
        window.kiroductor.session
          .getMessages(id)
          .then((msgs) => dispatchChat({ type: 'set', messages: msgs }));
        fetchDiffStats(id);
        fetchModels(id);
      }
    });

    // 初回: 処理中セッションを取得
    window.kiroductor.session.getProcessingSessions().then((ids) => {
      setProcessingSessionIds(new Set(ids));
    });

    // エージェントからの session/update 通知 — アクティブセッションのみ UI 更新
    const unsubUpdate = window.kiroductor.session.onUpdate((notification) => {
      if (notification.sessionId === activeSessionIdRef.current) {
        window.kiroductor.session
          .getMessages(activeSessionIdRef.current)
          .then((msgs) => dispatchChat({ type: 'set', messages: msgs }));
      }
    });

    // セッション切り替え通知
    const unsubSwitched = window.kiroductor.session.onSessionSwitched(({ sessionId }) => {
      setActiveSessionId(sessionId);
      activeSessionIdRef.current = sessionId;
      window.kiroductor.session
        .getMessages(sessionId)
        .then((msgs) => dispatchChat({ type: 'set', messages: msgs }));
      fetchDiffStats(sessionId);
      fetchModels(sessionId);
    });

    // モデル変更通知
    const unsubModelChanged = window.kiroductor.session.onModelChanged(({ sessionId, modelId }) => {
      if (sessionId === activeSessionIdRef.current) {
        setCurrentModelId(modelId);
      }
    });

    // プロンプト完了通知 — processing 状態を解除
    const unsubCompleted = window.kiroductor.session.onPromptCompleted(({ sessionId }) => {
      setProcessingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
      // 完了したのがアクティブセッションなら最終メッセージを反映
      if (sessionId === activeSessionIdRef.current) {
        window.kiroductor.session
          .getMessages(sessionId)
          .then((msgs) => dispatchChat({ type: 'set', messages: msgs }));
        fetchDiffStats(sessionId);
      }
      setPromptCompletedCount((c) => c + 1);
    });

    return () => {
      unsubUpdate();
      unsubSwitched();
      unsubCompleted();
      unsubModelChanged();
    };
  }, []);

  /**
   * エージェントの実行をキャンセルする。
   *
   * 停止ボタン押下時に呼ばれ、ACP の cancel 通知を送信する。
   */
  function handleCancel() {
    if (!activeSessionId) return;
    window.kiroductor.session.cancel(activeSessionId);
  }

  /**
   * ユーザーのプロンプトを送信する。
   *
   * ユーザーメッセージを楽観的に即時表示してから IPC を呼ぶ。
   * onUpdate が届いたタイミングで main リポジトリの実データに置き換わる。
   *
   * @param text - 送信するテキスト
   */
  async function handleSubmit(text: string, images?: ImageAttachment[]) {
    if (!activeSessionId) return;
    const submittedSessionId = activeSessionId;
    // コメントがある場合はレビュープロンプトを組み立てる
    const prompt = buildReviewPrompt(comments, text);
    // 楽観的更新: IPC 完了を待たずにユーザーメッセージを即座に表示する（ユーザーの生テキストを表示）
    const optimisticMessage: UserMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      text,
      ...(images ? { attachments: images } : {}),
    };
    dispatchChat({ type: 'append', message: optimisticMessage });
    setIsProcessing(true);
    setProcessingSessionIds((prev) => new Set(prev).add(submittedSessionId));
    clearComments();
    await window.kiroductor.session.prompt(prompt, submittedSessionId, images);

    // まだ同じセッションを表示中の場合のみ UI を更新する
    if (activeSessionIdRef.current === submittedSessionId) {
      const msgs = await window.kiroductor.session.getMessages(submittedSessionId);
      dispatchChat({ type: 'set', messages: msgs });
      setIsProcessing(false);
    }
    // 切り替え済みの場合:
    // - メッセージは main の MessageRepository に蓄積済み（戻れば見える）
    // - isProcessing は切り替え時に handleSwitchSession で制御済み
    // - processingSessionIds は onPromptCompleted で削除済み
  }

  /** diff ダイアログを開き、差分データを取得する。 */
  async function handleDiffClick() {
    if (!activeSessionId) return;
    setDiffDialogOpen(true);
    const diff = await window.kiroductor.repo.getDiff(activeSessionId);
    setDiffData(diff);
  }

  /** セッション切り替えハンドラ。メモリ上のメッセージを表示する。 */
  async function handleSwitchSession(sessionId: string, _cwd: string) {
    if (sessionId === activeSessionId) return;

    // 切り替え前に現セッションのスクロール位置を保存
    if (activeSessionId && chatViewRef.current) {
      scrollPositionsRef.current.set(activeSessionId, chatViewRef.current.getScrollTop());
    }
    // 切り替え先の復元位置をセット（保存済みなら復元、なければ undefined で最下部へ）
    setRestoreScrollTop(scrollPositionsRef.current.get(sessionId));

    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    dispatchChat({ type: 'clear' });
    clearComments();
    setDiffStats(null);
    fetchDiffStats(sessionId);

    // 切り替え先セッションが処理中かどうかで isProcessing を更新
    setIsProcessing(processingSessionIds.has(sessionId));

    // ACP 接続済みセッションはメモリ上のメッセージをそのまま表示する
    const isConnected = await window.kiroductor.session.isAcpConnected(sessionId);
    if (isConnected) {
      const msgs = await window.kiroductor.session.getMessages(sessionId);
      dispatchChat({ type: 'set', messages: msgs });
    } else {
      // ACP 未接続（sessions.json から復元されたセッション）は load で復元する
      setIsRestoring(true);
      await window.kiroductor.session.load(sessionId, _cwd);
      const loadedMsgs = await window.kiroductor.session.getMessages(sessionId);
      dispatchChat({ type: 'set', messages: loadedMsgs });
      setIsRestoring(false);
    }
    // load 完了後にモデル情報を取得（load パスでは loadSession がモデル状態を保存した後に呼ぶ必要がある）
    fetchModels(sessionId);
  }

  /** 新規セッション作成後にアクティブセッションを更新する。 */
  async function handleSessionCreated() {
    const id = await window.kiroductor.session.getActive();
    setActiveSessionId(id);
    activeSessionIdRef.current = id;
    setDiffStats(null);
    window.kiroductor.session.list().then(setSessionMappings);
    if (id) {
      const msgs = await window.kiroductor.session.getMessages(id);
      dispatchChat({ type: 'set', messages: msgs });
      fetchDiffStats(id);
      fetchModels(id);
    }
  }

  /** モデルを切り替える。 */
  async function handleSetModel(modelId: string) {
    if (!activeSessionId) return;
    await window.kiroductor.session.setModel(activeSessionId, modelId);
  }

  const activeMapping = sessionMappings.find((s) => s.acpSessionId === activeSessionId);

  return (
    <SidebarProvider className="h-svh">
      <SessionSidebar
        activeSessionId={activeSessionId}
        promptCompletedCount={promptCompletedCount}
        processingSessionIds={processingSessionIds}
        onSwitchSession={handleSwitchSession}
        onSessionCreated={handleSessionCreated}
      />
      <SidebarInset>
        {activeSessionId ? (
          <div className="flex h-full flex-col">
            <ChatView
              ref={chatViewRef}
              sessionId={activeSessionId}
              messages={chatState.messages}
              animSplits={chatState.animSplits}
              isRestoring={isRestoring}
              isProcessing={isProcessing}
              currentBranch={activeMapping?.currentBranch}
              sourceBranch={activeMapping?.sourceBranch}
              onDiffClick={handleDiffClick}
              hasDiffChanges={
                diffStats !== null && (diffStats.insertions > 0 || diffStats.deletions > 0)
              }
              restoreScrollTop={restoreScrollTop}
            />
            <PromptInput
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isProcessing={isProcessing}
              disabled={isProcessing || isRestoring}
              currentModelId={currentModelId}
              availableModels={availableModels}
              onModelChange={handleSetModel}
              comments={comments}
              onRemoveComment={removeComment}
              onClearComments={clearComments}
              onChipClick={() => setDiffDialogOpen(true)}
            />
          </div>
        ) : (
          <>
            <div className="h-10 shrink-0 [-webkit-app-region:drag]" />
            <WelcomeScreen onSessionCreated={handleSessionCreated} />
          </>
        )}
      </SidebarInset>
      <DiffDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        diff={diffData}
        comments={comments}
        onAddComment={addComment}
        onRemoveComment={removeComment}
      />
    </SidebarProvider>
  );
}

export default App;
