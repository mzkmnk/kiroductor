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
        colorClass: 'text-blue-400',
        label: 'Pending',
      };
    case 'in_progress':
      return {
        icon: Loader2,
        colorClass: 'text-blue-400',
        label: 'Running',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        colorClass: 'text-emerald-400',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: AlertCircle,
        colorClass: 'text-red-400',
        label: 'Failed',
      };
  }
}

/**
 * エージェントが実行中のツール操作を表示するカード。
 *
 * - ツール名とステータスアイコンをヘッダーに表示する
 * - 折りたたみ可能な本文にツールの入力パラメータと実行結果を表示する
 * - ステータスに応じて色が変わる（blue: pending/in_progress、emerald: completed、red: failed）
 */
function ToolCallCard({ message }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { icon: StatusIcon, colorClass, label } = getStatusStyle(message.status);
  const isSpinning = message.status === 'in_progress';

  return (
    <div className="flex justify-start">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full max-w-[75%]">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent">
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
          <StatusIcon
            className={`h-4 w-4 shrink-0 ${colorClass} ${isSpinning ? 'animate-spin' : ''}`}
            aria-label={label}
          />
          <span className="truncate font-medium">{message.name}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1 rounded-2xl border border-border bg-card px-4 py-3 text-xs">
          {message.input !== undefined && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">Input</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-foreground">
                {typeof message.input === 'string'
                  ? message.input
                  : JSON.stringify(message.input, null, 2)}
              </pre>
            </div>
          )}
          {message.result !== undefined && (
            <div className={message.input !== undefined ? 'mt-3' : ''}>
              <div className="mb-1 font-medium text-muted-foreground">Output</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-foreground">
                {message.result}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export { ToolCallCard };
