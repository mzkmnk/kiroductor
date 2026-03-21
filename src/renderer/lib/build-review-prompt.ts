import type { DiffComment } from '../types/diff-comment';

/**
 * diff コメントとユーザー入力テキストからレビュー用プロンプトを組み立てる。
 *
 * コメントがない場合はユーザーテキストをそのまま返す。
 * コメントがある場合はテンプレート形式でコメント情報を付与し、
 * ユーザーテキストがあれば additional instructions として追加する。
 *
 * @param comments - diff 上のコメント一覧
 * @param userText - ユーザーが入力したテキスト
 * @returns 組み立て済みプロンプト文字列
 */
export function buildReviewPrompt(comments: DiffComment[], userText: string): string {
  if (comments.length === 0) {
    return userText;
  }

  const lines: string[] = ['This is a code review from the user.', ''];

  for (const comment of comments) {
    lines.push(`\`${comment.filePath}\` line ${comment.startLine} to ${comment.endLine}:`);
    lines.push(comment.content);
    lines.push('');
  }

  const trimmedUserText = userText.trim();
  if (trimmedUserText) {
    lines.push("User's additional instructions:");
    lines.push(trimmedUserText);
  }

  return lines.join('\n').trimEnd();
}
