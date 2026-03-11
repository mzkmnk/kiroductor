# Phase 2: Repository 層 + テスト

アプリが実行中に保持するメモリ上の状態（接続情報・セッション・メッセージ）を管理するクラスを実装する。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — Repository 層の設計
- 前フェーズ: [Phase 1 — スキャフォールド](./phase1.md)
- 次フェーズ: [Phase 3 — ACP メソッド](./phase3.md)

## connectionRepository — kiro-cli プロセスの接続状態を管理する

- [x] kiro-cli プロセスのオブジェクト（`ChildProcess`）を保持・取得する `getProcess` / `setProcess` を実装する
- [x] ACP 接続オブジェクトを保持・取得する `getConnection` / `setConnection` を実装する
- [x] 接続状態（`disconnected` / `connecting` / `connected` / `error`）を保持・取得する `getStatus` / `setStatus` を実装する
- [x] kiro-cli の標準エラー出力ログを追記・取得する `appendStderr` / `getStderrLogs` を実装する
- [x] 全状態を初期値に戻す `clear` を実装する
- [x] 上記すべての動作をテストで確認する

## sessionRepository — 現在のセッション情報を管理する

- [x] セッション ID を保持・取得する `getSessionId` / `setSessionId` を実装する
- [x] セッションが有効かどうかを返す `hasActiveSession` を実装する
- [x] 上記すべての動作をテストで確認する

## messageRepository — チャット上のメッセージ一覧を管理する

- [x] ユーザーが入力したメッセージを追加する `addUserMessage` を実装する
  - **AC**: `addUserMessage('hello')` を呼ぶと `type: 'user'`, `text: 'hello'` のメッセージが `getAll()` で取得できる
  - **AC**: 追加されたメッセージに一意な `id` が付与される
- [x] エージェントの返答メッセージを追加する `addAgentMessage` を実装する
  - **AC**: `addAgentMessage('agent-1')` を呼ぶと `type: 'agent'`, `status: 'streaming'`, `text: ''` のメッセージが追加される
- [x] ストリーミング中にエージェント返答のテキストを逐次追記する `appendAgentChunk` を実装する
  - **AC**: `appendAgentChunk(id, chunk)` を複数回呼ぶとテキストが順番に連結される
  - **AC**: 存在しない `id` に対しては何も起きない
- [x] ストリーミング完了時にエージェント返答を確定状態にする `completeAgentMessage` を実装する
  - **AC**: `completeAgentMessage(id)` を呼ぶと対象メッセージの `status` が `'completed'` になる
  - **AC**: 存在しない `id` に対しては何も起きない
- [x] エージェントが実行しているツール呼び出しを追加する `addToolCall` を実装する
  - **AC**: `addToolCall(id, name, input)` を呼ぶと `type: 'tool_call'`, `status: 'running'` のメッセージが追加される
- [x] ツール呼び出しの結果・状態を更新する `updateToolCall` を実装する
  - **AC**: `updateToolCall(id, { status: 'completed', result: '...' })` でステータスと結果が更新される
  - **AC**: 存在しない `id` に対しては何も起きない
- [x] メッセージ一覧を全件取得する `getAll` を実装する
  - **AC**: 追加順にすべてのメッセージが返される
  - **AC**: 返り値の配列を変更しても内部状態に影響しない
- [x] メッセージ一覧をリセットする `clear` を実装する
  - **AC**: `clear()` 後は `getAll()` が空配列を返す
- [x] 上記すべての動作をテストで確認する
