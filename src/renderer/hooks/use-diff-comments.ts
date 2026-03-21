import { useState, useCallback } from 'react';
import type { DiffComment } from '../types/diff-comment';

/**
 * DiffComment の初期状態（空配列）を返す。
 */
export function createDiffCommentsState(): DiffComment[] {
  return [];
}

/**
 * コメントを追加した新しい配列を返す。
 *
 * @param state - 現在のコメント配列
 * @param filePath - 対象ファイルパス
 * @param startLine - 開始行番号
 * @param endLine - 終了行番号
 * @param side - diff の側（old / new）
 * @param content - コメント本文
 * @returns 新しいコメント配列
 */
export function addComment(
  state: DiffComment[],
  filePath: string,
  startLine: number,
  endLine: number,
  side: 'old' | 'new',
  content: string,
): DiffComment[] {
  const comment: DiffComment = {
    id: crypto.randomUUID(),
    filePath,
    startLine,
    endLine,
    side,
    content,
    createdAt: new Date().toISOString(),
  };
  return [...state, comment];
}

/**
 * 指定 ID のコメントを除いた新しい配列を返す。
 *
 * @param state - 現在のコメント配列
 * @param id - 削除するコメントの ID
 * @returns 新しいコメント配列
 */
export function removeComment(state: DiffComment[], id: string): DiffComment[] {
  return state.filter((c) => c.id !== id);
}

/**
 * 空のコメント配列を返す。
 *
 * @returns 空配列
 */
export function clearComments(): DiffComment[] {
  return [];
}

/**
 * diff コメントの CRUD を管理するカスタム hook。
 *
 * @returns コメント一覧と操作関数
 */
export function useDiffComments() {
  const [comments, setComments] = useState<DiffComment[]>(createDiffCommentsState);

  const handleAddComment = useCallback(
    (
      filePath: string,
      startLine: number,
      endLine: number,
      side: 'old' | 'new',
      content: string,
    ) => {
      setComments((prev) => addComment(prev, filePath, startLine, endLine, side, content));
    },
    [],
  );

  const handleRemoveComment = useCallback((id: string) => {
    setComments((prev) => removeComment(prev, id));
  }, []);

  const handleClearComments = useCallback(() => {
    setComments(clearComments());
  }, []);

  return {
    comments,
    addComment: handleAddComment,
    removeComment: handleRemoveComment,
    clearComments: handleClearComments,
  } as const;
}
