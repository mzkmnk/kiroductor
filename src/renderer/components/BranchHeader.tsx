import { ArrowLeft, GitBranchIcon, GitCompareArrows } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

/**
 * BranchHeader コンポーネントの props。
 */
interface BranchHeaderProps {
  /** 現在の作業ブランチ名。 */
  currentBranch?: string;
  /** ベースブランチ名。 */
  sourceBranch?: string;
  /** diff ボタンクリック時のコールバック。 */
  onDiffClick?: () => void;
  /** 差分が存在するかどうか。false の場合ボタンを無効化する。 */
  hasDiffChanges?: boolean;
}

/**
 * セッション共通のブランチ情報ヘッダー。
 *
 * ブランチ名と diff ボタンを表示する。タブの切り替えに依存せず常時表示される。
 */
function BranchHeader({
  currentBranch,
  sourceBranch,
  onDiffClick,
  hasDiffChanges = false,
}: BranchHeaderProps) {
  if (currentBranch && sourceBranch) {
    return (
      <div className="flex h-8 shrink-0 items-center gap-2 border-b px-6 text-xs text-muted-foreground [-webkit-app-region:drag]">
        <GitBranchIcon className="h-3.5 w-3.5" />
        <span>{sourceBranch}</span>
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{currentBranch}</span>
        {onDiffClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto [-webkit-app-region:no-drag]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onDiffClick}
                    disabled={!hasDiffChanges}
                    aria-label="Show diff"
                  >
                    <GitCompareArrows className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasDiffChanges && <TooltipContent>No changes</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return <div className="h-8 shrink-0 [-webkit-app-region:drag]" />;
}

export { BranchHeader };
