import { useState } from 'react';
import { ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { ToolCallMessage } from '../../main/repositories/message.repository';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

/**
 * ToolCallCard コンポーネントの props。
 */
interface ToolCallCardProps {
  /** 表示するツール呼び出しメッセージ。 */
  message: ToolCallMessage;
}

/**
 * ステータスに対応するアイコンと色クラスを返す。
 *
 * @param status - ツール呼び出しの実行状態
 * @returns アイコンコンポーネントと Tailwind の色クラス
 */
function getStatusStyle(status: ToolCallMessage['status']) {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        colorClass: 'text-muted-foreground',
        label: 'Pending',
      };
    case 'in_progress':
      return {
        icon: Loader2,
        colorClass: 'text-muted-foreground',
        label: 'Running',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        colorClass: 'text-emerald-500',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: AlertCircle,
        colorClass: 'text-red-500',
        label: 'Failed',
      };
  }
}

/**
 * エージェントが実行中のツール操作をインラインで表示するコンポーネント。
 *
 * - ツール名とステータスアイコンをコンパクトに表示する
 * - クリックで入力パラメータと実行結果を展開できる
 * - ステータスに応じてアイコンの色が変わる
 */
function ToolCallCard({ message }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { icon: StatusIcon, colorClass, label } = getStatusStyle(message.status);
  const isSpinning = message.status === 'in_progress';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <StatusIcon
          className={`size-3.5 shrink-0 ${colorClass} ${isSpinning ? 'animate-spin' : ''}`}
          aria-label={label}
        />
        <span className="font-medium">{message.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 ml-5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
        {message.input !== undefined && (
          <div>
            <div className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Input
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-foreground/80">
              {typeof message.input === 'string'
                ? message.input
                : JSON.stringify(message.input, null, 2)}
            </pre>
          </div>
        )}
        {message.result !== undefined && (
          <div className={message.input !== undefined ? 'mt-2.5' : ''}>
            <div className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Output
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-foreground/80">
              {message.result}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export { ToolCallCard };
