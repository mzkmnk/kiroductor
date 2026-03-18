import { useState, useEffect } from 'react';
import type { RepoMapping } from '../../main/features/config/config.repository';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
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
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      window.kiroductor.repo
        .list()
        .then(setRepos)
        .catch(() => setRepos([]));
      setSelectedRepoId('');
      setBranches([]);
      setSelectedBranch('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!selectedRepoId) {
      setBranches([]);
      setSelectedBranch('');
      return;
    }
    setIsFetchingBranches(true);
    setBranches([]);
    setSelectedBranch('');
    window.kiroductor.repo
      .listBranches(selectedRepoId)
      .then((result) => {
        console.log('[listBranches] repoId:', selectedRepoId, 'branches:', result);
        setBranches(result);
      })
      .catch((err) => {
        console.error('[listBranches] error:', err);
        setBranches([]);
      })
      .finally(() => setIsFetchingBranches(false));
  }, [selectedRepoId]);

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
      const repoId = selectedRepoId;

      if (!repoId) {
        setError('Please select a repository.');
        return;
      }

      const { cwd, branch, sourceBranch } = await window.kiroductor.repo.createWorktree(
        repoId,
        selectedBranch || undefined,
      );
      await window.kiroductor.session.create(cwd, branch, sourceBranch);
      onSessionCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session.');
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
          {repos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No repositories registered. Add one from the sidebar footer.
            </p>
          )}

          {/* リポジトリ選択 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Repository</label>
            <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a repository..." />
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

          {/* ブランチ選択 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Branch</label>
            <Select
              value={selectedBranch}
              onValueChange={setSelectedBranch}
              disabled={!selectedRepoId || isFetchingBranches}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={isFetchingBranches ? 'Loading branches...' : 'HEAD (default)'}
                />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleStartSession}
            disabled={isStarting || !selectedRepoId}
          >
            {isStarting ? 'Starting...' : 'Start Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
