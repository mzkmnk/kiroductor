# Phase 3: ACP メソッド（agent→client）+ テスト

kiro-cli エージェントから Electron アプリ（クライアント）へ送られてくるリクエストを処理するメソッドを実装する。
各メソッドは ACP プロトコルで定義されたインターフェースを実装する。

## 関連ドキュメント

- [ACP プロトコル仕様](../research/acp-protocol.md) — メソッド名・型・シーケンスの詳細
- [ACP 動作確認結果](../research/acp-verification.md) — kiro-cli v1.27.2 との実接続で確認した注意点
- [実装計画](../design/implementation-plan.md) — アーキテクチャ全体の設計判断
- 前フェーズ: [Phase 2 — Repository 層](./phase2.md)
- 次フェーズ: [Phase 4 — Service 層](./phase4.md)

## readTextFile — エージェントが指定したファイルを読み込んで返す

- [ ] リクエスト・レスポンスの型（`ReadTextFileRequest` / `ReadTextFileResponse`）を定義する
  - 型は `@agentclientprotocol/sdk` から `import type` する（独自定義は不要）
- [ ] `ReadTextFileMethod` クラスを作成し、ファイルシステム（`fs`）を依存注入で受け取るようにする
- [ ] 指定されたパスのファイルを UTF-8 で読み込む処理を実装する
- [ ] 読み込んだ内容を `{ content }` の形で返すよう実装する
- [ ] テスト: 存在するファイルを指定すると内容が返ること
  - **AC**: `readFile` モックが指定パス・`"utf-8"` で呼ばれ、`{ content: "file content" }` が返る
- [ ] テスト: 存在しないファイルを指定するとエラーが投げられること
  - **AC**: `readFile` モックが `ENOENT` エラーを返すと、同じエラーが `throw` される
- [ ] 備考: `params.limit`（最大行数）/ `params.line`（開始行）は MVP では無視する（[`implementation-plan.md`](../design/implementation-plan.md) 参照、将来対応は [Phase 8](./phase8.md)）
  - 動作確認で kiro-cli が `limit: 3` を送信することを確認済み。MVP では全文返却で問題ない

## writeTextFile — エージェントが指定した内容をファイルへ書き込む

- [ ] リクエスト・レスポンスの型（`WriteTextFileRequest` / `WriteTextFileResponse`）を定義する
  - 型は `@agentclientprotocol/sdk` から `import type` する（独自定義は不要）
- [ ] `WriteTextFileMethod` クラスを作成し、ファイルシステム（`fs`）を依存注入で受け取るようにする
- [ ] 指定されたパスへ内容を UTF-8 で書き込む処理を実装する
- [ ] 書き込み成功時に空オブジェクト `{}` を返すよう実装する
- [ ] テスト: ファイルが正しく書き込まれること
  - **AC**: `writeFile` モックが `(path, content, "utf-8")` で呼ばれ、`{}` が返る
- [ ] テスト: 書き込みに失敗した場合エラーが投げられること
  - **AC**: `writeFile` モックがエラーを返すと、同じエラーが `throw` される

## requestPermission — エージェントが操作の許可を求めてきたときに応答する

- [ ] リクエスト・レスポンスの型（`RequestPermissionRequest` / `RequestPermissionResponse`）を定義する
  - 型は `@agentclientprotocol/sdk` から `import type` する（独自定義は不要）
- [ ] `RequestPermissionMethod` クラスを作成し、通知サービスを依存注入で受け取るようにする
- [ ] MVP として最初の選択肢を自動承認する処理を実装する（`optionId` を返す）
  - `params.options[0].optionId` を `outcome.optionId` として返す
  - `outcome.outcome` は `"selected"` 固定
- [ ] 承認内容をレンダラー（画面）へ通知する処理を実装する
- [ ] テスト: 最初のオプション ID が返されること
  - **AC**: `options[0].optionId` が `outcome.optionId` に入り、`outcome.outcome === "selected"` で返る
