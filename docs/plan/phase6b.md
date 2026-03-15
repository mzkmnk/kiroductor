# Phase 6B: ACP Session Load

kiro-cli の `session/load` API をサービス層に統合する。
これにより、過去のセッションを復元できるようになる。

> **調査結果**: `listSessions` は kiro-cli v1.27.2 で未サポート（`-32601`）。
> セッション一覧は `sessions.json` でアプリ側が完全に管理する。
> 詳細: [ACP Session Load 調査](../research/acp-session-load.md)

## 関連ドキュメント

- 調査結果: [ACP Session Load 調査](../research/acp-session-load.md)
- 検証スクリプト: [verify-acp-session.mjs](../scripts/verify-acp-session.mjs)
- 前フェーズ: [Phase 6A — 設定管理 + Bare Repo](./phase6a.md)
- 次フェーズ: [Phase 6C — マルチセッション Repository/Service](./phase6c.md)

## ConnectionProxy の拡張

- [x] `container.ts` の `connectionProxy` に `loadSession` メソッドを追加する
  - **AC**: `connectionProxy.loadSession()` が `connection.loadSession()` に委譲される
  - 注: `listSessions` は kiro-cli 未サポートのため追加不要

## SessionService への `load` メソッド追加

- [x] `load(sessionId, cwd)`: 既存セッションを復元する
  - `messageRepo.clear()` でメッセージをリセット
  - `connection.loadSession({ sessionId, cwd, mcpServers: [] })` を呼ぶ
  - `sessionRepo.setSessionId(sessionId)` で現在のセッション ID を更新
  - **AC**: `load()` 前に `messageRepo` がクリアされること
  - **AC**: `connection.loadSession()` に正しいパラメータが渡されること
  - **AC**: `load()` 完了後に `sessionRepo` のセッション ID が更新されること
  - **AC**: `load()` 完了後に `messageRepo` に kiro-cli から再送された履歴が入っていること（`loadSession` の Promise 解決 = 履歴再送完了）
- [x] テスト: `load()` がリポジトリのクリア → `loadSession` → ID 保存の順で動作すること

## SessionUpdateMethod への `user_message_chunk` ハンドリング追加

> **検証で判明**: `loadSession` 時に kiro-cli は `user_message_chunk` も再送する。
> 現在の `SessionUpdateMethod` では未ハンドリング。

- [x] `user_message_chunk` イベントの処理を追加する
  - `content.type === 'text'` のとき、`messageRepo.addUserMessage(content.text)` を呼ぶ
  - `notificationService.sendToRenderer` で通知する
  - **AC**: `user_message_chunk` 受信時にユーザーメッセージがリポジトリに追加される
  - **AC**: `notificationService.sendToRenderer` が呼ばれる
- [x] テスト: `user_message_chunk` でユーザーメッセージが追加されること

## SessionHandler への IPC チャネル追加

- [x] `session:load` チャネル: `sessionService.load(sessionId, cwd)` を呼ぶハンドラーを実装する

## IpcInvokeChannels 型の更新

```typescript
// src/shared/ipc.ts に追加
'session:load': { args: [sessionId: string, cwd: string]; return: void };
```

## Preload API の追加

- [x] `window.kiroductor.session.load(sessionId, cwd)` を追加する

## セッション復元中の状態管理

- [x] `SessionRepository` に `isLoading: boolean` フィールドを追加する
  - **AC**: `load()` 開始時に `true`、完了時に `false` になる
- [x] レンダラーへ復元開始/完了の通知を送る
  - **AC**: `acp:session-loading` チャネルで `{ loading: boolean }` を通知する
