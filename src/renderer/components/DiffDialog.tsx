import { memo, useMemo, useState } from 'react';
import { parseDiff, Diff, Hunk, getChangeKey } from 'react-diff-view';
import type { ChangeData, FileData } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { DiffCommentInput } from './DiffCommentInput';
import { DiffCommentBadge } from './DiffCommentBadge';
import type { DiffComment } from '../types/diff-comment';

/**
 * DiffDialog コンポーネントの props。
 */
interface DiffDialogProps {
  /** ダイアログの表示状態。 */
  open: boolean;
  /** ダイアログの表示状態変更コールバック。 */
  onOpenChange: (open: boolean) => void;
  /** unified diff 文字列。null の場合は「差分なし」を表示する。 */
  diff: string | null;
  /** diff 行に対するコメント一覧。 */
  comments?: DiffComment[];
  /** コメント追加時のコールバック。 */
  onAddComment?: (filePath: string, line: number, side: 'old' | 'new', content: string) => void;
  /** コメント削除時のコールバック。 */
  onRemoveComment?: (id: string) => void;
}

/** アクティブなコメント入力の状態。 */
interface ActiveInput {
  /** 対象ファイルパス。 */
  filePath: string;
  /** {@link getChangeKey} で生成した change key。 */
  changeKey: string;
  /** コメント対象の行番号。 */
  lineNumber: number;
  /** コメント対象の diff 側。 */
  side: 'old' | 'new';
}

/**
 * `ChangeData` とガターサイドからコメント用の行情報を抽出する。
 *
 * @param change - diff の変更オブジェクト
 * @param gutterSide - クリックされたガターのサイド
 * @returns 行番号とサイドのペア
 */
function getLineInfo(
  change: ChangeData,
  gutterSide: 'old' | 'new',
): { lineNumber: number; side: 'old' | 'new' } {
  if (change.type === 'insert') return { lineNumber: change.lineNumber, side: 'new' };
  if (change.type === 'delete') return { lineNumber: change.lineNumber, side: 'old' };
  // normal (context) line: 使用するガターサイドに応じた行番号を返す
  return {
    lineNumber: gutterSide === 'old' ? change.oldLineNumber : change.newLineNumber,
    side: gutterSide,
  };
}

/**
 * {@link DiffComment} の (startLine, side) から `react-diff-view` の change key を生成する。
 *
 * 変更行（追加・削除）を対象としているため、
 * `'new'` → insert key (`I{n}`)、`'old'` → delete key (`D{n}`) とする。
 *
 * @param comment - 対象コメント
 * @returns change key 文字列
 */
function commentToChangeKey(comment: DiffComment): string {
  return comment.side === 'new' ? `I${comment.startLine}` : `D${comment.startLine}`;
}

/**
 * ファイルパスを解決する。削除ファイルは旧パスを返す。
 *
 * @param file - {@link FileData} オブジェクト
 * @returns 表示用ファイルパス
 */
function resolveFilePath(file: FileData): string {
  return file.type === 'delete' ? file.oldPath : file.newPath;
}

/**
 * GitHub ライクな左右分割 diff ビューアーダイアログ。
 *
 * `react-diff-view` の {@link Diff} コンポーネントを使用して
 * ファイルごとにセクション分けした split diff を表示する。
 * 各行に対してコメントの追加・表示・削除が可能。
 */
const DiffDialog = memo(function DiffDialog({
  open,
  onOpenChange,
  diff,
  comments = [],
  onAddComment,
  onRemoveComment,
}: DiffDialogProps) {
  const files = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);
  const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[80vw] sm:max-w-[80vw] flex-col">
        <DialogHeader>
          <DialogTitle>Diff</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No changes</p>
          ) : (
            <div className="space-y-4">
              {files.map((file, index) => {
                const filePath = resolveFilePath(file);
                const fileComments = comments.filter((c) => c.filePath === filePath);

                // コメントを change key でグルーピングして DiffCommentBadge を生成
                const commentsByKey: Record<string, DiffComment[]> = {};
                for (const comment of fileComments) {
                  const key = commentToChangeKey(comment);
                  if (!commentsByKey[key]) commentsByKey[key] = [];
                  commentsByKey[key].push(comment);
                }

                const widgets: Record<string, React.ReactNode> = Object.fromEntries(
                  Object.entries(commentsByKey).map(([key, lineComments]) => [
                    key,
                    <DiffCommentBadge
                      key={key}
                      comments={lineComments}
                      onRemove={(id) => onRemoveComment?.(id)}
                    />,
                  ]),
                );

                // アクティブな行にコメント入力フォームを追加（バッジより優先）
                if (activeInput?.filePath === filePath) {
                  const { changeKey, lineNumber, side } = activeInput;
                  widgets[changeKey] = (
                    <DiffCommentInput
                      onSubmit={(content) => {
                        onAddComment?.(filePath, lineNumber, side, content);
                        setActiveInput(null);
                      }}
                      onClose={() => setActiveInput(null)}
                    />
                  );
                }

                return (
                  <div key={`${filePath}-${index}`}>
                    <div className="rounded-t-md border bg-muted px-4 py-2 text-sm font-medium">
                      {filePath}
                    </div>
                    <div className="overflow-x-auto rounded-b-md border border-t-0">
                      <Diff
                        viewType="split"
                        diffType={file.type}
                        hunks={file.hunks}
                        widgets={widgets}
                        renderGutter={
                          onAddComment
                            ? ({ change, side, renderDefault }) => (
                                <span
                                  className="block cursor-pointer"
                                  onClick={() => {
                                    const key = getChangeKey(change);
                                    const { lineNumber, side: commentSide } = getLineInfo(
                                      change,
                                      side,
                                    );
                                    setActiveInput((prev) =>
                                      prev?.changeKey === key && prev?.filePath === filePath
                                        ? null
                                        : {
                                            filePath,
                                            changeKey: key,
                                            lineNumber,
                                            side: commentSide,
                                          },
                                    );
                                  }}
                                >
                                  {renderDefault()}
                                </span>
                              )
                            : undefined
                        }
                      >
                        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                      </Diff>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { DiffDialog };
