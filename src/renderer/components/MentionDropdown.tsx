import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Folder, File, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FileEntry } from '../../shared/ipc';

/**
 * MentionDropdown コンポーネントの props。
 */
interface MentionDropdownProps {
  /** アクティブセッション ID。 */
  sessionId: string;
  /** @ 以降のユーザー入力テキスト（フィルタ・ナビゲーション用）。 */
  query: string;
  /** ドロップダウンの表示状態。 */
  visible: boolean;
  /** エントリ選択時のコールバック。 */
  onSelect: (entry: FileEntry) => void;
  /** ドロップダウンを閉じるコールバック。 */
  onClose: () => void;
  /** query を更新するコールバック（フォルダ展開時に使用）。 */
  onQueryChange: (query: string) => void;
}

/** MentionDropdown の命令的ハンドル。親からキーイベントを委譲するために使用する。 */
interface MentionDropdownHandle {
  /** キーボードイベントを処理する。処理した場合は `true` を返す。 */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * ファイル一覧を取得するカスタムフック。
 *
 * @param sessionId - セッション ID
 * @param dirPath - ディレクトリパス
 * @param visible - ドロップダウンの表示状態
 * @returns ファイル一覧と読み込み状態
 */
/**
 * ファイル一覧取得のステート。
 *
 * `null` = 未取得（ローディング中）、`FileEntry[]` = 取得完了。
 */
function useFileEntries(sessionId: string, dirPath: string, visible: boolean) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const depth = dirPath === '' ? 2 : 1;
    window.kiroductor.repo
      .listFiles(sessionId, dirPath, depth)
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
      setEntries(null);
    };
  }, [visible, sessionId, dirPath]);

  return entries;
}

/**
 * @ メンション用のファイル/フォルダ選択ドロップダウン。
 *
 * セッションの作業ディレクトリ配下のファイルツリーを表示し、
 * キーボードおよびクリックで選択できる。
 */
const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(
  function MentionDropdown({ sessionId, query, visible, onSelect, onClose, onQueryChange }, ref) {
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // query を dirPath（ディレクトリ部分）と filter（フィルタ部分）に分割
    const lastSlashIndex = query.lastIndexOf('/');
    const dirPath = lastSlashIndex >= 0 ? query.slice(0, lastSlashIndex) : '';
    const filter = lastSlashIndex >= 0 ? query.slice(lastSlashIndex + 1) : query;

    const entries = useFileEntries(sessionId, dirPath, visible);
    const loading = entries === null;

    // フィルタリング: filter 文字列で path をマッチ
    const filteredEntries = filter
      ? (entries ?? []).filter((e) => {
          const name = e.path.slice(dirPath.length ? dirPath.length + 1 : 0);
          return name.toLowerCase().includes(filter.toLowerCase());
        })
      : (entries ?? []);

    // ハイライトが範囲外にならないように補正（レンダー時に同期的に計算）
    const safeIndex =
      filteredEntries.length === 0 ? 0 : Math.min(highlightedIndex, filteredEntries.length - 1);

    // ハイライト項目をスクロールに追従させる
    useEffect(() => {
      const container = listRef.current;
      if (!container) return;
      const highlighted = container.children[safeIndex] as HTMLElement | undefined;
      highlighted?.scrollIntoView({ block: 'nearest' });
    }, [safeIndex]);

    /** エントリのインデントレベルを計算する。 */
    const getIndentLevel = useCallback(
      (entry: FileEntry): number => {
        const relativePath = dirPath ? entry.path.slice(dirPath.length + 1) : entry.path;
        return relativePath.split('/').length - 1;
      },
      [dirPath],
    );

    /** エントリを選択する。フォルダなら展開、ファイルならメンション挿入。 */
    function selectEntry(entry: FileEntry) {
      if (entry.isDirectory) {
        onQueryChange(entry.path + '/');
      } else {
        onSelect(entry);
      }
    }

    /** キーボードイベントを処理する。PromptInput から呼ばれる。 */
    function handleKeyDown(e: React.KeyboardEvent): boolean {
      if (!visible || filteredEntries.length === 0) return false;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const max = filteredEntries.length - 1;
            return prev > 0 ? prev - 1 : max;
          });
          return true;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const max = filteredEntries.length - 1;
            return prev < max ? prev + 1 : 0;
          });
          return true;
        case 'Enter': {
          e.preventDefault();
          const selected = filteredEntries[safeIndex];
          if (selected) {
            selectEntry(selected);
          }
          return true;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          return true;
        case 'Tab': {
          e.preventDefault();
          // Tab でフォルダを展開
          const tabSelected = filteredEntries[safeIndex];
          if (tabSelected?.isDirectory) {
            onQueryChange(tabSelected.path + '/');
          }
          return true;
        }
        default:
          return false;
      }
    }

    useImperativeHandle(ref, () => ({ handleKeyDown }));

    if (!visible) return null;

    return (
      <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-md rounded-lg border border-border bg-popover shadow-lg">
        {loading ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No files found</div>
        ) : (
          <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
            {filteredEntries.map((entry, index) => (
              <button
                key={entry.path}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                  'hover:bg-accent hover:text-accent-foreground',
                  index === safeIndex && 'bg-accent text-accent-foreground',
                )}
                style={{ paddingLeft: `${12 + getIndentLevel(entry) * 16}px` }}
                onClick={() => selectEntry(entry)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {entry.isDirectory ? (
                  <>
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                    <Folder className="size-3.5 shrink-0 text-blue-500" />
                  </>
                ) : (
                  <>
                    <span className="size-3 shrink-0" />
                    <File className="size-3.5 shrink-0 text-muted-foreground" />
                  </>
                )}
                <span className="truncate">{entry.name}</span>
                {entry.isDirectory && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60">/</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export { MentionDropdown };
export type { MentionDropdownProps, MentionDropdownHandle };
