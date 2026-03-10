# ACP (Agent Client Protocol) 調査結果

## 概要

Agent Client Protocol (ACP) は、コードエディタ/IDEとAIコーディングエージェント間の通信を標準化するプロトコル。LSP (Language Server Protocol) がエディタと言語サーバー間を標準化したのと同様に、ACPはエディタとAIエージェント間を標準化する。

- **仕様リポジトリ**: https://github.com/agentclientprotocol/agent-client-protocol
- **公式サイト**: https://agentclientprotocol.com/
- **TypeScript SDK**: `@agentclientprotocol/sdk` (npm)
- **ライセンス**: Apache 2.0

## 通信方式

### ローカルエージェント（Kiroductorで使用）

- **トランスポート**: JSON-RPC 2.0 over stdio
- エディタがエージェントのサブプロセスを起動し、stdin/stdout経由で通信
- 1つの接続で複数の同時セッションをサポート

### リモートエージェント

- HTTP/WebSocket over JSON-RPC 2.0（開発中）

## JSON-RPC 2.0 メッセージフォーマット

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": { ... }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

### Notification（idなし、応答不要）

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": { ... }
}
```

### Error

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Authentication required"
  }
}
```

## メソッド一覧

### 初期化・認証

| メソッド       | 方向         | 説明                                               |
| -------------- | ------------ | -------------------------------------------------- |
| `initialize`   | client→agent | 接続確立、プロトコルバージョン交換、capability交換 |
| `authenticate` | client→agent | 認証（agentが広告した認証方式を使用）              |

#### `initialize` パラメータ例

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "0.11.1",
    "clientInfo": {
      "name": "kiroductor",
      "version": "0.1.0"
    },
    "capabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    }
  }
}
```

#### `initialize` レスポンス例

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "0.11.1",
    "agentInfo": {
      "name": "kiro",
      "version": "1.x.x"
    },
    "capabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": false
      },
      "mcp": {
        "stdio": true,
        "http": true,
        "sse": true
      }
    }
  }
}
```

### セッション管理

| メソッド                    | 方向         | 説明                                                   |
| --------------------------- | ------------ | ------------------------------------------------------ |
| `session/new`               | client→agent | 新規セッション作成                                     |
| `session/load`              | client→agent | 既存セッション読み込み（`loadSession` capability必要） |
| `session/list`              | client→agent | セッション一覧取得（フィルタ可能）                     |
| `session/prompt`            | client→agent | プロンプト送信、ターン開始                             |
| `session/cancel`            | client→agent | 実行中のオペレーションをキャンセル                     |
| `session/set_mode`          | client→agent | エージェントモード切替（ask, code等）                  |
| `session/set_config_option` | client→agent | セッション設定変更                                     |

#### `session/new` パラメータ例

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/new",
  "params": {
    "workspaceRoots": ["/path/to/project"]
  }
}
```

#### `session/prompt` パラメータ例

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/prompt",
  "params": {
    "sessionId": "session-uuid",
    "content": [
      {
        "type": "text",
        "text": "Fix the bug in auth.ts"
      }
    ]
  }
}
```

### ファイルシステム操作

| メソッド             | 方向         | 説明                                                  |
| -------------------- | ------------ | ----------------------------------------------------- |
| `fs/read_text_file`  | agent→client | ファイル読み取り（`fs.readTextFile` capability必要）  |
| `fs/write_text_file` | agent→client | ファイル書き込み（`fs.writeTextFile` capability必要） |

### ターミナル管理

| メソッド                 | 方向         | 説明                         |
| ------------------------ | ------------ | ---------------------------- |
| `terminal/create`        | agent→client | ターミナル作成・コマンド実行 |
| `terminal/output`        | agent→client | ターミナル出力取得           |
| `terminal/wait_for_exit` | agent→client | コマンド完了待ち             |
| `terminal/kill`          | agent→client | コマンド終了                 |
| `terminal/release`       | agent→client | ターミナルリソース解放       |

### パーミッション

| メソッド                     | 方向         | 説明                   |
| ---------------------------- | ------------ | ---------------------- |
| `session/request_permission` | agent→client | ユーザー承認リクエスト |

## ストリーミング通知（Notification）

`session/prompt` 送信後、agentは以下のnotificationをストリーミングで返す。promptのresponseはターン完了時に返る。

### SessionNotification の種類

