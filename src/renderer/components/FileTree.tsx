import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FileEntry } from '../../shared/ipc';

/**
 * ファイルツリーコンポーネントの Props。
 */
interface FileTreeProps {
  /** 対象セッション ID。 */
  sessionId: string;
  /** 隠しファイル（`.` 始まり）を表示するかどうか。 */
  showHidden: boolean;
  /** 選択中ファイルの相対パス。 */
  selectedFilePath: string | null;
  /** ファイルが選択されたときのコールバック。 */
  onFileSelect: (filePath: string) => void;
}

/**
 * リポジトリのファイルツリーを表示するコンポーネント。
 *
 * ディレクトリのクリックで展開・折りたたみを行い、
 * 必要になった時点で子エントリを遅延取得する。
 *
 * @param sessionId - 対象セッション ID
 * @param showHidden - 隠しファイルを表示するかどうか
 * @param selectedFilePath - 選択中ファイルの相対パス
 * @param onFileSelect - ファイルが選択されたときのコールバック
 */
export function FileTree({ sessionId, showHidden, selectedFilePath, onFileSelect }: FileTreeProps) {
  /** 展開済みディレクトリパスのセット（空文字列はルート）。 */
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  /** dirPath → エントリ一覧のキャッシュ。 */
  const [dirEntries, setDirEntries] = useState<Map<string, FileEntry[]>>(new Map());
  /** 取得中のディレクトリパスのセット（ローディング表示用）。 */
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());

  /** 指定ディレクトリのエントリを取得してキャッシュする。 */
  const fetchDir = useCallback(
    async (dirPath: string) => {
      if (loadingDirs.has(dirPath)) return;
      setLoadingDirs((prev) => new Set(prev).add(dirPath));
      try {
        const entries = await window.kiroductor.repo.listFiles(sessionId, dirPath, 1);
        setDirEntries((prev) => new Map(prev).set(dirPath, entries));
      } catch (err) {
        console.error(`Failed to list files for ${dirPath}:`, err);
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
      }
    },
    [sessionId, loadingDirs],
  );

  // sessionId が変わったら状態をリセットしてルートを再取得
  useEffect(() => {
    setExpandedDirs(new Set());
    setDirEntries(new Map());
    setLoadingDirs(new Set());
    void window.kiroductor.repo.listFiles(sessionId, '', 1).then((entries) => {
      setDirEntries(new Map([['', entries]]));
    });
  }, [sessionId]);

  /** ディレクトリのトグル処理。 */
  function handleToggleDir(dirPath: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
        // 未取得なら子エントリを取得
        if (!dirEntries.has(dirPath)) {
          void fetchDir(dirPath);
        }
      }
      return next;
    });
  }

  /** エントリを hidden フィルタ後に返す。 */
  function filterEntries(entries: FileEntry[]): FileEntry[] {
    if (showHidden) return entries;
    return entries.filter((e) => !e.name.startsWith('.'));
  }

  /** ディレクトリエントリを再帰的にレンダリングする。 */
  function renderEntries(entries: FileEntry[], depth: number): React.ReactNode {
    return filterEntries(entries).map((entry) => {
      const isExpanded = expandedDirs.has(entry.path);
      const isSelected = selectedFilePath === entry.path;

      if (entry.isDirectory) {
        const children = dirEntries.get(entry.path);
        return (
          <div key={entry.path}>
            <button
              className={cn(
                'flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-accent',
              )}
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
              onClick={() => handleToggleDir(entry.path)}
            >
              <span className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5" />
                ) : (
                  <Folder className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="truncate">{entry.name}</span>
            </button>
            {isExpanded && (
              <div>
                {loadingDirs.has(entry.path) ? (
                  <div
                    className="py-0.5 text-xs text-muted-foreground"
                    style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
                  >
                    Loading...
                  </div>
                ) : children ? (
                  renderEntries(children, depth + 1)
                ) : null}
              </div>
            )}
          </div>
        );
      }

      return (
        <button
          key={entry.path}
          className={cn(
            'flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-accent',
            isSelected && 'bg-accent',
          )}
          style={{ paddingLeft: `${depth * 12 + 4 + 14}px` }}
          onClick={() => onFileSelect(entry.path)}
        >
          <span className="shrink-0 text-muted-foreground">
            <File className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{entry.name}</span>
        </button>
      );
    });
  }

  const rootEntries = dirEntries.get('');

  if (!rootEntries) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {loadingDirs.has('') ? 'Loading...' : 'No files'}
      </div>
    );
  }

  return <div className="select-none py-1">{renderEntries(rootEntries, 0)}</div>;
}
