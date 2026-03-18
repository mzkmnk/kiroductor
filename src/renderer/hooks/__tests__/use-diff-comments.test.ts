// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiffComments } from '../use-diff-comments';

describe('useDiffComments', () => {
  it('初期状態は空配列であること', () => {
    const { result } = renderHook(() => useDiffComments());
    expect(result.current.comments).toEqual([]);
  });

  it('addComment でコメントが追加されること', () => {
    const { result } = renderHook(() => useDiffComments());

    act(() => {
      result.current.addComment('src/main.ts', 10, 'new', 'テストコメント');
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]).toMatchObject({
      filePath: 'src/main.ts',
      startLine: 10,
      endLine: 10,
      side: 'new',
      content: 'テストコメント',
    });
    expect(result.current.comments[0].id).toBeTruthy();
    expect(result.current.comments[0].createdAt).toBeTruthy();
  });

  it('同じ行・ファイルに複数コメントを追加できること', () => {
    const { result } = renderHook(() => useDiffComments());

    act(() => {
      result.current.addComment('src/main.ts', 10, 'new', 'コメント1');
      result.current.addComment('src/main.ts', 10, 'new', 'コメント2');
    });

    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0].id).not.toBe(result.current.comments[1].id);
  });

  it('removeComment で指定 ID のコメントのみ削除されること', () => {
    const { result } = renderHook(() => useDiffComments());

    act(() => {
      result.current.addComment('src/main.ts', 10, 'new', 'コメント1');
      result.current.addComment('src/main.ts', 20, 'old', 'コメント2');
    });

    const idToRemove = result.current.comments[0].id;

    act(() => {
      result.current.removeComment(idToRemove);
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].content).toBe('コメント2');
  });

  it('clearComments で全コメントが削除されること', () => {
    const { result } = renderHook(() => useDiffComments());

    act(() => {
      result.current.addComment('src/main.ts', 10, 'new', 'コメント1');
      result.current.addComment('src/App.tsx', 42, 'new', 'コメント2');
    });

    act(() => {
      result.current.clearComments();
    });

    expect(result.current.comments).toEqual([]);
  });
});
