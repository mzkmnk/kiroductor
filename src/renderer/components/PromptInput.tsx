import { useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModelInfo } from '../../shared/ipc';

/**
 * PromptInput コンポーネントの props。
 */
interface PromptInputProps {
  /** エージェントが処理中かどうか。true のとき Textarea と Button を disabled にする。 */
  disabled?: boolean;
  /** エージェントがプロンプトを処理中かどうか。true のとき停止ボタンを表示する。 */
  isProcessing?: boolean;
  /** ユーザーがテキストを送信したときに呼ばれるコールバック。 */
  onSubmit: (text: string) => void;
  /** ユーザーがキャンセルを要求したときに呼ばれるコールバック。 */
  onCancel?: () => void;
  /** 現在選択中のモデル ID。 */
  currentModelId?: string | null;
  /** 利用可能なモデル一覧。 */
  availableModels?: ModelInfo[];
  /** モデル変更時のコールバック。 */
  onModelChange?: (modelId: string) => void;
}

/**
 * ユーザーがテキストを入力して送信するフォーム。
 *
 * - Enter キーで送信、Shift+Enter で改行する。
 * - `disabled` が true のとき Textarea と Button の両方を無効化する。
 */
function PromptInput({
  disabled = false,
  isProcessing = false,
  onSubmit,
  onCancel,
  currentModelId,
  availableModels = [],
  onModelChange,
}: PromptInputProps) {
  const [text, setText] = useState('');

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          className="min-h-[72px] w-full resize-none rounded-2xl border-border bg-secondary pb-12 shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
          rows={3}
        />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          {availableModels.length > 0 && currentModelId ? (
            <Select
              value={currentModelId}
              onValueChange={(value) => onModelChange?.(value)}
              disabled={isProcessing}
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-auto max-w-[200px] gap-1 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/50 focus:ring-0 disabled:opacity-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.modelId} value={model.modelId}>
                    <span className="text-xs">{model.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div />
          )}
          {isProcessing ? (
            <Button
              onClick={onCancel}
              size="icon"
              className="size-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              aria-label="Stop"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={disabled || !text.trim()}
              size="icon"
              className="size-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { PromptInput };
