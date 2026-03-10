# Phase 2: Repository 層 + テスト

アプリが実行中に保持するメモリ上の状態（接続情報・セッション・メッセージ）を管理するクラスを実装する。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — Repository 層の設計
- 前フェーズ: [Phase 1 — スキャフォールド](./phase1.md)
- 次フェーズ: [Phase 3 — ACP メソッド](./phase3.md)

## connectionRepository — kiro-cli プロセスの接続状態を管理する

- [ ] kiro-cli プロセスのオブジェクト（`ChildProcess`）を保持・取得する `getProcess` / `setProcess` を実装する
- [ ] ACP 接続オブジェクトを保持・取得する `getConnection` / `setConnection` を実装する
- [ ] 接続状態（`disconnected` / `connecting` / `connected` / `error`）を保持・取得する `getStatus` / `setStatus` を実装する
- [ ] kiro-cli の標準エラー出力ログを追記・取得する `appendStderr` / `getStderrLogs` を実装する
- [ ] 全状態を初期値に戻す `clear` を実装する
- [ ] 上記すべての動作をテストで確認する

## sessionRepository — 現在のセッション情報を管理する

- [ ] セッション ID を保持・取得する `getSessionId` / `setSessionId` を実装する
- [ ] セッションが有効かどうかを返す `hasActiveSession` を実装する
- [ ] 上記すべての動作をテストで確認する

## messageRepository — チャット上のメッセージ一覧を管理する

- [ ] ユーザーが入力したメッセージを追加する `addUserMessage` を実装する
- [ ] エージェントの返答メッセージを追加する `addAgentMessage` を実装する
- [ ] ストリーミング中にエージェント返答のテキストを逐次追記する `appendAgentChunk` を実装する
- [ ] ストリーミング完了時にエージェント返答を確定状態にする `completeAgentMessage` を実装する
- [ ] エージェントが実行しているツール呼び出しを追加する `addToolCall` を実装する
- [ ] ツール呼び出しの結果・状態を更新する `updateToolCall` を実装する
- [ ] メッセージ一覧を全件取得する `getAll` を実装する
- [ ] メッセージ一覧をリセットする `clear` を実装する
- [ ] 上記すべての動作をテストで確認する
