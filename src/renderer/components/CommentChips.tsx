import { Paperclip, X } from 'lucide-react';
import type { DiffComment } from '../types/diff-comment';

/**
 * {@link CommentChips} の props。
 */
interface CommentChipsProps {
  /** 表示するコメント一覧。 */
  comments: DiffComment[];
  /** チップクリック時のコールバック。 */
  onChipClick: (comment: DiffComment) => void;
  /** 個別コメント削除時のコールバック。 */
  onRemove: (id: string) => void;
  /** 全コメント削除時のコールバック。 */
  onClearAll: () => void;
}

/**
 * コメント一覧をコンパクトなチップとして表示するバー。
 *
 * 各チップは「ファイル名 行番号」形式で表示し、クリックで diff 内の該当行にスクロールする。
 */
function CommentChips({ comments, onChipClick, onRemove, onClearAll }: CommentChipsProps) {
  if (comments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      {comments.map((comment) => {
        const fileName = comment.filePath.split('/').pop() ?? comment.filePath;
        const lineLabel =
          comment.startLine === comment.endLine
            ? `${comment.startLine}`
            : `${comment.startLine}~${comment.endLine}`;

        return (
          <span
            key={comment.id}
            className="group/chip inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <button
              onClick={() => onChipClick(comment)}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Paperclip className="size-3 text-muted-foreground" />
              <span className="font-mono">
                {fileName} {lineLabel}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(comment.id);
              }}
              className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/chip:opacity-100"
              aria-label={`Remove comment on ${fileName} ${lineLabel}`}
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <button
        onClick={onClearAll}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-3" />
        Clear all
      </button>
    </div>
  );
}

export { CommentChips };
export type { CommentChipsProps };
