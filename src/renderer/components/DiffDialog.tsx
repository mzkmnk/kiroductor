import { memo, useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { parseDiff, Diff, Hunk, tokenize, getChangeKey } from 'react-diff-view';
import type { FileData, HunkTokens, ChangeData } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import refractor from 'refractor';
import {
  ChevronRight,
  ChevronDown,
  FilePlus,
  FileMinus,
  FilePen,
  FileSymlink,
  Copy,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { cn } from '../lib/utils';
import { DiffCommentInput } from './DiffCommentInput';
import { DiffCommentBadge } from './DiffCommentBadge';
import { CommentChips } from './CommentChips';
import { PromptInput } from './PromptInput';
import { buildReviewPrompt } from '../lib/build-review-prompt';
import type { DiffComment } from '../types/diff-comment';
import type { ModelInfo, SessionMode } from '@agentclientprotocol/sdk/dist/schema/index';
import type { ImageAttachment } from '../../shared/ipc';

// =================== Language Detection ===================

/**
 * ファイル拡張子から refractor の言語名を返す。未対応の場合は null を返す。
 *
 * @param filePath - ファイルパス
 * @returns refractor 言語名、または null
 */
function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    xml: 'xml',
    toml: 'toml',
    ini: 'ini',
  };
  return map[ext] ?? null;
}

/**
 * ファイルの hunks をトークナイズしてシンタックスハイライト用トークンを生成する。
 *
 * @param file - {@link FileData} オブジェクト
 * @returns {@link HunkTokens}、またはハイライト不可の場合は null
 */
function getTokens(file: FileData): HunkTokens | null {
  const filePath = file.type === 'delete' ? file.oldPath : file.newPath;
  const language = detectLanguage(filePath);
  if (!language) return null;

  try {
    return tokenize(file.hunks, { highlight: true, refractor, language });
  } catch {
    return null;
  }
}

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
  /** diff 上のコメント一覧。 */
  comments: DiffComment[];
  /** コメント追加時のコールバック。 */
  onAddComment: (
    filePath: string,
    startLine: number,
    endLine: number,
    side: 'old' | 'new',
    content: string,
  ) => void;
  /** コメント削除時のコールバック。 */
  onRemoveComment: (id: string) => void;
  /** 全コメント削除時のコールバック。 */
  onClearComments: () => void;
  /** プロンプト送信時のコールバック。 */
  onSubmit: (text: string, images?: ImageAttachment[]) => void;
  /** プロンプトキャンセル時のコールバック。 */
  onCancel?: () => void;
  /** エージェントがプロンプトを処理中かどうか。 */
  isProcessing?: boolean;
  /** 入力を無効化するかどうか。 */
  disabled?: boolean;
  /** 現在選択中のモデル ID。 */
  currentModelId?: string | null;
  /** 利用可能なモデル一覧。 */
  availableModels?: ModelInfo[];
  /** モデル変更時のコールバック。 */
  onModelChange?: (modelId: string) => void;
  /** 現在選択中の mode ID。 */
  currentModeId?: string | null;
  /** 利用可能な mode 一覧。 */
  availableModes?: SessionMode[];
  /** mode 変更時のコールバック。 */
  onModeChange?: (modeId: string) => void;
  /** アクティブセッション ID。 */
  sessionId?: string | null;
  /** コンテキスト使用率。 */
  contextUsagePercentage?: number | null;
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
 * コメント入力中の行情報。
 */
interface ActiveCommentInput {
  /** 対象ファイルパス。 */
  filePath: string;
  /** 開始行番号。 */
  startLine: number;
  /** 終了行番号。 */
  endLine: number;
  /** diff の側。 */
  side: 'old' | 'new';
}

/**
 * ガタードラッグ中の状態。
 */
interface DragState {
  /** 対象ファイルパス。 */
  filePath: string;
  /** diff の側。 */
  side: 'old' | 'new';
  /** ドラッグ開始行番号。 */
  startLine: number;
  /** 現在のドラッグ位置の行番号。 */
  currentLine: number;
}

/**
 * diff タイプごとの表示設定。
 */
const DIFF_TYPE_CONFIG: Record<string, { icon: LucideIcon; className: string }> = {
  add: { icon: FilePlus, className: 'text-emerald-500 dark:text-emerald-400' },
  delete: { icon: FileMinus, className: 'text-red-500 dark:text-red-400' },
  modify: { icon: FilePen, className: 'text-amber-500 dark:text-amber-400' },
  rename: { icon: FileSymlink, className: 'text-blue-500 dark:text-blue-400' },
  copy: { icon: Copy, className: 'text-purple-500 dark:text-purple-400' },
};

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

/**
 * change オブジェクトから指定 side の行番号を取得する。
 *
 * @param change - diff の変更データ
 * @param side - diff の側
 * @returns 行番号
 */
