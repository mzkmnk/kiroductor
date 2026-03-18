import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '../build-review-prompt';
import type { DiffComment } from '../../types/diff-comment';

/** テスト用の DiffComment を生成するヘルパー。 */
function createComment(overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id: 'test-id',
    filePath: 'src/main.ts',
    startLine: 10,
    endLine: 10,
    side: 'new' as const,
    content: 'テストコメント',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildReviewPrompt', () => {
  it('コメントが空の場合はユーザー入力をそのまま返すこと', () => {
    const result = buildReviewPrompt([], 'ユーザーの入力');
    expect(result).toBe('ユーザーの入力');
  });

  it('コメントのみ（ユーザー入力なし）の場合は追加指示セクションを省略すること', () => {
    const comments = [createComment({ content: 'この変数名が気になる' })];
    const result = buildReviewPrompt(comments, '');

    expect(result).toContain('This is a code review from the user.');
    expect(result).toContain('`src/main.ts` line 10 to 10: この変数名が気になる');
    expect(result).not.toContain("User's additional instructions:");
  });

  it('単一コメント + ユーザー入力で正しいフォーマットを返すこと', () => {
    const comments = [createComment({ content: 'この引数追加の意図は？' })];
    const result = buildReviewPrompt(comments, 'エラーハンドリングもチェックしてください');

    expect(result).toBe(
      [
        'This is a code review from the user.',
        '',
        '`src/main.ts` line 10 to 10: この引数追加の意図は？',
        '',
        "User's additional instructions:",
        'エラーハンドリングもチェックしてください',
      ].join('\n'),
    );
  });

  it('複数コメント（複数ファイル）を全て含むこと', () => {
    const comments = [
      createComment({
        id: '1',
        filePath: 'src/services/foo.ts',
        startLine: 10,
        endLine: 13,
        content: '型安全性は大丈夫？',
      }),
      createComment({
        id: '2',
        filePath: 'src/App.tsx',
        startLine: 42,
        endLine: 42,
        content: 'useEffect の依存配列が不足している',
      }),
    ];
    const result = buildReviewPrompt(comments, '全体的にチェックして');

    expect(result).toContain('`src/services/foo.ts` line 10 to 13: 型安全性は大丈夫？');
    expect(result).toContain('`src/App.tsx` line 42 to 42: useEffect の依存配列が不足している');
    expect(result).toContain("User's additional instructions:");
    expect(result).toContain('全体的にチェックして');
  });

  it('ユーザー入力が空白のみの場合は追加指示セクションを省略すること', () => {
    const comments = [createComment()];
    const result = buildReviewPrompt(comments, '   ');

    expect(result).not.toContain("User's additional instructions:");
  });
});
