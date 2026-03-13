import { useState } from 'react';
import { PromptInput } from './components/PromptInput';

/**
 * アプリケーションのルートコンポーネント。
 */
function App() {
  const [isProcessing, setIsProcessing] = useState(false);

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1" />
      <PromptInput onSubmit={handleSubmit} disabled={isProcessing} />
    </div>
  );
}

export default App;
