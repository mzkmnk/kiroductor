import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  AgentMessage,
  Message,
  ToolCallMessage,
  UserMessage,
} from '../../main/repositories/message.repository';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';

/**
 * ChatView コンポーネントの props。
 */
interface ChatViewProps {
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
}

/**
 * メッセージ一覧を表示するスクロール可能なコンテナ。
 *
 * - `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを提供する。
 * - 新しいメッセージが届いたら自動で最下部へスクロールする。
 */
function ChatView({ messages, animSplits, isRestoring = false }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="min-h-0 flex-1 overflow-y-auto">
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
  );
}

export { ChatView };
