import { MessageSquare, X } from 'lucide-react';
import type { DiffComment } from '../types/diff-comment';

/**
 * DiffCommentBadge コンポーネントの props。
 */
interface DiffCommentBadgeProps {
  /** 表示するコメント一覧。 */
  comments: DiffComment[];
  /** コメント削除時のコールバック。 */
  onRemove: (id: string) => void;
}

/**
 * diff 行の直下に表示するコメントバッジ。
 *
 * `renderExtendLine` から呼び出され、
 * その行に紐づく全コメントをバッジとして表示する。
 */
function DiffCommentBadge({ comments, onRemove }: DiffCommentBadgeProps) {
  if (comments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t bg-muted/30 px-4 py-2">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="flex items-start gap-2 rounded-md bg-card px-3 py-2 text-sm shadow-sm"
        >
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 whitespace-pre-wrap">{comment.content}</span>
          <button
            onClick={() => onRemove(comment.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove comment"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export { DiffCommentBadge };
