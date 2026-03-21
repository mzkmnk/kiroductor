/**
 * Diff ビュー上の行単位コメント。
 *
 * ユーザーが diff の特定行（または行範囲）に対して付けたレビューコメントを表す。
 */
export interface DiffComment {
  /** 一意識別子。 */
  id: string;
  /** コメント対象のファイルパス。 */
  filePath: string;
  /** コメント対象の開始行番号。 */
  startLine: number;
  /** コメント対象の終了行番号（単一行の場合は startLine と同値）。 */
  endLine: number;
  /** コメントが付けられた diff の側。 */
  side: 'old' | 'new';
  /** コメント本文。 */
  content: string;
  /** コメント作成日時（ISO 8601 形式）。 */
  createdAt: string;
}
