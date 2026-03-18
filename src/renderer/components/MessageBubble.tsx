import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AgentMessage, UserMessage } from '../../main/features/session/message.repository';

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
 * 一件分のメッセージを表示するコンポーネント。
 *
 * - ユーザー発言: 右寄せ、控えめな背景バブル
 * - エージェント返答: 左寄せ、ボーダーなしのフラットなテキスト表示
 * - エージェントのストリーミング中は新しいチャンクをフェードインで滑らかに表示する。
 * - ストリーミング完了後はメッセージ本文を Markdown としてレンダリングする。
 */
function MessageBubble({ message, animSplit = 0 }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isStreaming = !isUser && (message as AgentMessage).status === 'streaming';

  const alreadyShown = message.text.slice(0, animSplit);
  const newChunk = message.text.slice(animSplit);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground break-words">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-foreground">
      {isStreaming ? (
        <div className="whitespace-pre-wrap">
          {alreadyShown}
          {newChunk && <span className="animate-stream-fade-in">{newChunk}</span>}
        </div>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export { MessageBubble };