| 通知タイプ                | 説明                                       |
| ------------------------- | ------------------------------------------ |
| `ContentChunk`            | ストリーミングテキストチャンク（Markdown） |
| `ToolCallUpdate`          | ツール呼び出し情報（ツール名、引数、結果） |
| `AvailableCommandsUpdate` | 利用可能コマンドの更新                     |
| `ConfigOptionUpdate`      | 設定変更通知                               |
| `CurrentModeUpdate`       | モード変更通知                             |

### ContentChunk 例

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "session-uuid",
    "kind": "ContentChunk",
    "content": {
      "type": "text",
      "text": "Here is the fix..."
    }
  }
}
```

### ToolCallUpdate 例

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "session-uuid",
    "kind": "ToolCallUpdate",
    "toolCallId": "tc-123",
    "name": "edit_file",
    "arguments": { "path": "src/auth.ts", "content": "..." },
    "status": "completed",
    "result": { "text": "File updated" }
  }
}
```

## Content Block 型

| 型                 | 説明                                           |
| ------------------ | ---------------------------------------------- |
| `TextContent`      | プレーンテキストまたはMarkdown（必須サポート） |
| `ImageContent`     | 画像データ（MIMEタイプ指定）                   |
| `AudioContent`     | 音声データ                                     |
| `ResourceLink`     | 外部リソースへの参照                           |
| `EmbeddedResource` | リソース内容の埋め込み                         |

## ツール呼び出し構造

```typescript
interface ToolCall {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolCallResult {
  toolCallId: string;
  text?: string;
  content?: ContentBlock[];
  error?: string;
}
```

## エラーコード

| コード   | 説明                    |
| -------- | ----------------------- |
| `-32700` | Parse error             |
| `-32600` | Invalid request         |
| `-32601` | Method not found        |
| `-32602` | Invalid params          |
| `-32603` | Internal error          |
| `-32000` | Authentication required |
| `-32002` | Resource not found      |

## Kiro CLI 固有拡張（`_kiro.dev/` prefix）

Kiro CLIはACP標準メソッドに加え、独自の拡張メソッドを提供する。これらは `_kiro.dev/` prefixを持ち、対応しないクライアントは安全に無視できる。

### スラッシュコマンド

| メソッド                       | 説明                       |
| ------------------------------ | -------------------------- |
| `_kiro.dev/commands/execute`   | スラッシュコマンド実行     |
| `_kiro.dev/commands/options`   | オートコンプリート候補取得 |
| `_kiro.dev/commands/available` | 利用可能コマンド一覧       |

### MCP サーバーイベント

| メソッド                           | 説明                    |
| ---------------------------------- | ----------------------- |
| `_kiro.dev/mcp/oauth_request`      | OAuth認証URL通知        |
| `_kiro.dev/mcp/server_initialized` | MCPサーバー利用可能通知 |

### セッション管理拡張

| メソッド                      | 説明                     |
| ----------------------------- | ------------------------ |
| `_kiro.dev/compaction/status` | コンテキスト圧縮進捗     |
| `_kiro.dev/clear/status`      | セッション履歴クリア状態 |

## Kiro CLIでのACP起動方法

```bash
# 基本起動
kiro-cli acp

# エージェント名指定
kiro-cli acp --agent my-agent
```

## Capability 設計上の注意

- `_meta` プロパティでクライアント/エージェント固有のメタデータを付与可能（互換性を壊さない）
- MCP表現を可能な限り再利用する設計
- デフォルトテキストフォーマットはMarkdown

## 参照リンク

- [ACP 公式サイト](https://agentclientprotocol.com/)
- [ACP GitHub リポジトリ](https://github.com/agentclientprotocol/agent-client-protocol)
- [ACP TypeScript SDK](https://www.npmjs.com/package/@agentclientprotocol/sdk)
- [Kiro CLI ACP ドキュメント](https://kiro.dev/docs/cli/acp/)
- [Kiro ACP 採用ブログ](https://kiro.dev/blog/kiro-adopts-acp/)
- [ACP エージェント一覧](https://agentclientprotocol.com/overview/agents)
- [ACP クライアント一覧](https://agentclientprotocol.com/overview/clients)
- [ACP スキーマ定義](https://github.com/agentclientprotocol/agent-client-protocol/tree/main/schema)
- [JetBrains ACP ドキュメント](https://www.jetbrains.com/help/ai-assistant/acp.html)
- [Goose ACP 解説](https://block.github.io/goose/blog/2025/10/24/intro-to-agent-client-protocol-acp/)
- [DEV Community: Kiro CLI ACP統合](https://dev.to/aws-builders/integrate-kiro-cli-into-your-ai-agent-via-acp-10jn)
