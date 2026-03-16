import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
 * エージェントが実行中のツール操作をインラインで表示するコンポーネント。
 *
 * - ツール名をコンパクトに表示する
 * - クリックで入力パラメータと実行結果を展開できる
 */
function ToolCallCard({ message }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
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
