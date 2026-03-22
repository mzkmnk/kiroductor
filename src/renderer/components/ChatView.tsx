import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type {
  AgentMessage,
  Message,
  ToolCallMessage,
  UserMessage,
} from '../../shared/message-types';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingIndicator } from './ThinkingIndicator';

/** 最下部とみなす閾値（px）。 */
const NEAR_BOTTOM_THRESHOLD = 50;

/** 親コンポーネントから呼び出せるメソッド。 */
interface ChatViewHandle {
  /** 現在のスクロール位置を返す。 */
  getScrollTop: () => number;
}

/**
 * ChatView コンポーネントの props。
 */
interface ChatViewProps {
  /** アクティブなセッション ID。スクロール位置の復元キーに使用する。 */
  sessionId: string;
  /** 表示するメッセージ一覧。 */
  messages: Message[];
  /**
   * ストリーミング中メッセージのアニメーション開始オフセット（文字数）の辞書。
   *
   * キーはメッセージ ID。{@link MessageBubble} の `animSplit` prop へ渡す。
   */
  animSplits: Record<string, number>;
  /** セッション復元中かどうか。true のときローディング表示になる。 */
  isRestoring?: boolean;
  /** 復元するスクロール位置。undefined の場合は最下部へスクロールする。 */
  restoreScrollTop?: number;
  /** AI が処理中かどうか。true のとき ThinkingIndicator を表示する。 */
  isProcessing?: boolean;
}

/**
 * メッセージ一覧を表示するスクロール可能なコンテナ。
 *
 * - `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを提供する。
 * - ユーザーが最下部付近にいる場合のみ、新しいメッセージで自動スクロールする。
 * - セッション切り替え時はスクロール位置を保存・復元する。
 */
const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(function ChatView(
  { sessionId, messages, animSplits, isRestoring = false, restoreScrollTop, isProcessing = false },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** ユーザーが最下部付近にいるかどうか。 */
  const isNearBottomRef = useRef(true);
  /** 前回のセッション ID。切り替え検知に使用する。 */
  const prevSessionIdRef = useRef<string>(sessionId);
  /** セッション切り替え直後、復元待ちかどうか。 */
  const pendingRestoreRef = useRef(false);

  useImperativeHandle(ref, () => ({
    getScrollTop: () => scrollRef.current?.scrollTop ?? 0,
  }));

  /** isNearBottom を更新する。 */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pendingRestoreRef.current) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // セッション切り替え検知
  useEffect(() => {
    if (prevSessionIdRef.current === sessionId) return;
    prevSessionIdRef.current = sessionId;
    pendingRestoreRef.current = true;
  }, [sessionId]);

  // messages 更新時の処理
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingRestoreRef.current) {
      if (messages.length === 0) return;
      pendingRestoreRef.current = false;

      if (restoreScrollTop !== undefined) {
        el.scrollTop = restoreScrollTop;
        isNearBottomRef.current =
          el.scrollHeight - restoreScrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
      } else {
        el.scrollTop = el.scrollHeight;
        isNearBottomRef.current = true;
      }
      return;
    }

    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages, sessionId, restoreScrollTop]);

  if (isRestoring) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Restoring session...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto">
      <div className="space-y-4 px-6 py-6">
        {messages.map((m) => {
          if (m.type === 'tool_call') {
            return <ToolCallCard key={m.id} message={m as ToolCallMessage} />;
          }
          return (
            <MessageBubble
              key={m.id}
              message={m as UserMessage | AgentMessage}
              animSplit={animSplits[m.id]}
            />
          );
        })}
        <AnimatePresence>{isProcessing && <ThinkingIndicator key="thinking" />}</AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
});

export { ChatView };
export type { ChatViewHandle };
