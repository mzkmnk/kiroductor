import { useState, useEffect } from 'react';
import type { Message, UserMessage } from '../main/repositories/message.repository';
import { ChatView } from './components/ChatView';
import { PromptInput } from './components/PromptInput';
import { SessionSidebar } from './components/SessionSidebar';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';

/**
 * アプリケーションのルートコンポーネント。
 *
 * Sidebar + Main の2カラムレイアウトを提供する。
 * セッション管理は {@link SessionSidebar} が担い、
 * チャットエリアはアクティブセッションのメッセージを表示する。
 */
function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    // 初回: アクティブセッション ID とメッセージを取得
    window.kiroductor.session.getActive().then(setActiveSessionId);
    window.kiroductor.session.getMessages().then(setMessages);

    // エージェントからの session/update 通知を受け取るたびにメッセージを再取得する
    const unsubUpdate = window.kiroductor.session.onUpdate(() => {
      window.kiroductor.session.getMessages().then(setMessages);
    });

    // セッション切り替え通知を受け取ったらアクティブセッションとメッセージを更新する
    const unsubSwitched = window.kiroductor.session.onSessionSwitched(({ sessionId }) => {
      setActiveSessionId(sessionId);
      window.kiroductor.session.getMessages().then(setMessages);
    });

    return () => {
      unsubUpdate();
      unsubSwitched();
    };
  }, []);

  /**
   * ユーザーのプロンプトを送信する。
   *
   * ユーザーメッセージを楽観的に即時表示してから IPC を呼ぶ。
   * onUpdate が届いたタイミングで main リポジトリの実データに置き換わる。
   *
   * @param text - 送信するテキスト
   */
  async function handleSubmit(text: string) {
    // 楽観的更新: IPC 完了を待たずにユーザーメッセージを即座に表示する
    const optimisticMessage: UserMessage = { id: crypto.randomUUID(), type: 'user', text };
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsProcessing(true);
    await window.kiroductor.session.prompt(text);
    // prompt() 完了後に最終状態を反映する（onUpdate が拾えなかった末尾を補完）
    await window.kiroductor.session.getMessages().then(setMessages);
    setIsProcessing(false);
  }

  /** セッション切り替えハンドラ。session:load でチャット履歴を復元する。 */
  async function handleSwitchSession(sessionId: string, cwd: string) {
    await window.kiroductor.session.load(sessionId, cwd);
    setActiveSessionId(sessionId);
    window.kiroductor.session.getMessages().then(setMessages);
  }

  /** 新規セッション作成後にアクティブセッションを更新する。 */
  async function handleSessionCreated() {
    const id = await window.kiroductor.session.getActive();
    setActiveSessionId(id);
    window.kiroductor.session.getMessages().then(setMessages);
  }

  return (
    <SidebarProvider>
      <SessionSidebar
        activeSessionId={activeSessionId}
        onSwitchSession={handleSwitchSession}
        onSessionCreated={handleSessionCreated}
      />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <ChatView messages={messages} />
          <PromptInput onSubmit={handleSubmit} disabled={isProcessing} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
