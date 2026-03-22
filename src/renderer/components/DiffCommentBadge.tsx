import { MessageSquare, X } from 'lucide-react';
import type { DiffComment } from '../types/diff-comment';

/**
 * {@link DiffCommentBadge} の props。
 */
interface DiffCommentBadgeProps {
  /** 表示するコメント。 */
  comment: DiffComment;
  /** 削除時のコールバック。 */
  onDelete: (id: string) => void;
}

/**
 * diff の行下に表示されるコメントバッジ。
 *
 * コメント内容と削除ボタンを含む。
 */
function DiffCommentBadge({ comment, onDelete }: DiffCommentBadgeProps) {
  return (
    <div className="group/badge mx-2 my-1 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 dark:border-amber-700 dark:bg-amber-950/40">
      <MessageSquare className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {comment.content}
      </p>
      <button
        onClick={() => onDelete(comment.id)}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/badge:opacity-100"
        aria-label="Delete comment"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export { DiffCommentBadge };
export type { DiffCommentBadgeProps };
