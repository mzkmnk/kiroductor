import { useState, useEffect, useCallback, useRef } from 'react';
import type { ImageAttachment } from '../../shared/ipc';

/** キューに積まれたプロンプト。 */
export interface QueuedPrompt {
  /** 一意識別子（React の key やキュー操作に使用）。 */
  id: string;
  /** 送信するテキスト。 */
  text: string;
  /** 添付画像（任意）。 */
  images?: ImageAttachment[];
}

/** {@link usePromptQueue} のオプション。 */
interface UsePromptQueueOptions {
  /** 実際にプロンプトを送信する関数。 */
  onSend: (text: string, images?: ImageAttachment[]) => void;
}

/** {@link usePromptQueue} の戻り値。 */
interface UsePromptQueueReturn {
  /** 現在のキュー内容。 */
  queue: QueuedPrompt[];
  /** 処理中ならキューに追加、非処理中なら即送信する。 */
  submitOrEnqueue: (text: string, isProcessing: boolean, images?: ImageAttachment[]) => void;
  /** キューを全消去する。 */
  clearQueue: () => void;
  /** 指定 ID のアイテムをキューから削除する。 */
  removeFromQueue: (id: string) => void;
  /** キュー先頭を取り出して送信する。送信したら `true`、キューが空なら `false` を返す。 */
  drainNext: () => boolean;
}

/**
 * プロンプトキューを管理するカスタムフック。
 *
 * AI 応答中にユーザーが送信したメッセージをキューに積み、
 * 応答完了後に {@link drainNext} を呼ぶことで先頭から順次送信する。
 *
 * @param options - フックのオプション
 * @returns キュー操作用のインターフェース
 */
export function usePromptQueue({ onSend }: UsePromptQueueOptions): UsePromptQueueReturn {
  const [queue, setQueue] = useState<QueuedPrompt[]>([]);
  const queueRef = useRef(queue);
  const onSendRef = useRef(onSend);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const submitOrEnqueue = useCallback(
    (text: string, isProcessing: boolean, images?: ImageAttachment[]) => {
      if (isProcessing) {
        setQueue((prev) => [...prev, { id: crypto.randomUUID(), text, images }]);
      } else {
        onSendRef.current(text, images);
      }
    },
    [],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const drainNext = useCallback((): boolean => {
    const current = queueRef.current;
    if (current.length === 0) return false;
    const [next, ...rest] = current;
    setQueue(rest);
    onSendRef.current(next.text, next.images);
    return true;
  }, []);

  return { queue, submitOrEnqueue, clearQueue, removeFromQueue, drainNext };
}
