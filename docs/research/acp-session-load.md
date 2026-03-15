# ACP Session Load/List 調査結果

## 概要

kiro-cli v1.27.2 / ACP SDK v0.16.0 における `session/load` と `session/list` の仕様と実装方針をまとめる。

## 1. 動作確認結果（`docs/scripts/verify-acp-session.mjs`）

### `listSessions` — 未サポート

- kiro-cli v1.27.2 では `session/list` は **未実装**（`-32601 Method not found`）
- SDK の型定義には存在するが、kiro-cli が対応していない
- → **セッション一覧はアプリ側（`sessions.json`）で完全に管理する**

### `loadSession` — 正常動作

- capability: `loadSession: true`（initialize レスポンスで広告済み）
- 復元時間: 約 2.7 秒（4 チャンク + 4 ツール呼び出しのセッション）
- 復元後に `prompt()` が正常動作することを確認

### `loadSession` レスポンスの構造

```json
{
  "modes": {
    "currentModeId": "kiro_default",
    "availableModes": [
      { "id": "kiro_default", "name": "kiro_default", "description": "..." },
      { "id": "kiro_planner", "name": "kiro_planner", "description": "..." }
    ]
  },
  "models": {
    "currentModelId": "claude-haiku-4.5",
    "availableModels": [
      { "modelId": "auto", "name": "auto", "description": "..." },
      { "modelId": "claude-opus-4.6", "name": "claude-opus-4.6", "description": "..." },
      ...
    ]
  }
}
```

### 復元中に受信する `session/update` の種別

| 種別                  | 件数 | 説明                     |
| --------------------- | ---- | ------------------------ |
| `user_message_chunk`  | 1    | ユーザーの過去の発言     |
| `agent_message_chunk` | 4    | エージェントの過去の返答 |
| `tool_call`           | 4    | 過去のツール呼び出し     |
| `tool_call_update`    | 4    | 過去のツール呼び出し結果 |

**重要な発見**: `user_message_chunk` も再送される。現在の `SessionUpdateMethod` では `user_message_chunk` をハンドリングしていないため、追加が必要。

## 2. kiro-cli のセッション永続化の仕組み

### ファイルシステム上の保存場所

```
~/.kiro/sessions/cli/
├── {sessionId}.json    # セッションメタデータ + 状態
├── {sessionId}.jsonl   # 会話履歴（1行1イベント）
└── {sessionId}.lock    # ロックファイル
```

### セッション JSON の構造

```json
{
  "session_id": "03a6cda3-f407-431a-95b3-db0e6f4c0c9b",
  "cwd": "/path/to/working/directory",
  "created_at": "2026-03-07T09:54:57.087263Z",
  "updated_at": "2026-03-07T09:55:04.753988Z",
  "session_state": {
    "version": "v1",
    "conversation_metadata": { ... }
  }
}
```

### kiroductor アプリ外で作成されたセッションについて

- `~/.kiro/sessions/cli/` には **全ての** kiro-cli セッションが格納される（kiro IDE、kiro-cli 直接実行、他のACPクライアント等）
- 190 件以上のセッションが存在する
- kiroductor で管理するセッションのみをサイドバーに表示するため、`sessions.json` でアプリが作成/ロードしたセッションのみを追跡する

## 3. セッション復元フロー

```
Client (kiroductor)             Agent (kiro-cli)
  |                                  |
  |--- loadSession({ sessionId }) ->|
  |                                  |
  |  (agent が session/update 通知で |
  |   過去の会話履歴を再送する)       |
  |<-- user_message_chunk -----------|  ← ユーザー発言も再送される
  |<-- agent_message_chunk ----------|
  |<-- tool_call --------------------|
  |<-- tool_call_update -------------|
  |<-- agent_message_chunk ----------|
  |  ...                             |
  |                                  |
  |<-- LoadSessionResponse ----------|  ← Promise 解決 = 履歴再送完了
  |                                  |
  |--- prompt({ text }) ----------->|  ← 復元完了後、通常通り prompt 可能
```

## 4. 実装方針

### 4a. `listSessions` は使用しない

kiro-cli v1.27.2 で未サポートのため、セッション一覧は完全にアプリ側で管理する:

- セッション作成時に `sessions.json` へ記録
- `loadSession` でセッション復元時に `sessions.json` の情報を使用
- サイドバーには `sessions.json` に記録されたセッションのみ表示

### 4b. SessionService の変更

```typescript
class SessionService {
  // 既存
  async create(cwd: string): Promise<string>;
  async cancel(): Promise<void>;

  // 追加
  async load(sessionId: string, cwd: string): Promise<void>;
  // listSessions は不要（sessions.json で管理）
}
```

- `load()`: `messageRepo.clear()` → `connection.loadSession()` → `sessionRepo.setSessionId()`
- `loadSession` の Promise が resolve した時点で履歴再送は完了

### 4c. `user_message_chunk` のハンドリング追加

`SessionUpdateMethod` に `user_message_chunk` イベントの処理を追加する必要がある:

```typescript
case 'user_message_chunk':
  // ユーザーメッセージをリポジトリに追加
  // loadSession 時の履歴再送で使われる
  if (update.content.type === 'text') {
    messageRepo.addUserMessage(sessionId, update.content.text);
  }
  notificationService.sendToRenderer('acp:session-update', params);
  break;
```

### 4d. IPC チャネル

| チャネル       | 引数                             | 戻り値 |
| -------------- | -------------------------------- | ------ |
| `session:load` | `sessionId: string, cwd: string` | `void` |

`session:list` は不要（レンダラーは `sessions.json` の内容を直接取得する）。

### 4e. Preload API

```typescript
session: {
  // 追加
  load(sessionId: string, cwd: string): Promise<void>;
}
```

## 5. 注意事項

- `loadSession` 中は UI で「セッション復元中」のローディング表示が必要
- 復元中に `session/update` が来るため、レンダラーへの通知が発生する（既存の `SessionUpdateMethod` でそのまま処理可能）
- `loadSession` レスポンスに `modes` と `models` が含まれる — 将来的にモード/モデル切り替え UI に使用可能
- `loadSession` の Promise 解決時点で履歴再送は完了している（`prompt()` と同様のブロッキング呼び出し）
