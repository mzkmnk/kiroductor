// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptQueue } from '../use-prompt-queue';
import type { ImageAttachment } from '../../../shared/ipc';

describe('usePromptQueue', () => {
  let onSend: ReturnType<typeof vi.fn<(text: string, images?: ImageAttachment[]) => void>>;

  beforeEach(() => {
    onSend = vi.fn<(text: string, images?: ImageAttachment[]) => void>();
  });

  describe('非処理中の送信', () => {
    it('onSend を直接呼び、キューに追加しない', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('hello', false);
      });

      expect(onSend).toHaveBeenCalledWith('hello', undefined);
      expect(result.current.queue).toEqual([]);
    });

    it('画像付きで onSend を直接呼ぶ', () => {
      const images: ImageAttachment[] = [{ mimeType: 'image/png', data: 'base64data' }];
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('with image', false, images);
      });

      expect(onSend).toHaveBeenCalledWith('with image', images);
      expect(result.current.queue).toEqual([]);
    });
  });

  describe('処理中の送信（キューイング）', () => {
    it('処理中はキューに追加し onSend を呼ばない', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('queued message', true);
      });

      expect(onSend).not.toHaveBeenCalled();
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.queue[0].text).toBe('queued message');
    });

    it('複数のメッセージをキューに積める（FIFO順）', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('first', true);
        result.current.submitOrEnqueue('second', true);
        result.current.submitOrEnqueue('third', true);
      });

      expect(result.current.queue).toHaveLength(3);
      expect(result.current.queue[0].text).toBe('first');
      expect(result.current.queue[1].text).toBe('second');
      expect(result.current.queue[2].text).toBe('third');
    });

    it('画像付きメッセージもキューに保持される', () => {
      const images: ImageAttachment[] = [{ mimeType: 'image/jpeg', data: 'data' }];
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('with img', true, images);
      });

      expect(result.current.queue[0].images).toEqual(images);
    });
  });

  describe('drainNext（キュー先頭の自動送信）', () => {
    it('キュー先頭を取り出して onSend を呼ぶ', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('auto-send me', true);
      });
      expect(onSend).not.toHaveBeenCalled();

      act(() => {
        result.current.drainNext();
      });

      expect(onSend).toHaveBeenCalledWith('auto-send me', undefined);
      expect(result.current.queue).toEqual([]);
    });

    it('キューが空のときは何もしない', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.drainNext();
      });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('複数回 drainNext で順次送信する', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('first', true);
        result.current.submitOrEnqueue('second', true);
      });

      act(() => {
        result.current.drainNext();
      });
      expect(onSend).toHaveBeenCalledWith('first', undefined);
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.queue[0].text).toBe('second');

      act(() => {
        result.current.drainNext();
      });
      expect(onSend).toHaveBeenCalledWith('second', undefined);
      expect(result.current.queue).toEqual([]);
    });
  });

  describe('clearQueue', () => {
    it('キューを全消去する', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('a', true);
        result.current.submitOrEnqueue('b', true);
      });
      expect(result.current.queue).toHaveLength(2);

      act(() => {
        result.current.clearQueue();
      });
      expect(result.current.queue).toEqual([]);
    });

    it('消去後に drainNext しても送信されない', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('will be cleared', true);
      });

      act(() => {
        result.current.clearQueue();
      });

      act(() => {
        result.current.drainNext();
      });
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('removeFromQueue', () => {
    it('指定した ID のアイテムをキューから削除する', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('keep', true);
        result.current.submitOrEnqueue('remove me', true);
      });

      const idToRemove = result.current.queue[1].id;

      act(() => {
        result.current.removeFromQueue(idToRemove);
      });

      expect(result.current.queue).toHaveLength(1);
      expect(result.current.queue[0].text).toBe('keep');
    });

    it('存在しない ID を指定しても何も起きない', () => {
      const { result } = renderHook(() => usePromptQueue({ onSend }));

      act(() => {
        result.current.submitOrEnqueue('item', true);
      });

      act(() => {
        result.current.removeFromQueue('non-existent-id');
      });

      expect(result.current.queue).toHaveLength(1);
    });
  });
});
