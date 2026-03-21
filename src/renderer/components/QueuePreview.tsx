import { X } from 'lucide-react';
import { Button } from './ui/button';
import type { QueuedPrompt } from '../hooks/use-prompt-queue';

/**
 * QueuePreview コンポーネントの props。
 */
interface QueuePreviewProps {
  /** キューに積まれたプロンプト一覧。 */
  queue: QueuedPrompt[];
  /** 個別のキューアイテムを削除するコールバック。 */
  onRemove: (id: string) => void;
}

/**
 * キューに積まれたプロンプトをプレビュー表示するコンポーネント。
 *
 * 各アイテムには削除ボタンが付き、送信前にキューの内容を確認・削除できる。
 */
function QueuePreview({ queue, onRemove }: QueuePreviewProps) {
  if (queue.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="mb-1 text-xs font-medium text-muted-foreground">送信待ちキュー</div>
        <div className="flex flex-col gap-1">
          {queue.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-md bg-background/60 px-2 py-1.5 text-sm"
            >
              <span className="shrink-0 text-xs text-muted-foreground/60 tabular-nums">
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              {item.images && item.images.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  📎{item.images.length}
                </span>
              )}
              <Button
                onClick={() => onRemove(item.id)}
                size="icon"
                variant="ghost"
                className="size-5 shrink-0 rounded text-muted-foreground hover:text-foreground"
                aria-label={`Remove queued message ${index + 1}`}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { QueuePreview };
