# Phase 6: チャット UI

## タスク

- [ ] `PromptInput` コンポーネント
  - テキストエリア + 送信ボタン
  - エージェント動作中は無効化
  - Enter 送信 / Shift+Enter 改行
- [ ] `MessageBubble` コンポーネント
  - ユーザーメッセージ（右寄せ、青）
  - エージェントメッセージ（左寄せ、グレー）
  - ストリーミング中のカーソル表示
- [ ] `ToolCallCard` コンポーネント
  - 展開可能カード
  - ツール名 / 入力 / 出力表示
  - ステータス表示（running / done / error）
- [ ] `ChatView` コンポーネント
  - スクロール可能コンテナ
  - 新コンテンツで自動スクロール
- [ ] `SessionBar` コンポーネント
  - ステータスドット / セッション ID / cwd 表示
  - 停止ボタン
- [ ] `useSession` フック実装・接続
  - `useReducer` + Context で状態管理
  - `messages` / `status` / `connectionStatus` / `sendPrompt` / `cancelPrompt`