- [ ] テスト: レンダラーへの通知が実行されること
  - **AC**: `notificationService.sendToRenderer` が呼ばれる

## sessionUpdate — エージェントの進捗や発言をリアルタイムで画面に反映する

> **実装前提**: Phase 2 の `updateToolCall` 拡張（`name` / `input` 対応）が完了していること。

- [ ] `SessionUpdateMethod` クラスを作成し、メッセージ Repository と通知サービスを依存注入で受け取るようにする

- [ ] `agent_message_chunk` イベント: エージェント返答のテキストを追記し、画面へ通知する処理を実装する
  - **背景**: kiro-cli は `ContentChunk.messageId` を送信しない（[ACP 動作確認結果](../research/acp-verification.md) 参照）。ターン開始時に Phase 4 の `PromptService` が `addAgentMessage(uuid)` を呼ぶので、ここでは repo 内の最新 `status: 'streaming'` のエージェントメッセージを探して使う
  - **AC**: `content.type === 'text'` のとき、`status: 'streaming'` の最新エージェントメッセージに `appendAgentChunk` が呼ばれる
  - **AC**: `notificationService.sendToRenderer` が呼ばれる
  - **AC**: streaming 中のエージェントメッセージが存在しない場合、`randomUUID()` で `addAgentMessage` を呼んでから `appendAgentChunk` する（フォールバック）

- [ ] `tool_call` イベント: ツール呼び出しの開始を記録し、画面へ通知する処理を実装する
  - **背景**: kiro-cli は同一 `toolCallId` に対して `tool_call` を複数回送信する。1 回目は `status: "in_progress"` で rawInput なし、2 回目以降で rawInput と title が確定する（[ACP 動作確認結果](../research/acp-verification.md) 参照）
  - **背景**: `ToolCall` に `name` フィールドは存在しない。`title` を `name` として使う
  - **背景**: SDK の `ToolCallStatus` は `MessageRepository` の `status` と異なる（マッピング必要）
    - `"pending"` / `"in_progress"` → `'running'`、`"completed"` → `'completed'`、`"failed"` → `'error'`
  - **AC**: 同じ `toolCallId` のメッセージが repo に存在しない場合、`addToolCall(toolCallId, title, rawInput)` が呼ばれる
  - **AC**: 同じ `toolCallId` のメッセージが repo に既に存在する場合、`updateToolCall(toolCallId, { name: title, input: rawInput })` が呼ばれる（重複追加しない）
  - **AC**: `notificationService.sendToRenderer` が呼ばれる

- [ ] `tool_call_update` イベント: ツール呼び出しの結果を更新し、画面へ通知する処理を実装する
  - **AC**: `updateToolCall(toolCallId, { status: mappedStatus, result: JSON.stringify(rawOutput) })` が呼ばれる
  - **AC**: `rawOutput` が `undefined` の場合、`result` は更新しない
  - **AC**: `notificationService.sendToRenderer` が呼ばれる

- [ ] 上記以外のイベント: 画面へ転送するだけのフォールスルー処理を実装する
  - **AC**: `tool_call` / `tool_call_update` / `agent_message_chunk` 以外のイベントでは `notificationService.sendToRenderer` のみ呼ばれ、repo への操作は行われない

## client-handler — 上記メソッドをひとつのクラスにまとめてルーティングする

- [ ] `KiroductorClientHandler implements Client` のクラスを作成する
- [ ] 各メソッドインスタンスをコンストラクタで受け取るよう実装する
- [ ] 受け取ったリクエストを対応するメソッドへ委譲するだけの実装をする
- [ ] `extNotification` を実装し、`_kiro.dev/` 拡張通知を無視する
  - **背景**: kiro-cli は `_kiro.dev/mcp/server_initialized`、`_kiro.dev/commands/available`、`_kiro.dev/metadata` 等を notification として送信する。未実装だと SDK が `-32601 Method not found` をログ出力し続ける（[ACP 動作確認結果](../research/acp-verification.md) 参照）
  - **AC**: `extNotification` が呼ばれてもエラーを投げない（何もしない）
