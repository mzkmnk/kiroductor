import { useState, useReducer, useEffect, useRef } from 'react';
import type { AgentMessage, Message, UserMessage } from '../main/repositories/message.repository';
import { ChatView } from './components/ChatView';
import { PromptInput } from './components/PromptInput';
import { SessionSidebar } from './components/SessionSidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';

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

  // ref でアクティブセッション ID を追跡（コールバック内で最新値を参照するため）
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    // 初回: アクティブセッション ID とメッセージを取得
    window.kiroductor.session.getActive().then((id) => {
      setActiveSessionId(id);
      activeSessionIdRef.current = id;
      if (id) {
        window.kiroductor.session
          .getMessages(id)
          .then((msgs) => dispatchChat({ type: 'set', messages: msgs }));
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
      }
      setPromptCompletedCount((c) => c + 1);
    });

    return () => {
      unsubUpdate();
      unsubSwitched();
      unsubCompleted();
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
  async function handleSubmit(text: string) {
    if (!activeSessionId) return;
    // 楽観的更新: IPC 完了を待たずにユーザーメッセージを即座に表示する
    const optimisticMessage: UserMessage = { id: crypto.randomUUID(), type: 'user', text };
    dispatchChat({ type: 'append', message: optimisticMessage });
    setIsProcessing(true);
    setProcessingSessionIds((prev) => new Set(prev).add(activeSessionId));
    await window.kiroductor.session.prompt(text, activeSessionId);
    // prompt() 完了後に最終状態を反映する（onUpdate が拾えなかった末尾を補完）
    const msgs = await window.kiroductor.session.getMessages(activeSessionId);
    dispatchChat({ type: 'set', messages: msgs });
    setIsProcessing(false);
  }

  /** セッション切り替えハンドラ。メモリ上のメッセージを表示する。 */
  async function handleSwitchSession(sessionId: string, _cwd: string) {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    dispatchChat({ type: 'clear' });

    // 切り替え先セッションが処理中かどうかで isProcessing を更新
    setIsProcessing(processingSessionIds.has(sessionId));

    // メッセージがメモリ上にある場合はそのまま表示する
    const msgs = await window.kiroductor.session.getMessages(sessionId);
    if (msgs.length > 0) {
      dispatchChat({ type: 'set', messages: msgs });
    } else {
      // メモリにメッセージがない場合（初回ロード）は load で復元する
      setIsRestoring(true);
      await window.kiroductor.session.load(sessionId, _cwd);
      const loadedMsgs = await window.kiroductor.session.getMessages(sessionId);
      dispatchChat({ type: 'set', messages: loadedMsgs });
      setIsRestoring(false);
    }
  }

  /** 新規セッション作成後にアクティブセッションを更新する。 */
  async function handleSessionCreated() {
    const id = await window.kiroductor.session.getActive();
    setActiveSessionId(id);
    activeSessionIdRef.current = id;
    const msgs = await window.kiroductor.session.getMessages();
    dispatchChat({ type: 'set', messages: msgs });
  }

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
              messages={chatState.messages}
              animSplits={chatState.animSplits}
              isRestoring={isRestoring}
            />
            <PromptInput
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isProcessing={isProcessing}
              disabled={isProcessing || isRestoring}
            />
          </div>
        ) : (
          <WelcomeScreen onSessionCreated={handleSessionCreated} />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
