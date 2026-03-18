import { useState, useRef, useEffect } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * DiffCommentInput コンポーネントの props。
 */
interface DiffCommentInputProps {
  /** コメント追加時のコールバック。 */
  onSubmit: (content: string) => void;
  /** キャンセル（ウィジェットを閉じる）時のコールバック。 */
  onClose: () => void;
}

/**
 * diff 行に対するインラインコメント入力フォーム。
 *
 * `renderWidgetLine` から呼び出される。
 * テキストエリアにオートフォーカスし、送信またはキャンセルで閉じる。
 * PromptInput と同じカード風のスタイルを採用している。
 */
function DiffCommentInput({ onSubmit, onClose }: DiffCommentInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
          rows={2}
        />
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            <span>Cancel</span>
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim()}
            size="icon"
            className="size-8 rounded-lg bg-primary shadow-sm hover:bg-primary/90 disabled:opacity-30"
            style={{ color: 'hsl(var(--primary-foreground))' }}
            aria-label="Add comment"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { DiffCommentInput };
