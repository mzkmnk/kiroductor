import { useState, useRef } from 'react';
import { X, PanelRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileTree } from './FileTree';

/** サイドバーのデフォルト幅（px）。 */
const DEFAULT_WIDTH = 288;
/** サイドバーの最小幅（px）。 */
const MIN_WIDTH = 160;

/**
 * 右サイドバーコンポーネントの Props。
 */
interface FileTreeSidebarProps {
  /** 現在アクティブなセッション ID。`null` の場合はセッションなし。 */
  activeSessionId: string | null;
}

/**
 * リポジトリのファイルツリーを表示する右サイドバー。
 *
 * 開閉トグル、隠しファイルの表示切り替え、
 * ファイルツリーのインタラクティブな表示を提供する。
 * 左端のドラッグハンドルで幅を変更できる（最大: 画面幅の半分）。
 *
 * @param activeSessionId - 現在アクティブなセッション ID
 */
export function FileTreeSidebar({ activeSessionId }: FileTreeSidebarProps) {
  /** サイドバーの開閉状態。 */
  const [isOpen, setIsOpen] = useState(true);
  /** 隠しファイルを表示するかどうか。 */
  const [showHidden, setShowHidden] = useState(false);
  /** サイドバーの幅（px）。 */
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  /**
   * 選択中ファイルの情報。sessionId とセットで保持し、
   * セッションが変わったときに自動的に選択をリセットする。
   */
  const [selectedState, setSelectedState] = useState<{
    sessionId: string;
    filePath: string;
  } | null>(null);

  /** ドラッグ開始時の情報を保持する ref。 */
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  /** 現在のセッションに対応する選択中ファイルパス。 */
  const selectedFilePath =
    selectedState?.sessionId === activeSessionId ? selectedState.filePath : null;

  /** ファイル選択ハンドラ。 */
  function handleFileSelect(filePath: string) {
    if (!activeSessionId) return;
    setSelectedState({ sessionId: activeSessionId, filePath });
  }

  /** ドラッグハンドルの mousedown ハンドラ。 */
  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      const maxWidth = Math.floor(window.innerWidth / 2);
      setWidth(Math.min(maxWidth, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta)));
    }

    function onMouseUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // セッションがない場合は開くボタンのみ表示
  if (!activeSessionId) {
    return (
      <div className="flex shrink-0 flex-col border-l border-border">
        <div className="flex h-10 items-center justify-center px-2">
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setIsOpen(!isOpen)}
            title="ファイルツリー"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="flex shrink-0 flex-col border-l border-border">
        <div className="flex h-10 items-center justify-center px-2">
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setIsOpen(true)}
            title="ファイルツリーを開く"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative flex shrink-0 flex-col border-l border-border')} style={{ width }}>
      {/* ドラッグハンドル */}
      <div
        className="absolute inset-y-0 left-0 w-1 cursor-col-resize hover:bg-border active:bg-primary/30"
        onMouseDown={handleDragStart}
        title="ドラッグして幅を変更"
      />

      {/* ヘッダー */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <span className="flex-1 text-xs font-medium text-foreground">Files</span>
        <button
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground',
            showHidden && 'text-foreground',
          )}
          onClick={() => setShowHidden((v) => !v)}
          title={showHidden ? '隠しファイルを非表示' : '隠しファイルを表示'}
        >
          {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setIsOpen(false)}
          title="閉じる"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ファイルツリー */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FileTree
          sessionId={activeSessionId}
          showHidden={showHidden}
          selectedFilePath={selectedFilePath}
          onFileSelect={handleFileSelect}
        />
      </div>
    </div>
  );
}
