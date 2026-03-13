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
    <div className="flex items-end gap-2 border-t border-border bg-card p-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="メッセージを入力… (Enter で送信、Shift+Enter で改行)"
        className="min-h-[80px] flex-1 resize-none bg-input text-foreground placeholder:text-muted-foreground"
        rows={3}
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        size="icon"
        className="size-10 shrink-0 self-end rounded-full bg-primary hover:bg-primary/90 disabled:opacity-30"
        aria-label="送信"
      >
        <ArrowUp className="size-5" />
      </Button>
    </div>
  );
}

export { PromptInput };
