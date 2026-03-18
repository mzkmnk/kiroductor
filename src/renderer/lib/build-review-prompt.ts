import type { DiffComment } from '../types/diff-comment';

/**
 * diff コメントとユーザー入力からレビュープロンプトを組み立てる。
 *
 * コメントが存在する場合はテンプレートに沿ったプロンプトを生成し、
 * コメントがない場合はユーザー入力をそのまま返す。
 *
 * @param comments - diff 上のコメント一覧
 * @param userInput - ユーザーが入力したテキスト
 * @returns 組み立て済みのプロンプト文字列
 */
export function buildReviewPrompt(comments: DiffComment[], userInput: string): string {
  if (comments.length === 0) {
    return userInput;
  }

  const lines: string[] = ['This is a code review from the user.', ''];

  for (const comment of comments) {
    lines.push(
      `\`${comment.filePath}\` line ${comment.startLine} to ${comment.endLine}: ${comment.content}`,
    );
  }

  const trimmedInput = userInput.trim();
  if (trimmedInput.length > 0) {
    lines.push('', "User's additional instructions:", trimmedInput);
  }

  return lines.join('\n');
}
