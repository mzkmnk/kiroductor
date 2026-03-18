import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ArrowLeft, GitBranchIcon, GitCompareArrows, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import type {
  AgentMessage,
  Message,
  ToolCallMessage,
  UserMessage,
} from '../../main/features/session/message.repository';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';

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
  /** 現在の作業ブランチ名。 */
  currentBranch?: string;
  /** ベースブランチ名。 */
  sourceBranch?: string;
  /** diff ボタンクリック時のコールバック。 */
  onDiffClick?: () => void;
  /** 差分が存在するかどうか。false の場合ボタンを無効化する。 */
  hasDiffChanges?: boolean;
  /** 復元するスクロール位置。undefined の場合は最下部へスクロールする。 */
  restoreScrollTop?: number;
}

/**
 * メッセージ一覧を表示するスクロール可能なコンテナ。
 *
 * - `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを提供する。
 * - ユーザーが最下部付近にいる場合のみ、新しいメッセージで自動スクロールする。
 * - セッション切り替え時はスクロール位置を保存・復元する。
 */
const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(function ChatView(
  {
    sessionId,
    messages,
    animSplits,
    isRestoring = false,
    currentBranch,
    sourceBranch,
    onDiffClick,
    hasDiffChanges = false,
    restoreScrollTop,
  },
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
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Restoring session...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentBranch && sourceBranch ? (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-6 text-sm text-muted-foreground [-webkit-app-region:drag]">
          <GitBranchIcon className="size-4" />
          <span>{sourceBranch}</span>
          <ArrowLeft className="size-4" />
          <span>{currentBranch}</span>
          {onDiffClick && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-auto [-webkit-app-region:no-drag]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDiffClick}
                      disabled={!hasDiffChanges}
                      aria-label="Show diff"
                    >
                      <GitCompareArrows className="size-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasDiffChanges && <TooltipContent>No changes</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ) : (
        <div className="h-10 shrink-0 [-webkit-app-region:drag]" />
      )}
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
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
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
});

export { ChatView };
export type { ChatViewHandle };
