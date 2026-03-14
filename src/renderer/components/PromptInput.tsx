import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

/**
 * PromptInput コンポーネントの props。
 */
interface PromptInputProps {
  /** エージェントが処理中かどうか。true のとき Textarea と Button を disabled にする。 */
  disabled?: boolean;
  /** ユーザーがテキストを送信したときに呼ばれるコールバック。 */
  onSubmit: (text: string) => void;
}

/**
 * ユーザーがテキストを入力して送信するフォーム。
 *
 * - Enter キーで送信、Shift+Enter で改行する。
 * - `disabled` が true のとき Textarea と Button の両方を無効化する。
 */
function PromptInput({ disabled = false, onSubmit }: PromptInputProps) {
  const [text, setText] = useState('');

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-end gap-3 border-t border-border bg-background px-4 py-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        className="min-h-[72px] flex-1 resize-none rounded-2xl border-border bg-secondary shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
        rows={3}
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        size="icon"
        className="size-9 shrink-0 self-end rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-30"
        aria-label="Send"
      >
        <ArrowUp className="size-4" />
      </Button>
    </div>
  );
}

export { PromptInput };
