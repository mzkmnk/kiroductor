import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import type { FileData } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { cn } from '../lib/utils';

// =================== Types ===================

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
 * ファイルツリーのノード。ディレクトリまたはファイルを表す。
 */
interface TreeNode {
  /** 表示名（ファイル名またはディレクトリ名）。 */
  name: string;
  /** フルパス（ファイル）またはディレクトリ prefix。 */
  path: string;
  /** ディレクトリなら true。 */
  isDir: boolean;
  /** 子ノード。 */
  children: TreeNode[];
  /** ファイルノードの場合の元データ。 */
  fileData?: FileData;
}

/**
 * diff タイプごとの表示設定。
 */
const DIFF_TYPE_CONFIG = {
  add: { label: 'A', className: 'text-emerald-500 dark:text-emerald-400' },
  delete: { label: 'D', className: 'text-red-500 dark:text-red-400' },
  modify: { label: 'M', className: 'text-amber-500 dark:text-amber-400' },
  rename: { label: 'R', className: 'text-blue-500 dark:text-blue-400' },
  copy: { label: 'C', className: 'text-purple-500 dark:text-purple-400' },
} as const;

// =================== Utilities ===================

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
 * ファイルの追加行数・削除行数を集計する。
 *
 * @param file - {@link FileData} オブジェクト
 * @returns 追加行数と削除行数
 */
function countChanges(file: FileData): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const change of hunk.changes) {
      if (change.type === 'insert') additions++;
      else if (change.type === 'delete') deletions++;
    }
  }
  return { additions, deletions };
}

/**
 * FileData 配列からファイルツリーを構築する。
 *
 * @param files - {@link FileData} 配列
 * @returns ルートレベルのツリーノード配列
 */
function buildTree(files: FileData[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };

  for (const file of files) {
    const filePath = resolveFilePath(file);
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');
      let child = current.children.find((c) => c.isDir && c.name === part);
      if (!child) {
        child = { name: part, path: dirPath, isDir: true, children: [] };
        current.children.push(child);
      }
      current = child;
    }

    const fileName = parts[parts.length - 1];
    current.children.push({
      name: fileName,
      path: filePath,
      isDir: false,
      children: [],
      fileData: file,
    });
  }

  return root.children;
}

// =================== Sub-components ===================

/**
 * {@link TreeNodeItem} の props。
 */
interface TreeNodeItemProps {
  /** ツリーノード。 */
  node: TreeNode;
  /** 現在アクティブなファイルパス。 */
  activeFile: string | null;
  /** ファイル選択時のコールバック。 */
  onSelect: (path: string) => void;
  /** インデント深さ。 */
  depth?: number;
}

/**
 * ファイルツリーの単一ノード（ファイルまたはディレクトリ）を描画する。
 */
