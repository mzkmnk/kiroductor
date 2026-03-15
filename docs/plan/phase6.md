# Phase 6: チャット UI

エージェントとのチャット画面を React コンポーネントで実装する。
スタイリングは **Tailwind CSS**、UI プリミティブは **shadcn/ui** を使う。

## デザイン方針

- **テーマ**: ライトモードのみ（slate ベース、白背景）
- **フォント**: monospace（ui-monospace / JetBrains Mono / Fira Code 系）
- **アクセントカラー**: blue-500 系（`--primary: 217 91% 55%`）
- **カード**: `bg-card` + `border-border` + `rounded-2xl`、半透明・backdrop-blur 効果
- **メッセージバブル**:
  - ユーザー: 右寄せ、`bg-primary/10 border-primary/20`、`rounded-2xl`
  - エージェント: 左寄せ、`bg-secondary border-border`、`rounded-2xl`
- **アイコン**: lucide-react を使用。ボタンはテキストなしのアイコンのみ（`ArrowUp` で送信、`Square` で停止）
- **レイアウト**: SessionBar（上） + ChatView（中、スクロール） + PromptInput（下）

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — UI コンポーネント構成の設計
- 前フェーズ: [Phase 5 — Handler 層](./phase5.md)
- 次フェーズ: [Phase 6A — 設定管理 + Bare Repo](./phase6a.md)

## PromptInput — ユーザーがテキストを入力して送信するフォーム

- [x] shadcn/ui の `Textarea` と `Button` を追加する（`pnpm dlx shadcn@latest add textarea button`）
- [x] `Textarea` と送信アイコンボタン（`ArrowUp`）を並べたレイアウトを Tailwind で組む
- [x] Enter キーで送信、Shift+Enter で改行する動作を実装する
- [x] エージェントが処理中の間は `Textarea` と `Button` を `disabled` にする
- [x] ダークテーマ（zinc-950）と monospace フォントを適用する

## MessageBubble — 一件分のメッセージを表示するコンポーネント

- [x] ユーザー発言（右寄せ・`bg-primary/20 border-primary/30`）とエージェント返答（左寄せ・`bg-card border-border`）を Tailwind のクラスで切り替える
- [x] ストリーミング受信中にカーソル（`▌`）を表示する処理を実装する

## ToolCallCard — エージェントが実行中のツール操作を表示するカード

- [x] shadcn/ui の `Collapsible` を追加する（`pnpm dlx shadcn@latest add collapsible`）
- [x] `Collapsible` でツール名・入力・出力を折りたたみ表示する
- [x] 実行中（`pending` / `in_progress`）/ 完了（`completed`）/ エラー（`failed`）のステータスを Tailwind の色クラスで表示する（例: `text-blue-400` / `text-emerald-400` / `text-red-400`）

## ChatView — メッセージ一覧を表示するスクロール可能なコンテナ

- [x] `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを Tailwind で実装する
- [x] 新しいメッセージが届いたら自動で最下部へスクロールする処理を実装する

## ~~SessionBar~~ — Phase 6D に移動

マルチセッション対応に伴い UI が変わるため、Phase 6D で実装する。

## ~~useSession~~ — Phase 6D に移動

マルチセッション対応に伴い設計が変わるため、Phase 6D で実装する。
