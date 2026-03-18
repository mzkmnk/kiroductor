import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createHighlighter } from 'shiki';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';

import type { AgentMessage, UserMessage } from '../../main/features/session/message.repository';

/**
 * アプリ全体で共有する Shiki ハイライター。
 *
 * モジュールロード時に一度だけ初期化し、以降は Promise を使い回す。
 */
const highlighterPromise = createHighlighter({
  themes: ['github-light', 'tokyo-night'],
  langs: [
    'typescript',
    'javascript',
    'tsx',
    'jsx',
    'python',
    'bash',
    'sh',
    'json',
    'yaml',
    'css',
    'html',
    'markdown',
    'rust',
    'go',
    'sql',
  ],
});

/** ハイライター初期化後にキャッシュする rehype プラグイン配列。 */
type RehypePlugins = NonNullable<Parameters<typeof ReactMarkdown>[0]['rehypePlugins']>;
let cachedRehypePlugins: RehypePlugins | null = null;

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
 * - ストリーミング完了後はメッセージ本文を Markdown + シンタックスハイライト付きでレンダリングする。
 */
function MessageBubble({ message, animSplit = 0 }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isStreaming = !isUser && (message as AgentMessage).status === 'streaming';

  const [rehypePlugins, setRehypePlugins] = useState<RehypePlugins>(cachedRehypePlugins ?? []);

  useEffect(() => {
    // キャッシュ済みの場合は初期 state で反映済みのため更新不要
    if (cachedRehypePlugins) return;
    highlighterPromise.then((h) => {
      cachedRehypePlugins = [
        [
          rehypeShikiFromHighlighter,
          h,
          { themes: { light: 'github-light', dark: 'tokyo-night' }, defaultColor: false },
        ],
      ];
      setRehypePlugins(cachedRehypePlugins);
    });
  }, []);

  const alreadyShown = message.text.slice(0, animSplit);
  const newChunk = message.text.slice(animSplit);

  if (isUser) {
    const userMsg = message as UserMessage;
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground break-words">
          {userMsg.attachments && userMsg.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {userMsg.attachments.map((att, i) => (
                <img
                  key={i}
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt="Attached image"
                  className="size-10 rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          )}
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
              {message.text}
            </ReactMarkdown>
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
            {message.text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export { MessageBubble };
