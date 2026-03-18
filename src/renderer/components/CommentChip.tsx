import { Paperclip, X } from 'lucide-react';
import type { DiffComment } from '../types/diff-comment';

/**
 * CommentChip コンポーネントの props。
 */
interface CommentChipProps {
  /** 表示するコメント。 */
  comment: DiffComment;
  /** チップクリック時のコールバック。 */
  onClick: (comment: DiffComment) => void;
  /** 削除ボタンクリック時のコールバック。 */
  onRemove: (id: string) => void;
}

/**
 * ファイルパスの末尾セグメントを取得する。
 *
 * @param filePath - フルパス
 * @returns ファイル名部分
 */
function getFileName(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

/**
 * プロンプト入力欄に表示するコメントチップ。
 *
 * ファイル名と行番号をコンパクトに表示し、
 * クリックで diff ダイアログの該当行へジャンプする。
 */
function CommentChip({ comment, onClick, onRemove }: CommentChipProps) {
  const fileName = getFileName(comment.filePath);
  const lineLabel =
    comment.startLine === comment.endLine
      ? `${comment.startLine}`
      : `${comment.startLine}~${comment.endLine}`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
      <button
        onClick={() => onClick(comment)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <Paperclip className="size-3" />
        <span>
          {fileName} {lineLabel}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(comment.id);
        }}
        className="hover:text-foreground"
        aria-label="Remove comment"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export { CommentChip };
