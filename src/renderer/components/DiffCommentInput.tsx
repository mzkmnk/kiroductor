import { useState, useRef, useEffect } from 'react';
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
    <div className="flex flex-col gap-2 border-t bg-card p-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export { DiffCommentInput };
