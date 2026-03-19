import { useState, useRef } from 'react';
import { cn } from '../lib/utils';
import Claude from '@lobehub/icons/es/Claude';
import OpenAI from '@lobehub/icons/es/OpenAI';
import Gemini from '@lobehub/icons/es/Gemini';
import Mistral from '@lobehub/icons/es/Mistral';
import Qwen from '@lobehub/icons/es/Qwen';
import DeepSeek from '@lobehub/icons/es/DeepSeek';
import Minimax from '@lobehub/icons/es/Minimax';
import { ArrowUp, Paperclip, SparklesIcon, Square, X } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ModelInfo, SessionMode } from '@agentclientprotocol/sdk/dist/schema/index';
import type { ImageAttachment } from '../../shared/ipc';

/** 許可する MIME タイプ一覧。 */
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** 添付可能なファイルサイズ上限（10MB）。 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Base64 変換済みの添付画像。 */
interface ImagePreview {
  /** 一意識別子（UI のキーに使用） */
  id: string;
  /** MIME タイプ */
  mimeType: string;
  /** Base64 エンコード済みデータ */
  data: string;
  /** プレビュー表示用の Data URL */
  previewUrl: string;
  /** 元ファイル名 */
  name: string;
}

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
  /** ユーザーがテキスト（および添付画像）を送信したときに呼ばれるコールバック。 */
  onSubmit: (text: string, images?: ImageAttachment[]) => void;
  /** ユーザーがキャンセルを要求したときに呼ばれるコールバック。 */
  onCancel?: () => void;
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
}

/**
 * ファイルを Base64 エンコードして {@link ImagePreview} を返す。
 *
 * @param file - 変換するファイル
 * @returns Base64 エンコード済みの画像プレビュー
 */
function readFileAsBase64(file: File): Promise<ImagePreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // "data:image/png;base64,..." から Base64 部分を抽出
      const base64 = dataUrl.split(',')[1];
      resolve({
        id: crypto.randomUUID(),
        mimeType: file.type,
        data: base64,
        previewUrl: dataUrl,
        name: file.name,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * ユーザーがテキストを入力して送信するフォーム。
 *
 * - Enter キーで送信、Shift+Enter で改行する。
 * - `disabled` が true のとき入力と送信の両方を無効化する。
 * - 画像ファイルを添付してプロンプトと一緒に送信できる。
 */
function PromptInput({
  disabled = false,
  isProcessing = false,
  onSubmit,
  onCancel,
  currentModelId,
  availableModels = [],
  onModelChange,
  currentModeId,
  availableModes = [],
  onModeChange,
}: PromptInputProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    const attachments = images.map((img) => ({ mimeType: img.mimeType, data: img.data }));
    onSubmit(trimmed || '', attachments);
    setText('');
    setImages([]);
    setImageError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  /** ファイル選択ダイアログを開く。 */
  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  /** 選択されたファイルをバリデーション → Base64 変換する。 */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageError(null);
    const newImages: ImagePreview[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setImageError(`Unsupported file type: ${file.type || file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setImageError(`File too large (max 10MB): ${file.name}`);
        continue;
      }
      try {
        const preview = await readFileAsBase64(file);
        newImages.push(preview);
      } catch {
        setImageError(`Failed to read file: ${file.name}`);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    // input をリセットして同じファイルを再選択可能にする
    e.target.value = '';
  }

  /** 添付画像を削除する。 */
  function handleRemoveImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  const hasContent = text.trim().length > 0 || images.length > 0;

  return (
    <div className="px-4 pb-4">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* 画像プレビューエリア */}
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {images.map((img) => (
              <div key={img.id} className="group relative shrink-0">
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  className="size-16 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${img.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* エラーメッセージ */}
        {imageError && <div className="px-4 pt-2 text-xs text-destructive">{imageError}</div>}

        {/* テキスト入力エリア */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask to make changes..."
          className={cn(
            'w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm',
            'placeholder:text-muted-foreground/60 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'field-sizing-content min-h-[80px]',
            'transition-[max-height] duration-150 ease-out',
            isFocused ? 'max-h-[140px] overflow-y-auto' : 'max-h-[80px] overflow-hidden',
          )}
        />

        {/* 隠しファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* フッターバー: モデル選択 + 添付 + 送信ボタン */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {availableModes.length > 0 && currentModeId && (
              <Select
                value={currentModeId}
                onValueChange={(value) => onModeChange?.(value)}
                disabled={isProcessing}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-auto max-w-[160px] gap-1.5 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/50 focus:ring-0 disabled:opacity-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      <span className="text-xs">{mode.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            {/* 画像添付ボタン */}
            {!isProcessing && (
              <Button
                onClick={handleAttachClick}
                disabled={disabled}
                size="icon"
                variant="ghost"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Attach image"
              >
                <Paperclip className="size-4" />
              </Button>
            )}

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
                disabled={disabled || !hasContent}
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
