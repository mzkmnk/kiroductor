import { useState, useEffect } from 'react';
import type { Message, UserMessage } from '../main/repositories/message.repository';
import { ChatView } from './components/ChatView';
import { PromptInput } from './components/PromptInput';

/**
 * アプリケーションのルートコンポーネント。
 */
function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // 初回ロード
    window.kiroductor.session.getMessages().then(setMessages);

    // エージェントからの session/update 通知を受け取るたびにメッセージを再取得する
    const unsubscribe = window.kiroductor.session.onUpdate(() => {
      window.kiroductor.session.getMessages().then(setMessages);
    });

    return unsubscribe;
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ChatView messages={messages} />
      <PromptInput onSubmit={handleSubmit} disabled={isProcessing} />
    </div>
  );
}

export default App;
