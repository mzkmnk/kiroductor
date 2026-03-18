import { memo, useMemo } from 'react';
import { DiffView, DiffModeEnum, SplitSide } from '@git-diff-view/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { parseUnifiedDiff } from './parse-unified-diff';
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

/**
 * {@link SplitSide} を `'old' | 'new'` 文字列に変換する。
 */
function splitSideToString(side: SplitSide): 'old' | 'new' {
  return side === SplitSide.old ? 'old' : 'new';
}

/**
 * コメント配列から `extendData` 用のオブジェクトを構築する。
 *
 * @param comments - 対象ファイルのコメント一覧
 * @returns DiffView の extendData prop に渡すオブジェクト
 */
function buildExtendData(comments: DiffComment[]) {
  const oldFile: Record<string, { data: DiffComment[] }> = {};
  const newFile: Record<string, { data: DiffComment[] }> = {};

  for (const comment of comments) {
    const target = comment.side === 'old' ? oldFile : newFile;
    const key = String(comment.startLine);
    if (!target[key]) {
      target[key] = { data: [] };
    }
    target[key].data.push(comment);
  }

  return { oldFile, newFile };
}

/**
 * GitHub ライクな左右分割 diff ビューアーダイアログ。
 *
 * `@git-diff-view/react` の `DiffView` コンポーネントを使用して
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
  const files = useMemo(() => (diff ? parseUnifiedDiff(diff) : []), [diff]);
  const isDark = document.documentElement.classList.contains('dark');

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
                const filePath =
                  file.newFileName === '/dev/null' ? file.oldFileName : file.newFileName;
                const fileComments = comments.filter((c) => c.filePath === filePath);
                const extendData = buildExtendData(fileComments);

                return (
                  <div key={`${file.newFileName}-${index}`}>
                    <div className="rounded-t-md border bg-muted px-4 py-2 text-sm font-medium">
                      {filePath}
                    </div>
                    <div className="overflow-x-auto rounded-b-md border border-t-0">
                      <DiffView
                        data={{
                          oldFile: { fileName: file.oldFileName },
                          newFile: { fileName: file.newFileName },
                          hunks: [file.rawBlock],
                        }}
                        diffViewMode={DiffModeEnum.Split}
                        diffViewTheme={isDark ? 'dark' : 'light'}
                        diffViewHighlight
                        diffViewWrap
                        diffViewFontSize={13}
                        diffViewAddWidget={!!onAddComment}
                        extendData={extendData}
                        renderWidgetLine={({ lineNumber, side, onClose }) => (
                          <DiffCommentInput
                            onSubmit={(content) => {
                              onAddComment?.(
                                filePath,
                                lineNumber,
                                splitSideToString(side),
                                content,
                              );
                            }}
                            onClose={onClose}
                          />
                        )}
                        renderExtendLine={({ data }) => (
                          <DiffCommentBadge
                            comments={data as DiffComment[]}
                            onRemove={(id) => onRemoveComment?.(id)}
                          />
                        )}
                      />
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
