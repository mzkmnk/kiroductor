import { useState, useEffect } from 'react';
import type { RepoMapping } from '../../main/features/config/config.repository';
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
 * セッションの自動作成は行わない。
 */
export function RepoDialog({ open, onOpenChange }: RepoDialogProps) {
  const [repos, setRepos] = useState<RepoMapping[]>([]);
  const [url, setUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      refreshRepos();
      setUrl('');
      setError(null);
    }
  }, [open]);

  /** 登録済みリポジトリ一覧を再取得する。 */
  function refreshRepos() {
    window.kiroductor.repo
      .list()
      .then(setRepos)
      .catch(() => setRepos([]));
  }

  /** URL を bare clone してリポジトリを登録する。 */
  async function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    setIsCloning(true);
    try {
      await window.kiroductor.repo.clone(trimmed);
      setUrl('');
      refreshRepos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository.');
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Repositories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 登録済みリポジトリ一覧 */}
          {repos.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Registered</label>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {repos.map((repo) => (
                  <li
                    key={repo.repoId}
                    className="rounded-md border px-3 py-2 text-sm text-foreground"
                  >
                    <span className="font-medium">
                      {repo.org}/{repo.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{repo.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {repos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No repositories registered yet.
            </p>
          )}

          {/* URL 入力 + 登録ボタン */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Clone URL</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://github.com/org/repo.git"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isCloning}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim()) handleAdd();
                }}
              />
              <Button onClick={handleAdd} disabled={isCloning || !url.trim()}>
                {isCloning ? 'Cloning...' : 'Add'}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
