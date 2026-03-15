import { useState, useEffect } from 'react';
import type { RepoMapping } from '../../main/repositories/config.repository';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** {@link NewSessionDialog} のプロパティ。 */
interface NewSessionDialogProps {
  /** ダイアログの表示状態。 */
  open: boolean;
  /** ダイアログを閉じる際に呼ばれるコールバック。 */
  onClose: () => void;
  /** 新しいセッションが作成された際に呼ばれるコールバック。 */
  onSessionCreated: () => void;
}

/**
 * 新規セッション作成ダイアログ。
 *
 * 既存リポジトリのドロップダウン選択か、新規クローン URL 入力で
 * worktree を作成し、セッションを開始する。
 */
export function NewSessionDialog({ open, onClose, onSessionCreated }: NewSessionDialogProps) {
  const [repos, setRepos] = useState<RepoMapping[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      window.kiroductor.repo
        .list()
        .then(setRepos)
        .catch(() => setRepos([]));
      setSelectedRepoId('');
      setCloneUrl('');
      setError(null);
    }
  }, [open]);

  /**
   * "Start Session" ボタンのクリックハンドラ。
   *
   * リポジトリ選択済みの場合はそのまま worktree を作成し、
   * URL が入力されている場合は先に clone してから worktree を作成する。
   */
  async function handleStartSession() {
    setError(null);
    setIsStarting(true);
    try {
      let repoId = selectedRepoId;

      if (!repoId && cloneUrl.trim()) {
        const result = await window.kiroductor.repo.clone(cloneUrl.trim());
        repoId = result.repoId;
      }

      if (!repoId) {
        setError('リポジトリを選択するか、クローン URL を入力してください。');
        return;
      }

      const { cwd } = await window.kiroductor.repo.createWorktree(repoId);
      await window.kiroductor.session.create(cwd);
      onSessionCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'セッションの作成に失敗しました。');
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 既存リポジトリ選択 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">クローン済みリポジトリ</label>
            <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
              <SelectTrigger>
                <SelectValue placeholder="リポジトリを選択..." />
              </SelectTrigger>
              <SelectContent>
                {repos.map((repo) => (
                  <SelectItem key={repo.repoId} value={repo.repoId}>
                    {repo.org}/{repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">または</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* 新規クローン URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">リポジトリ URL をクローン</label>
            <Input
              placeholder="https://github.com/org/repo.git"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              disabled={!!selectedRepoId}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleStartSession}
            disabled={isStarting || (!selectedRepoId && !cloneUrl.trim())}
          >
            {isStarting ? 'Starting...' : 'Start Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
