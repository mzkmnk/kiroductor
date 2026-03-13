# Phase 6: チャット UI

エージェントとのチャット画面を React コンポーネントで実装する。
スタイリングは **Tailwind CSS**、UI プリミティブは **shadcn/ui** を使う。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — UI コンポーネント構成の設計
- 前フェーズ: [Phase 5 — Handler 層](./phase5.md)
- 次フェーズ: [Phase 7 — ポリッシュ](./phase7.md)

## PromptInput — ユーザーがテキストを入力して送信するフォーム

- [x] shadcn/ui の `Textarea` と `Button` を追加する（`pnpm dlx shadcn@latest add textarea button`）
- [x] `Textarea` と送信 `Button` を並べたレイアウトを Tailwind で組む
- [x] Enter キーで送信、Shift+Enter で改行する動作を実装する
- [x] エージェントが処理中の間は `Textarea` と `Button` を `disabled` にする

## MessageBubble — 一件分のメッセージを表示するコンポーネント

- [ ] ユーザー発言（右寄せ・青背景）とエージェント返答（左寄せ・グレー背景）を Tailwind のクラスで切り替える
- [ ] ストリーミング受信中にカーソルを表示する処理を実装する

## ToolCallCard — エージェントが実行中のツール操作を表示するカード

- [ ] shadcn/ui の `Collapsible` を追加する（`pnpm dlx shadcn@latest add collapsible`）
- [ ] `Collapsible` でツール名・入力・出力を折りたたみ表示する
- [ ] 実行中（`pending` / `in_progress`）/ 完了（`completed`）/ エラー（`failed`）のステータスを Tailwind の色クラスで表示する

## ChatView — メッセージ一覧を表示するスクロール可能なコンテナ

- [ ] `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを Tailwind で実装する
- [ ] 新しいメッセージが届いたら自動で最下部へスクロールする処理を実装する

## SessionBar — セッションの状態と操作ボタンを表示するヘッダーバー

- [ ] shadcn/ui の `Badge` を追加して接続状態を表示する（`pnpm dlx shadcn@latest add badge`）
- [ ] セッション ID・作業ディレクトリ（cwd）を Tailwind でレイアウトする
- [ ] shadcn/ui の `Button` でエージェント停止ボタンを実装する

## useSession — チャット状態を管理するカスタムフック

- [ ] `useReducer` + Context で `messages` / `status` / `connectionStatus` を管理する
- [ ] `sendPrompt(text)` — プロンプト送信を呼び出せる関数を公開する
- [ ] `cancelPrompt()` — 実行中のプロンプトをキャンセルできる関数を公開する
- [ ] IPC イベントを購読し、コンポーネントアンマウント時にクリーンアップする処理を実装する
