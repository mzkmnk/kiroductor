# Phase 4: Service 層 + テスト

kiro-cli プロセスの起動・セッション管理・プロンプト送信といったビジネスロジックを実装する。

## 関連ドキュメント

- [ACP プロトコル仕様](../research/acp-protocol.md) — `ClientSideConnection` の初期化・セッション・プロンプト API の詳細
- [実装計画](../design/implementation-plan.md) — Service 層のアーキテクチャ設計
- 前フェーズ: [Phase 3 — ACP メソッド](./phase3.md)
- 次フェーズ: [Phase 5 — Handler 層](./phase5.md)

## notificationService — メインプロセスからレンダラー（画面）へ通知を送る

- [x] `BrowserWindow.webContents.send()` をラップして `sendToRenderer(channel, data)` を実装する
- [x] ウィンドウが存在しない・破棄済みの場合は何もしない（エラーを出さない）処理を追加する

## acpConnectionService — kiro-cli プロセスを起動・終了する

- [x] `start()`: `kiro-cli acp` コマンドを子プロセスとして起動する処理を実装する
  - **AC**: `start()` を呼ぶと `kiro-cli` が `['acp']` 引数で spawn されること
  - **AC**: spawn 後に Repository の status が `'connecting'` になること
- [x] `start()`: 起動した子プロセスから ACP 接続オブジェクト（`ClientSideConnection`）を生成する
  - **AC**: spawn したプロセスの stdout/stdin から `ClientSideConnection` が生成されること
- [x] `start()`: ACP 接続の初期化（`initialize()`）を行い、Repository に保存する
  - **AC**: `connection.initialize()` が呼ばれること
  - **AC**: initialize 完了後に Repository に connection と process が保存され、status が `'connected'` になること
- [x] `stop()`: 子プロセスを終了させ、Repository の状態をクリアする
  - **AC**: `stop()` を呼ぶと子プロセスの `kill()` が呼ばれること
  - **AC**: `stop()` 後に Repository が clear されること
- [x] プロセスが予期せず終了した場合（`exit` / `error` イベント）のエラーハンドリングを実装する
  - **AC**: プロセスが `exit` イベントを発行したとき、Repository の status が `'error'` になること
  - **AC**: プロセスが `error` イベントを発行したとき、Repository の status が `'error'` になること
- [x] テスト: spawn のモックを使い、start / stop の動作を確認する

## sessionService — エージェントとの会話セッションを管理する

- [x] `create(cwd)`: 指定した作業ディレクトリで新しいセッションを開始する処理を実装する
  - ACP 接続の `newSession()` を呼び、返却された `sessionId` を Repository に保存する
  - メッセージ履歴をリセットする
  - **AC**: `create(cwd)` を呼ぶと `connection.newSession({ cwd, mcpServers: [] })` が呼ばれること
  - **AC**: `newSession()` が返した `sessionId` が `SessionRepository` に保存されること
  - **AC**: `create()` 後に `MessageRepository` がクリアされること
- [x] `cancel()`: 実行中のセッションをキャンセルする処理を実装する
  - ACP 接続の `cancel()` を呼ぶ
  - **AC**: `cancel()` を呼ぶと `connection.cancel({ sessionId })` が呼ばれること
  - **AC**: アクティブなセッションがない場合、`cancel()` は何もしない（エラーを投げない）こと
- [x] テスト: セッション作成時に Repository が更新されメッセージがリセットされること
- [x] テスト: キャンセル時に ACP の cancel が呼ばれること

## promptService — ユーザーの入力をエージェントへ送り、返答を受け取る

- [x] `send(text)`: ユーザーメッセージを Repository に追加する
  - **AC**: `send(text)` を呼ぶと `MessageRepository` にユーザーメッセージが追加されること
- [x] `send(text)`: エージェント返答用の空メッセージを Repository に追加する（ストリーミング受け口）
  - **AC**: ユーザーメッセージの直後に `status: 'streaming'` のエージェントメッセージが追加されること
- [x] `send(text)`: ACP 接続の `prompt()` を呼んでエージェントへテキストを送信する
  - **AC**: `connection.prompt({ sessionId, prompt: [{ type: 'text', text }] })` が呼ばれること
- [x] `send(text)`: 返答が完了したらエージェントメッセージを確定状態にする
  - **AC**: `prompt()` 完了後にエージェントメッセージの `status` が `'completed'` になること
- [x] `send(text)`: 完了理由（`stopReason`）を返す
  - **AC**: `send()` が `prompt()` レスポンスの `stopReason` を返すこと
- [x] テスト: メッセージが正しい順番で Repository に追加されること
- [x] テスト: ACP の prompt が呼ばれ、完了後にメッセージが確定されること
