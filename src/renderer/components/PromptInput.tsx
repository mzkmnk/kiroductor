import { useState } from 'react';
import Claude from '@lobehub/icons/es/Claude';
import OpenAI from '@lobehub/icons/es/OpenAI';
import Gemini from '@lobehub/icons/es/Gemini';
import Mistral from '@lobehub/icons/es/Mistral';
import Qwen from '@lobehub/icons/es/Qwen';
import DeepSeek from '@lobehub/icons/es/DeepSeek';
import Minimax from '@lobehub/icons/es/Minimax';
import { ArrowUp, SparklesIcon, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModelInfo } from '@agentclientprotocol/sdk/dist/schema/index';

/**
 * モデル ID に対応するプロバイダーアイコンを表示するコンポーネント。
 *
 * - Claude / Anthropic → Claude アイコン
 * - GPT / OpenAI       → OpenAI アイコン
 * - Gemini / Google    → Gemini アイコン
 * - Mistral            → Mistral アイコン
 * - Qwen               → Qwen アイコン
 * - DeepSeek           → DeepSeek アイコン
 * - MiniMax            → Minimax アイコン
 * - auto / その他      → SparklesIcon
 */
function ProviderIcon({ modelId, size = 14 }: { modelId: string; size?: number }) {
  const id = modelId.toLowerCase();
  if (id.includes('claude') || id.includes('anthropic')) return <Claude size={size} />;
  if (id.includes('gpt') || id.includes('o1') || id.includes('o3') || id.includes('openai'))
    return <OpenAI size={size} />;
  if (id.includes('gemini') || id.includes('google')) return <Gemini size={size} />;
  if (id.includes('mistral')) return <Mistral size={size} />;
  if (id.includes('qwen')) return <Qwen size={size} />;
  if (id.includes('deepseek')) return <DeepSeek size={size} />;
  if (id.includes('minimax')) return <Minimax size={size} />;
  return <SparklesIcon className="shrink-0" style={{ width: size, height: size }} />;
}

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
 * - `disabled` が true のとき入力と送信の両方を無効化する。
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
    <div className="px-4 pb-4">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* テキスト入力エリア */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask to make changes..."
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
        />

        {/* フッターバー: モデル選択 + 送信ボタン */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {availableModels.length > 0 && currentModelId ? (
              <Select
                value={currentModelId}
                onValueChange={(value) => onModelChange?.(value)}
                disabled={isProcessing}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-auto max-w-[200px] gap-1.5 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/50 focus:ring-0 disabled:opacity-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId}>
                      <div className="flex items-center gap-1.5">
                        <ProviderIcon modelId={model.modelId} />
                        <span className="text-xs">{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground/60">
                <SparklesIcon className="size-3.5" />
                <span>Agent</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isProcessing ? (
              <Button
                onClick={onCancel}
                size="icon"
                className="size-8 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={disabled || !text.trim()}
                size="icon"
                className="size-8 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-30"
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { PromptInput };
