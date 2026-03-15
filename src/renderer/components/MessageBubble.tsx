import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AgentMessage, UserMessage } from '../../main/repositories/message.repository';

/**
 * MessageBubble コンポーネントの props。
 */
interface MessageBubbleProps {
  /** 表示するメッセージ（ユーザーまたはエージェント）。 */
  message: UserMessage | AgentMessage;
}

/**
 * 一件分のメッセージをバブル形式で表示するコンポーネント。
 *
 * - ユーザー発言: 右寄せ、`bg-primary/20 border-primary/30`
 * - エージェント返答: 左寄せ、`bg-card border-border`
 * - エージェントのストリーミング中はカーソル（`▌`）を末尾に表示する。
 * - メッセージ本文は Markdown としてレンダリングされる。
 */
function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isStreaming = !isUser && (message as AgentMessage).status === 'streaming';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl border px-4 py-2 text-sm break-words ${
          isUser
            ? 'bg-primary/20 border-primary/30 text-foreground'
            : 'bg-card border-border text-foreground'
        }`}
      >
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
        {isStreaming && <span aria-hidden="true">▌</span>}
      </div>
    </div>
  );
}

export { MessageBubble };
