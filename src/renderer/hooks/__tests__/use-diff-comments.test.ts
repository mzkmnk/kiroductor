import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDiffCommentsState,
  addComment,
  removeComment,
  clearComments,
} from '../use-diff-comments';
import type { DiffComment } from '../../types/diff-comment';

describe('useDiffComments ロジック', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'test-uuid-1' as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it('初期状態は空配列を返す', () => {
    const state = createDiffCommentsState();
    expect(state).toEqual([]);
  });

  it('addComment でコメントを追加できる', () => {
    const state = createDiffCommentsState();
    const result = addComment(state, 'src/foo.ts', 10, 10, 'new', 'Fix this');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'test-uuid-1',
      filePath: 'src/foo.ts',
      startLine: 10,
      endLine: 10,
      side: 'new',
      content: 'Fix this',
    });
    expect(result[0].createdAt).toBeDefined();
  });

  it('addComment で行範囲コメントを追加できる', () => {
    const state = createDiffCommentsState();
    const result = addComment(state, 'src/foo.ts', 10, 15, 'old', 'Range comment');

    expect(result[0]).toMatchObject({
      startLine: 10,
      endLine: 15,
    });
  });

  it('複数の addComment でコメントが蓄積される', () => {
    let state = createDiffCommentsState();
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('uuid-1' as `${string}-${string}-${string}-${string}-${string}`)
      .mockReturnValueOnce('uuid-2' as `${string}-${string}-${string}-${string}-${string}`);

    state = addComment(state, 'src/foo.ts', 10, 10, 'new', 'First');
    state = addComment(state, 'src/bar.ts', 20, 20, 'old', 'Second');

    expect(state).toHaveLength(2);
    expect(state[0].content).toBe('First');
    expect(state[1].content).toBe('Second');
  });

  it('removeComment で指定 ID のコメントを削除できる', () => {
    let state: DiffComment[] = [
      {
        id: 'keep',
        filePath: 'src/foo.ts',
        startLine: 10,
        endLine: 10,
        side: 'new',
        content: 'Keep',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'remove',
        filePath: 'src/bar.ts',
        startLine: 20,
        endLine: 20,
        side: 'old',
        content: 'Remove',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    state = removeComment(state, 'remove');

    expect(state).toHaveLength(1);
    expect(state[0].id).toBe('keep');
  });

  it('clearComments で全コメントを削除できる', () => {
    const state: DiffComment[] = [
      {
        id: '1',
        filePath: 'src/foo.ts',
        startLine: 10,
        endLine: 10,
        side: 'new',
        content: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(state).toHaveLength(1);
    const result = clearComments();
    expect(result).toEqual([]);
  });

  it('存在しない ID を removeComment しても元の配列を返す', () => {
    const state: DiffComment[] = [
      {
        id: '1',
        filePath: 'src/foo.ts',
        startLine: 10,
        endLine: 10,
        side: 'new',
        content: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = removeComment(state, 'nonexistent');
    expect(result).toHaveLength(1);
  });
});