function getLineNumber(change: ChangeData, side: 'old' | 'new'): number {
  if (change.type === 'normal') {
    return side === 'old' ? change.oldLineNumber : change.newLineNumber;
  }
  return change.lineNumber;
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
        <typeConfig.icon className={cn('size-3 shrink-0', typeConfig.className)} />
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
 * diff の行にホバーで「+」ボタンを表示し、行単位コメントを追加できる。
 * ダイアログ下部にプロンプト入力欄を配置し、コメント付きレビューを AI に送信できる。
 */
const DiffDialog = memo(function DiffDialog({
  open,
  onOpenChange,
  diff,
  comments,
  onAddComment,
  onRemoveComment,
  onClearComments,
  onSubmit,
  onCancel,
  isProcessing = false,
  disabled = false,
  currentModelId,
  availableModels,
  onModelChange,
  currentModeId,
  availableModes,
  onModeChange,
  sessionId,
  contextUsagePercentage,
}: DiffDialogProps) {
  const files = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);
  const tree = useMemo(() => buildTree(files), [files]);
  // ユーザーが明示的に選択したファイルパス（null = 未選択）
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // コメント入力中の行情報
  const [activeCommentInput, setActiveCommentInput] = useState<ActiveCommentInput | null>(null);

  // ガタードラッグ状態
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  /** dragState と dragStateRef を同時に更新する。 */
  const updateDragState = useCallback((next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

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

  // ドラッグ終了時の処理（window の mouseup）
  // 単一クリックは onClick で処理するため、ここでは範囲ドラッグのみ処理する
  useEffect(() => {
    function handleMouseUp() {
      const drag = dragStateRef.current;
      if (!drag) return;

      // ドラッグで行範囲が変わった場合のみフォームを開く（単一クリックは onClick で処理）
      if (drag.startLine !== drag.currentLine) {
        const startLine = Math.min(drag.startLine, drag.currentLine);
        const endLine = Math.max(drag.startLine, drag.currentLine);
        setActiveCommentInput({
          filePath: drag.filePath,
          startLine,
          endLine,
          side: drag.side,
        });
      }
      updateDragState(null);
    }

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [updateDragState]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
    fileRefs.current[path]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /** チップクリック時に該当ファイルにスクロールする。 */
  const handleChipClick = useCallback(
    (comment: DiffComment) => {
      handleSelectFile(comment.filePath);
    },
    [handleSelectFile],
  );

  /** コメント付きプロンプトを組み立てて送信する。 */
  const handlePromptSubmit = useCallback(
    (text: string, images?: ImageAttachment[]) => {
      const builtText = buildReviewPrompt(comments, text);
      onSubmit(builtText, images);
    },
    [comments, onSubmit],
  );

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

  /**
   * ファイルごとのコメントをルックアップする。
   * キー: `${side}:${line}` → コメント配列
   */
  const commentsByFileAndLine = useMemo(() => {
    const map = new Map<string, Map<string, DiffComment[]>>();
    for (const comment of comments) {
      let fileMap = map.get(comment.filePath);
      if (!fileMap) {
        fileMap = new Map();
        map.set(comment.filePath, fileMap);
      }
      // endLine の行にウィジェットを配置
      const key = `${comment.side}:${comment.endLine}`;
      const arr = fileMap.get(key) ?? [];
      arr.push(comment);
      fileMap.set(key, arr);
    }
    return map;
  }, [comments]);

  /**
   * ファイルの widgets マップを構築する。
   */
  function buildWidgets(file: FileData, filePath: string): Record<string, ReactNode> {
    const widgets: Record<string, ReactNode> = {};
    const fileComments = commentsByFileAndLine.get(filePath);

    // 全 change を走査して、コメントまたは入力フォームがある行のウィジェットを構築
    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        const changeKey = getChangeKey(change);

        // この change に対応するウィジェット要素を収集
        const elements: ReactNode[] = [];

        // 既存コメントのバッジ
        if (fileComments) {
          for (const side of ['old', 'new'] as const) {
            const lineNum = getLineNumber(change, side);
            const lineComments = fileComments.get(`${side}:${lineNum}`);
            if (lineComments) {
              for (const comment of lineComments) {
                elements.push(
                  <DiffCommentBadge
                    key={comment.id}
                    comment={comment}
                    onDelete={onRemoveComment}
                  />,
                );
              }
            }
          }
        }

        // アクティブなコメント入力フォーム
        if (
          activeCommentInput &&
          activeCommentInput.filePath === filePath &&
          activeCommentInput.endLine === getLineNumber(change, activeCommentInput.side)
        ) {
          // change の type と side が一致するか確認
          const matchesSide =
            (activeCommentInput.side === 'new' && change.type !== 'delete') ||
            (activeCommentInput.side === 'old' && change.type !== 'insert');

          if (matchesSide) {
            elements.push(
              <DiffCommentInput
                key="input"
                startLine={activeCommentInput.startLine}
                endLine={activeCommentInput.endLine}
                onSubmit={(content) => {
                  onAddComment(
                    activeCommentInput.filePath,
                    activeCommentInput.startLine,
                    activeCommentInput.endLine,
                    activeCommentInput.side,
                    content,
                  );
                  setActiveCommentInput(null);
                }}
                onCancel={() => setActiveCommentInput(null)}
              />,
            );
          }
        }

        if (elements.length > 0) {
          widgets[changeKey] = <>{elements}</>;
        }
      }
    }

    return widgets;
  }

  /**
   * ドラッグ中のハイライト行かどうかを判定する。
   */
  function isHighlightedLine(filePath: string, change: ChangeData): boolean {
    if (!dragState || dragState.filePath !== filePath) return false;

    const lineNum = getLineNumber(change, dragState.side);
    const min = Math.min(dragState.startLine, dragState.currentLine);
    const max = Math.max(dragState.startLine, dragState.currentLine);

    // change の type と side が一致するか確認
    const matchesSide =
      (dragState.side === 'new' && change.type !== 'delete') ||
      (dragState.side === 'old' && change.type !== 'insert');

    return matchesSide && lineNum >= min && lineNum <= max;
  }

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
                  const widgets = buildWidgets(file, filePath);

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
                        <typeConfig.icon
                          className={cn('size-3.5 shrink-0', typeConfig.className)}
                        />
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
                        <Diff
                          viewType="split"
                          diffType={file.type}
                          hunks={file.hunks}
                          tokens={getTokens(file)}
                          widgets={widgets}
                          renderGutter={({ change, side, inHoverState, renderDefault }) => {
                            if (inHoverState && !dragState) {
                              const effectiveSide =
                                change.type === 'insert'
                                  ? 'new'
                                  : change.type === 'delete'
                                    ? 'old'
                                    : (side ?? 'new');
                              const lineNum = getLineNumber(change, effectiveSide);
                              return (
                                <span className="diff-comment-gutter flex items-center">
                                  <button
                                    className="mr-0.5 flex size-4 items-center justify-center rounded bg-blue-500 text-white opacity-80 hover:opacity-100"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      // ドラッグ選択用: mousedown で dragState を開始
                                      updateDragState({
                                        filePath,
                                        side: effectiveSide,
                                        startLine: lineNum,
                                        currentLine: lineNum,
                                      });
                                    }}
                                    aria-label="Add comment"
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                  {renderDefault()}
                                </span>
                              );
                            }
                            return renderDefault();
                          }}
                          gutterEvents={{
                            onClick: ({ change, side: eventSide }) => {
                              // 単一クリック: ガターをクリックでコメント入力フォームを開く
                              if (!change) return;
                              const effectiveSide =
                                change.type === 'insert'
                                  ? 'new'
                                  : change.type === 'delete'
                                    ? 'old'
                                    : (eventSide ?? 'new');
                              const lineNum = getLineNumber(change, effectiveSide);
                              setActiveCommentInput({
                                filePath,
                                startLine: lineNum,
                                endLine: lineNum,
                                side: effectiveSide,
                              });
                            },
                            onMouseEnter: ({ change, side: eventSide }) => {
                              const drag = dragStateRef.current;
                              if (!drag || !change) return;
                              const effectiveSide = eventSide ?? drag.side;
                              if (effectiveSide !== drag.side) return;
                              const lineNum = getLineNumber(change, effectiveSide);
                              updateDragState({ ...drag, currentLine: lineNum });
                            },
                          }}
                          codeEvents={{
                            onMouseEnter: ({ change, side: eventSide }) => {
                              const drag = dragStateRef.current;
                              if (!drag || !change) return;
                              const effectiveSide = eventSide ?? drag.side;
                              if (effectiveSide !== drag.side) return;
                              const lineNum = getLineNumber(change, effectiveSide);
                              updateDragState({ ...drag, currentLine: lineNum });
                            },
                          }}
                          generateLineClassName={({ changes, defaultGenerate }) => {
                            const base = defaultGenerate();
                            const hasHighlight = changes.some((c) =>
                              isHighlightedLine(filePath, c),
                            );
                            if (hasHighlight) {
                              return `${base ?? ''} diff-line-drag-highlight`;
                            }
                            return base;
                          }}
                        >
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

        {/* ── Footer: Comment Chips + Prompt Input ── */}
        {files.length > 0 && (
          <div className="shrink-0 border-t">
            <CommentChips
              comments={comments}
              onChipClick={handleChipClick}
              onRemove={onRemoveComment}
              onClearAll={onClearComments}
            />
            <PromptInput
              onSubmit={handlePromptSubmit}
              onCancel={onCancel}
              isProcessing={isProcessing}
              disabled={disabled}
              currentModelId={currentModelId}
              availableModels={availableModels}
              onModelChange={onModelChange}
              currentModeId={currentModeId}
              availableModes={availableModes}
              onModeChange={onModeChange}
              sessionId={sessionId}
              contextUsagePercentage={contextUsagePercentage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export { DiffDialog };
