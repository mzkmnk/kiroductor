/**
 * diff 行に対するユーザーコメントのデータ型。
 *
 * diff ビュー上で行単位にコメントを付与し、
 * AI レビュープロンプトの組み立てに使用する。
 */
export interface DiffComment {
  /** コメントの一意識別子。 */
  id: string;
  /** コメント対象のファイルパス。 */
  filePath: string;
  /** コメント対象の開始行番号。 */
  startLine: number;
  /** コメント対象の終了行番号（単一行の場合は startLine と同値）。 */
  endLine: number;
  /** コメント対象の diff 側（old: 変更前、new: 変更後）。 */
  side: 'old' | 'new';
  /** コメント本文。 */
  content: string;
  /** コメント作成日時（ISO 8601 形式）。 */
  createdAt: string;
}