function TreeNodeItem({ node, activeFile, onSelect, depth = 0 }: TreeNodeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const indent = depth * 10 + 8;

  if (!node.isDir) {
    const file = node.fileData!;
    const { additions, deletions } = countChanges(file);
    const typeConfig = DIFF_TYPE_CONFIG[file.type];
    const isActive = activeFile === node.path;

    return (
      <button
        onClick={() => onSelect(node.path)}
        title={node.path}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
        style={{ paddingLeft: `${indent}px` }}
      >
        <span className={cn('shrink-0 text-[9px] font-bold tabular-nums', typeConfig.className)}>
          {typeConfig.label}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] tabular-nums opacity-70">
          {additions > 0 && <span className="text-emerald-500">+{additions}</span>}
          {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
        </span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-xs font-medium text-foreground/80 hover:bg-accent/50 hover:text-foreground"
        style={{ paddingLeft: `${indent}px` }}
      >
        {isOpen ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              activeFile={activeFile}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =================== Main Component ===================

/**
 * GitHub ライクな左右分割 diff ビューアーダイアログ。
 *
 * 左ペインにファイルツリー、右ペインに `react-diff-view` の split diff を表示する。
 * ファイルツリーのアイテムをクリックすると対応する diff セクションにスクロールし、
 * スクロール中は {@link IntersectionObserver} でアクティブファイルを自動更新する。
 */
const DiffDialog = memo(function DiffDialog({ open, onOpenChange, diff }: DiffDialogProps) {
  const files = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);
  const tree = useMemo(() => buildTree(files), [files]);
  // ユーザーが明示的に選択したファイルパス（null = 未選択）
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // selectedFile が現在の files にあればそれを、なければ先頭ファイルをアクティブとする
  const activeFile = useMemo(() => {
    if (selectedFile !== null && files.some((f) => resolveFilePath(f) === selectedFile)) {
      return selectedFile;
    }
    return files.length > 0 ? resolveFilePath(files[0]) : null;
  }, [selectedFile, files]);

  // スクロール位置に応じてアクティブファイルを更新する
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || files.length === 0) return;

    const filePaths = files.map(resolveFilePath);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;

        // 最もリスト上位にある可視ファイルをアクティブにする
        const topEntry = visible.sort((a, b) => {
          const ai = filePaths.indexOf(a.target.getAttribute('data-file-path') ?? '');
          const bi = filePaths.indexOf(b.target.getAttribute('data-file-path') ?? '');
          return ai - bi;
        })[0];

        const path = topEntry.target.getAttribute('data-file-path');
        if (path) setSelectedFile(path);
      },
      { root: container, rootMargin: '-10% 0px -60% 0px', threshold: 0 },
    );

    filePaths.forEach((path) => {
      const el = fileRefs.current[path];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [files]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
    fileRefs.current[path]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const totalStats = useMemo(
    () =>
      files.reduce(
        (acc, file) => {
          const { additions, deletions } = countChanges(file);
          return { additions: acc.additions + additions, deletions: acc.deletions + deletions };
        },
        { additions: 0, deletions: 0 },
      ),
    [files],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] sm:max-w-[95vw] flex-col gap-0 overflow-hidden p-0">
        {/* ── Header ── */}
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 border-b px-4 py-3 pr-12">
          <DialogTitle className="text-sm font-semibold">Diff</DialogTitle>
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {files.length} file{files.length !== 1 ? 's' : ''} changed
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="text-emerald-500 dark:text-emerald-400">
                +{totalStats.additions}
              </span>
              <span className="text-red-500 dark:text-red-400">-{totalStats.deletions}</span>
            </div>
          )}
        </DialogHeader>

        {files.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">No changes</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* ── Left: File Tree ── */}
            <div className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Files changed
              </div>
              <div className="flex-1 overflow-y-auto px-1 pb-2">
                {tree.map((node) => (
                  <TreeNodeItem
                    key={node.path}
                    node={node}
                    activeFile={activeFile}
                    onSelect={handleSelectFile}
                  />
                ))}
              </div>
            </div>

            {/* ── Right: Diff Viewer ── */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
              <div className="space-y-5 p-5">
                {files.map((file) => {
                  const filePath = resolveFilePath(file);
                  const { additions, deletions } = countChanges(file);
                  const typeConfig = DIFF_TYPE_CONFIG[file.type];

                  return (
                    <div
                      key={filePath}
                      ref={(el) => {
                        fileRefs.current[filePath] = el;
                      }}
                      data-file-path={filePath}
                      className="overflow-hidden rounded-lg border shadow-xs"
                    >
                      {/* File header */}
                      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                        <span
                          className={cn(
                            'shrink-0 text-[9px] font-bold tabular-nums',
                            typeConfig.className,
                          )}
                        >
                          {typeConfig.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
                          {filePath}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
                          {additions > 0 && (
                            <span className="text-emerald-500 dark:text-emerald-400">
                              +{additions}
                            </span>
                          )}
                          {deletions > 0 && (
                            <span className="text-red-500 dark:text-red-400">-{deletions}</span>
                          )}
                        </div>
                      </div>

                      {/* Diff table */}
                      <div className="overflow-x-auto">
                        <Diff viewType="split" diffType={file.type} hunks={file.hunks}>
                          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                        </Diff>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export { DiffDialog };
