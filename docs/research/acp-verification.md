# ACP 動作確認結果

kiro-cli v1.27.2 / `@agentclientprotocol/sdk` v0.16.0 で実際に接続・通信を行い確認した結果をまとめる。

確認スクリプト: `scripts/verify-acp.mjs`（基本フロー）、`scripts/verify-acp-detail.mjs`（詳細検査）

## 確認した基本フロー

```
initialize → newSession → prompt → readTextFile（ツール呼び出し） → stopReason: end_turn
```

すべて正常に動作することを確認済み。

## initialize レスポンス

```json
{
  "protocolVersion": 1,
  "agentInfo": {
    "name": "Kiro CLI Agent",
    "title": "Kiro CLI Agent",
    "version": "1.27.2"
  },
  "agentCapabilities": {
    "loadSession": true,
    "promptCapabilities": { "image": true, "audio": false, "embeddedContext": false },
    "mcpCapabilities": { "http": false, "sse": false },
    "sessionCapabilities": {}
  }
}
```

## 実装時の注意点

### 1. `_kiro.dev/` 拡張通知

kiro-cli は ACP 標準外の拡張 Notification を `newSession` 直後から大量に送信する。

| メソッド | タイミング | 内容 |
|---|---|---|
| `_kiro.dev/mcp/server_initialized` | セッション開始時 | MCP サーバー起動通知 |
| `_kiro.dev/commands/available` | セッション開始・プロンプト時 | 利用可能なコマンド・ツール一覧 |
| `_kiro.dev/metadata` | 随時 | `contextUsagePercentage` 等 |

`Client` インターフェースに `extNotification` が未実装の場合、SDK が `-32601 Method not found` をログ出力し続ける。

**対応**: `KiroductorClientHandler` に `extNotification` を実装し、`_kiro.dev/` prefix の通知を無視する。

```typescript
async extNotification(method: string, _params: Record<string, unknown>): Promise<void> {
  // _kiro.dev/ 拡張通知は無視（kiro-cli 固有の通知）
}
```

---

### 2. `ContentChunk.messageId` は kiro-cli から送信されない

`SessionUpdate` の `agent_message_chunk` に含まれる `ContentChunk.messageId` フィールドは UNSTABLE（実験的）であり、kiro-cli v1.27.2 では **`undefined`** で送信される。

確認結果:
- `agent_message_chunk` 受信数: 29 件（1 プロンプトターン）
- `messageId` のユニーク値: `(undefined)` のみ

**対応**: `SessionUpdateMethod` は `messageId` に頼らず、メッセージ Repository 内で `status: 'streaming'` の最新エージェントメッセージを探して `appendAgentChunk` を呼ぶ。なければ `randomUUID()` で新規作成する。

```typescript
// agent_message_chunk 処理の擬似コード
const streaming = this.messageRepo.getAll()
  .filter((m): m is AgentMessage => m.type === 'agent' && m.status === 'streaming')
  .at(-1);
const target = streaming ?? this.messageRepo.addAgentMessage(randomUUID());
if (update.content.type === 'text') {
  this.messageRepo.appendAgentChunk(target.id, update.content.text);
}
```

> **補足**: Phase 4 の `PromptService` が `connection.prompt()` 呼び出し前に `addAgentMessage(uuid)` を実行する設計のため、通常フローでは `streaming` メッセージが必ず存在する。フォールバックは異常系のみ。

---

### 3. `ToolCall` に `name` フィールドは存在しない

SDK の `ToolCall` 型の実際のフィールド（kiro-cli 送信値）:

| フィールド | 実際の値の例 | 備考 |
|---|---|---|
| `toolCallId` | `"tooluse_DvcfQ7F3..."` | ユニーク ID |
| `title` | `"read"` → `"Reading verify-acp.mjs:1-3"` | 人間可読名称（後述の複数送信で変化） |
| `status` | `"in_progress"` / `undefined` | 初回のみ設定 |
| `rawInput` | `{ ops: [...] }` / `undefined` | 2 回目送信で確定 |
| `kind` | `"read"` | ツールの種別 |
| `name` | **存在しない** | — |

`MessageRepository.addToolCall(id, name, input)` の `name` には `update.title` を渡す。

---

### 4. `tool_call` が同じ `toolCallId` で複数回送信される

kiro-cli は同一 `toolCallId` に対して `tool_call` イベントを段階的に送信し、情報を逐次確定させる。

```
[tool_call #1]  status="in_progress", title="read",                    rawInput=undefined
[tool_call #2]  status=undefined,     title="Reading verify-acp.mjs:1-3", rawInput={...}
[tool_call_update] status="completed", rawOutput={...}
```

`MessageRepository.addToolCall` はエントリを新規作成するため、同じ ID が来た場合に重複が発生する。

**対応**: `SessionUpdateMethod` の `tool_call` 処理で以下を行う。

1. 同じ `toolCallId` のメッセージが repo に既に存在するか確認
2. 存在しない場合: `addToolCall(id, title, rawInput)` で新規作成
3. 存在する場合: `updateToolCall(id, { name: title, input: rawInput })` で更新

これに伴い `MessageRepository.updateToolCall` の受け付けるフィールドを拡張する必要がある（後述の phase2.md 追加タスク参照）。

---

### 5. `ToolCallStatus` マッピング

SDK の `ToolCallStatus` と `MessageRepository.ToolCallMessage.status` は異なる。

| SDK `ToolCallStatus` | `ToolCallMessage.status` |
|---|---|
| `"pending"` | `'running'` |
| `"in_progress"` | `'running'` |
| `"completed"` | `'completed'` |
| `"failed"` | `'error'` |
| `undefined` / `null` | 更新しない |

`SessionUpdateMethod` 内にマッピング関数を定義して使用する。

---

### 6. `ToolCallUpdate.rawOutput` の文字列化

`rawOutput` は `unknown` 型のオブジェクト。`MessageRepository.ToolCallMessage.result` は `string | undefined`。

**対応**: `JSON.stringify(rawOutput)` で文字列化して `result` に渡す。`rawOutput` が `undefined` の場合は `result` を更新しない。

---

## 動作確認スクリプトの使い方

```bash
# 基本フロー確認
node scripts/verify-acp.mjs

# 詳細検査（ToolCall 構造・messageId 等）
node scripts/verify-acp-detail.mjs
```

> **注意**: kiro-cli login 済みであることが前提。
