import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '../build-review-prompt';
import type { DiffComment } from '../../types/diff-comment';

function createComment(overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id: 'comment-1',
    filePath: 'src/main/services/foo.service.ts',
    startLine: 10,
    endLine: 10,
    side: 'new' as const,
    content: 'Is this type-safe?',
    createdAt: '2026-03-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildReviewPrompt', () => {
  it('コメントなしの場合はユーザーテキストをそのまま返す', () => {
    const result = buildReviewPrompt([], 'Fix the bug');
    expect(result).toBe('Fix the bug');
  });

  it('単一コメント + ユーザーテキストで正しいフォーマットを返す', () => {
    const comments = [createComment()];
    const result = buildReviewPrompt(comments, 'Please review');

    expect(result).toContain('This is a code review from the user.');
    expect(result).toContain('`src/main/services/foo.service.ts` line 10 to 10:');
    expect(result).toContain('Is this type-safe?');
    expect(result).toContain("User's additional instructions:");
    expect(result).toContain('Please review');
  });

  it('行範囲コメントの場合は startLine to endLine 形式で出力する', () => {
    const comments = [createComment({ startLine: 10, endLine: 13 })];
    const result = buildReviewPrompt(comments, '');

    expect(result).toContain('`src/main/services/foo.service.ts` line 10 to 13:');
  });

  it('複数ファイルの複数コメントを全件出力する', () => {
    const comments = [
      createComment({ id: '1', filePath: 'src/foo.ts', startLine: 10, content: 'Comment A' }),
      createComment({
        id: '2',
        filePath: 'src/bar.ts',
        startLine: 42,
        endLine: 42,
        content: 'Comment B',
      }),
      createComment({
        id: '3',
        filePath: 'src/foo.ts',
        startLine: 20,
        endLine: 25,
        content: 'Comment C',
      }),
    ];
    const result = buildReviewPrompt(comments, 'Check errors');

    expect(result).toContain('`src/foo.ts` line 10 to 10:');
    expect(result).toContain('Comment A');
    expect(result).toContain('`src/bar.ts` line 42 to 42:');
    expect(result).toContain('Comment B');
    expect(result).toContain('`src/foo.ts` line 20 to 25:');
    expect(result).toContain('Comment C');
    expect(result).toContain('Check errors');
  });

  it('ユーザーテキストが空でコメントありの場合は additional instructions セクションを省略する', () => {
    const comments = [createComment()];
    const result = buildReviewPrompt(comments, '');

    expect(result).toContain('This is a code review from the user.');
    expect(result).toContain('Is this type-safe?');
    expect(result).not.toContain("User's additional instructions:");
  });

  it('ユーザーテキストが空白のみの場合も additional instructions セクションを省略する', () => {
    const comments = [createComment()];
    const result = buildReviewPrompt(comments, '   ');

    expect(result).not.toContain("User's additional instructions:");
  });
});
