import { useState, useCallback } from 'react';
import type { DiffComment } from '../types/diff-comment';

/**
 * {@link useDiffComments} フックの返却型。
 */
interface UseDiffCommentsReturn {
  /** 現在のコメント一覧。 */
  comments: DiffComment[];
  /** diff 行にコメントを追加する。 */
  addComment: (filePath: string, line: number, side: 'old' | 'new', content: string) => void;
  /** 指定 ID のコメントを削除する。 */
  removeComment: (id: string) => void;
  /** 全コメントを削除する。 */
  clearComments: () => void;
}

/**
 * diff 行単位コメントの CRUD 状態管理フック。
 *
 * コメントはセッション内のみ（エフェメラル）で、
 * セッション切り替え時に `clearComments()` で破棄する想定。
 *
 * @returns コメント一覧と操作関数
 */
export function useDiffComments(): UseDiffCommentsReturn {
  const [comments, setComments] = useState<DiffComment[]>([]);

  const addComment = useCallback(
    (filePath: string, line: number, side: 'old' | 'new', content: string) => {
      const comment: DiffComment = {
        id: crypto.randomUUID(),
        filePath,
        startLine: line,
        endLine: line,
        side,
        content,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, comment]);
    },
    [],
  );

  const removeComment = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearComments = useCallback(() => {
    setComments([]);
  }, []);

  return { comments, addComment, removeComment, clearComments };
}
