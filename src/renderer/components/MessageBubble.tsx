import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AgentMessage, UserMessage } from '../../main/repositories/message.repository';

/**
 * MessageBubble コンポーネントの props。
 */
interface MessageBubbleProps {
  /** 表示するメッセージ（ユーザーまたはエージェント）。 */
  message: UserMessage | AgentMessage;
  /**
   * ストリーミング中にアニメーションを開始するテキストのオフセット（文字数）。
   *
   * 0 〜 このオフセットまでは既出テキスト（アニメーションなし）、
   * それ以降が新規チャンク（フェードインアニメーション対象）。
   * ストリーミング中のみ有効。
   */
  animSplit?: number;
}

/**
 * 一件分のメッセージをバブル形式で表示するコンポーネント。
 *
 * - ユーザー発言: 右寄せ、`bg-primary/20 border-primary/30`
 * - エージェント返答: 左寄せ、`bg-card border-border`
 * - エージェントのストリーミング中は新しいチャンクをフェードインで滑らかに表示する。
 * - ストリーミング完了後はメッセージ本文を Markdown としてレンダリングする。
 */
function MessageBubble({ message, animSplit = 0 }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isStreaming = !isUser && (message as AgentMessage).status === 'streaming';

  const alreadyShown = message.text.slice(0, animSplit);
  const newChunk = message.text.slice(animSplit);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl border px-4 py-2 text-sm break-words ${
          isUser
            ? 'bg-primary/20 border-primary/30 text-foreground'
            : 'bg-card border-border text-foreground'
        }`}
      >
        {isStreaming ? (
          // ストリーミング中: plain text + チャンク単位フェードイン
          // 部分的な Markdown をパースすると崩れるため完了後に切り替える
          <div className="whitespace-pre-wrap">
            {alreadyShown}
            {newChunk && <span className="animate-stream-fade-in">{newChunk}</span>}
          </div>
        ) : (
          // ストリーミング完了後: Markdown レンダリング
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export { MessageBubble };
