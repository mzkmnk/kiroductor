import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';

/**
 * {@link DiffCommentInput} の props。
 */
interface DiffCommentInputProps {
  /** コメント対象の開始行番号。 */
  startLine: number;
  /** コメント対象の終了行番号。 */
  endLine: number;
  /** コメント送信時のコールバック。 */
  onSubmit: (content: string) => void;
  /** キャンセル時のコールバック。 */
  onCancel: () => void;
}

/**
 * diff の行下に表示されるインラインコメント入力フォーム。
 *
 * テキストエリアとSubmit / Cancel ボタンで構成される。
 */
function DiffCommentInput({ startLine, endLine, onSubmit, onCancel }: DiffCommentInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  const lineLabel = startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`;

  return (
    <div className="mx-2 my-1.5 rounded-md border border-blue-300 bg-blue-50 p-2 dark:border-blue-700 dark:bg-blue-950/40">
      <div className="mb-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
        {lineLabel}
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a comment..."
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        rows={2}
      />
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

export { DiffCommentInput };
export type { DiffCommentInputProps };
