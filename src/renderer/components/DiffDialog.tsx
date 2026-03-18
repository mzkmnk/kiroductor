import { memo, useMemo } from 'react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { parseUnifiedDiff } from './parse-unified-diff';

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
}

/**
 * GitHub ライクな左右分割 diff ビューアーダイアログ。
 *
 * `@git-diff-view/react` の `DiffView` コンポーネントを使用して
 * ファイルごとにセクション分けした split diff を表示する。
 */
const DiffDialog = memo(function DiffDialog({ open, onOpenChange, diff }: DiffDialogProps) {
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
              {files.map((file, index) => (
                <div key={`${file.newFileName}-${index}`}>
                  <div className="rounded-t-md border bg-muted px-4 py-2 text-sm font-medium">
                    {file.newFileName === '/dev/null' ? file.oldFileName : file.newFileName}
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
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { DiffDialog };
