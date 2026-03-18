import { memo, useMemo } from 'react';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import type { FileData } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

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
 */
const DiffDialog = memo(function DiffDialog({ open, onOpenChange, diff }: DiffDialogProps) {
  const files = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);

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
                return (
                  <div key={`${filePath}-${index}`}>
                    <div className="rounded-t-md border bg-muted px-4 py-2 text-sm font-medium">
                      {filePath}
                    </div>
                    <div className="overflow-x-auto rounded-b-md border border-t-0">
                      <Diff viewType="split" diffType={file.type} hunks={file.hunks}>
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
