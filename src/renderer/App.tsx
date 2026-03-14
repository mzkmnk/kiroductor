import { useState, useEffect } from 'react';
import type { AgentMessage, Message, UserMessage } from '../main/repositories/message.repository';
import { MessageBubble } from './components/MessageBubble';
import { PromptInput } from './components/PromptInput';

/**
 * アプリケーションのルートコンポーネント。
 */
function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    window.kiroductor.session.getMessages().then(setMessages);
  }, []);

  /**
   * ユーザーのプロンプトを送信する。
   *
   * @param text - 送信するテキスト
   */
  async function handleSubmit(text: string) {
    setIsProcessing(true);
    await window.kiroductor.session.prompt(text);
    setIsProcessing(false);
  }

  const chatMessages = messages.filter(
    (m): m is UserMessage | AgentMessage => m.type === 'user' || m.type === 'agent',
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
      <PromptInput onSubmit={handleSubmit} disabled={isProcessing} />
    </div>
  );
}

export default App;
