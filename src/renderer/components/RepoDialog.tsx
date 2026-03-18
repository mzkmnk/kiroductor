import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

/** {@link RepoDialog} のプロパティ。 */
interface RepoDialogProps {
  /** ダイアログの表示状態。 */
  open: boolean;
  /** ダイアログの表示状態変更コールバック。 */
  onOpenChange: (open: boolean) => void;
}

/**
 * リポジトリ登録ダイアログ。
 *
 * URL を入力して bare clone を実行し、リポジトリを登録する。
 */
export function RepoDialog({ open, onOpenChange }: RepoDialogProps) {
  const [url, setUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setUrl('');
      setError(null);
    }
  }

  async function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    setIsCloning(true);
    try {
      await window.kiroductor.repo.clone(trimmed);
      setUrl('');
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository.');
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Clone URL</label>
            <Input
              placeholder="https://github.com/org/repo.git"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isCloning}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) handleAdd();
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={handleAdd} disabled={isCloning || !url.trim()}>
            {isCloning ? 'Cloning...' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
