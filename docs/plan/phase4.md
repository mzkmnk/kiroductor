# Phase 4: Service 層 + テスト

kiro-cli プロセスの起動・セッション管理・プロンプト送信といったビジネスロジックを実装する。

## notificationService — メインプロセスからレンダラー（画面）へ通知を送る

- [ ] `BrowserWindow.webContents.send()` をラップして `sendToRenderer(channel, data)` を実装する
- [ ] ウィンドウが存在しない・破棄済みの場合は何もしない（エラーを出さない）処理を追加する

## acpConnectionService — kiro-cli プロセスを起動・終了する

- [ ] `start()`: `kiro-cli acp` コマンドを子プロセスとして起動する処理を実装する
- [ ] `start()`: 起動した子プロセスから ACP 接続オブジェクト（`ClientSideConnection`）を生成する
- [ ] `start()`: ACP 接続の初期化（`initialize()`）を行い、Repository に保存する
- [ ] `stop()`: 子プロセスを終了させ、Repository の状態をクリアする
- [ ] プロセスが予期せず終了した場合（`exit` / `error` イベント）のエラーハンドリングを実装する
- [ ] テスト: spawn のモックを使い、start / stop の動作を確認する

## sessionService — エージェントとの会話セッションを管理する

- [ ] `create(cwd)`: 指定した作業ディレクトリで新しいセッションを開始する処理を実装する
  - ACP 接続の `newSession()` を呼び、返却された `sessionId` を Repository に保存する
  - メッセージ履歴をリセットする
- [ ] `cancel()`: 実行中のセッションをキャンセルする処理を実装する
  - ACP 接続の `cancel()` を呼ぶ
- [ ] テスト: セッション作成時に Repository が更新されメッセージがリセットされること
- [ ] テスト: キャンセル時に ACP の cancel が呼ばれること

## promptService — ユーザーの入力をエージェントへ送り、返答を受け取る

- [ ] `send(text)`: ユーザーメッセージを Repository に追加する
- [ ] `send(text)`: エージェント返答用の空メッセージを Repository に追加する（ストリーミング受け口）
- [ ] `send(text)`: ACP 接続の `prompt()` を呼んでエージェントへテキストを送信する
- [ ] `send(text)`: 返答が完了したらエージェントメッセージを確定状態にする
- [ ] `send(text)`: 完了理由（`stopReason`）を返す
- [ ] テスト: メッセージが正しい順番で Repository に追加されること
- [ ] テスト: ACP の prompt が呼ばれ、完了後にメッセージが確定されること
