# Phase 6D: マルチセッション UI

サイドバーによるセッション管理 UI を実装し、複数セッションの並列操作を可能にする。

## 関連ドキュメント

- Stitch プロンプト: [stitch-prompt.md](../stitch-prompt.md)
- 前フェーズ: [Phase 6C — マルチセッション Repository/Service](./phase6c.md)
- 次フェーズ: [Phase 7 — ポリッシュ](./phase7.md)

## デザイン方針

- shadcn/ui の `Sidebar` コンポーネントを使用する
- 既存のダークテーマ（zinc-950 ベース）を踏襲
- レスポンシブ: サイドバーは折りたたみ可能
- Stitch でデザインしたモックアップをベースに実装する

## レイアウト変更 — App.tsx の2カラム化

- [ ] `App.tsx` を Sidebar + Main の2カラムレイアウトに変更する
  - shadcn/ui の `SidebarProvider` + `Sidebar` + `SidebarInset` を使用
  - **AC**: 左にサイドバー（280px）、右にメインチャットエリアが表示される
  - **AC**: サイドバーの開閉状態が保持される

## SessionSidebar — セッション管理サイドバー

- [ ] shadcn/ui の `Sidebar` 関連コンポーネントを追加する（`pnpm dlx shadcn@latest add sidebar`）
- [ ] `SessionSidebar` コンポーネントを作成する
  - ヘッダー: アプリ名 "Kiroductor" + "New Session" ボタン
  - セッションリスト: `SidebarMenu` + `SidebarMenuItem` で構成
  - フッター: 設定アイコンボタン

### セッションリストアイテム

- [ ] 各セッションの表示内容:
  - セッションタイトル（kiro-cli から取得、または "New Session"）
  - リポジトリ名（muted テキスト）
  - 相対タイムスタンプ（"2m ago" など）
  - ステータスドット（green: active, blue: idle, gray: disconnected）
  - **AC**: アクティブセッションがハイライト表示される（bg-sidebar-accent + 左ボーダー）
  - **AC**: セッションをクリックするとアクティブセッションが切り替わる

### New Session ボタン

- [ ] クリックで新規セッションダイアログを表示する
  - リポジトリ選択（クローン済みリポジトリのドロップダウン）
  - 新規クローン用の URL 入力フィールド
  - "Start Session" ボタン
  - **AC**: リポジトリを選択して "Start Session" をクリックすると、worktree が作成され、新しいセッションが開始される

## ChatView の完成（Phase 6 の残タスクを統合）

- [ ] `MessageBubble` と `ToolCallCard` を縦に並べるリストレイアウトを Tailwind で実装する
- [ ] 新しいメッセージが届いたら自動で最下部へスクロールする処理を実装する
- [ ] セッション切り替え時にメッセージリストを再取得する
  - **AC**: `onSessionSwitched` イベントで `session:messages` を呼び直す

## SessionBar（Phase 6 の残タスクを統合 + マルチセッション対応）

- [ ] shadcn/ui の `Badge` を追加して接続状態を表示する
- [ ] アクティブセッションのタイトルとリポジトリパスを表示する
- [ ] エージェント停止ボタンを実装する（lucide-react `Square` アイコン）

## useSession フックの改修（Phase 6 の残タスクを統合 + マルチセッション対応）

- [ ] `useReducer` + Context で以下を管理する:
  - `sessions: SessionInfo[]` — 全セッション一覧
  - `activeSessionId: string | null` — アクティブセッション ID
  - `messages: Message[]` — アクティブセッションのメッセージ
  - `status` / `connectionStatus`
- [ ] `switchSession(sessionId)` — セッション切り替え
- [ ] `createSession(repoId)` — 新規セッション作成
- [ ] `loadSession(sessionId)` — 既存セッション復元
- [ ] `sendPrompt(text)` — プロンプト送信
- [ ] `cancelPrompt()` — キャンセル
- [ ] IPC イベント購読とクリーンアップ

## セッション復元中の UI

- [ ] `load()` 中にチャットエリアにローディング表示する
  - "Restoring session..." のメッセージとスピナー
  - **AC**: 復元中は PromptInput が disabled になる
  - **AC**: 復元完了後に過去のメッセージが表示される

## 空状態の UI

- [ ] セッションが存在しない場合のウェルカム表示
  - "Create a new session to start coding with AI" のメッセージ
  - "New Session" ボタン
  - **AC**: 最初のセッション作成後にチャット画面に遷移する

## セッション削除

- [ ] サイドバーのセッションに削除ボタン（またはコンテキストメニュー）を追加する
  - **AC**: 削除をクリックすると `sessions.json` からセッションが削除される
  - **AC**: 削除されたセッションがサイドバーから消える
  - **AC**: アクティブセッションを削除した場合、別のセッションに切り替わる（なければ空状態）
- [ ] Worktree のクリーンアップ
  - セッション削除時に対応する worktree を `git worktree remove` で削除する
  - **AC**: セッション削除後、対応する worktree ディレクトリが存在しないこと
