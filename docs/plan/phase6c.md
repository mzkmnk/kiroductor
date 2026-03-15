# Phase 6C: マルチセッション Repository / Service / Handler

単一セッションからマルチセッションへの拡張。
複数の ACP セッションを同時に管理し、セッション間の切り替えを可能にする。

## 関連ドキュメント

- 前フェーズ: [Phase 6B — ACP Session Load/List](./phase6b.md)
- 次フェーズ: [Phase 6D — マルチセッション UI](./phase6d.md)
- 調査: [ACP マルチセッション調査結果](../research/acp-multisession.md)

## 設計方針

### 現在の制約

- 単一の `SessionRepository`（`sessionId: string | null`）
- 単一の `MessageRepository`（全メッセージがフラットに格納）
- ACP 接続は1つの kiro-cli プロセスで複数セッションをサポート済み

### マルチセッションの方針

1. **セッションごとにメッセージを分離**: `Map<sessionId, Message[]>` で管理
2. **アクティブセッションの概念**: UI に表示中のセッションを追跡
3. **ACP 接続は共有**: 1つの `ClientSideConnection` で複数セッションを管理
4. **セッション一覧はアプリ側管理**: `listSessions` は kiro-cli v1.27.2 で未サポートのため、`sessions.json` でアプリが作成/ロードしたセッションのみを追跡する（[調査結果](../research/acp-session-load.md)参照）

## SessionRepository の拡張

- [x] `activeSessionId: string | null` — 現在チャットエリアに表示中のセッション ID
- [x] `sessionIds: Set<string>` — 管理中の全セッション ID
- [x] `addSession(sessionId)`: セッションを追加する
  - **AC**: `sessionIds` にセッション ID が追加される
- [x] `removeSession(sessionId)`: セッションを削除する
  - **AC**: `sessionIds` からセッション ID が削除される
  - **AC**: アクティブセッションが削除された場合、`activeSessionId` が `null` になる
- [x] `setActiveSession(sessionId)`: アクティブセッションを切り替える
  - **AC**: `sessionIds` に含まれるセッション ID のみ設定可能
  - **AC**: 存在しないセッション ID を指定した場合、エラーが投げられる
- [x] `getActiveSessionId()`: アクティブセッション ID を返す
- [x] `getAllSessionIds()`: 全セッション ID を返す
- [x] 既存の `getSessionId()` / `setSessionId()` / `hasActiveSession()` は下位互換のために `activeSessionId` を使うよう変更する
- [ ] 全呼び出し元の移行が完了したら `getSessionId()` / `setSessionId()` / `hasActiveSession()` を削除する（PromptService・SessionService の修正完了後）
- [x] テスト: 各メソッドの動作を検証する

## MessageRepository の拡張

- [x] 内部データ構造を `Map<string, Message[]>` に変更する
  - キー: セッション ID
  - 値: そのセッションのメッセージ配列
- [x] `initSession(sessionId)`: セッション用の空メッセージ配列を初期化する
  - **AC**: 既に存在する場合、上書きしない
- [x] `clearSession(sessionId)`: 特定セッションのメッセージをクリアする
- [x] 既存メソッドにセッション ID パラメータを追加する:
  - `getAll(sessionId)` → 指定セッションのメッセージを返す
  - `addUserMessage(sessionId, text)`
  - `addAgentMessage(sessionId, id)`
  - `appendAgentChunk(sessionId, id, chunk)`
  - `completeAgentMessage(sessionId, id)`
  - `addToolCall(sessionId, id, name, input)`
  - `updateToolCall(sessionId, id, update)`
  - `clear()` → 全セッションのメッセージをクリア
- [x] テスト: セッション間でメッセージが分離されていることを検証する

## SessionUpdateMethod の修正

- [x] `session/update` 通知に含まれる `sessionId` を使って、正しいセッションのメッセージを更新する
  - **AC**: `params.sessionId` が `messageRepo.addAgentMessage(sessionId, ...)` 等に渡される
  - **AC**: 異なるセッションの更新が混在しない

## PromptService の修正

- [x] `send(sessionId, text)` にセッション ID を明示的に受け取るよう変更する
  - **AC**: 指定されたセッションのメッセージにユーザーメッセージが追加される
  - **AC**: `connection.prompt()` に正しい `sessionId` が渡される

## SessionService の修正

- [x] `create(cwd)` でセッション作成後に `SessionRepository` と `MessageRepository` の両方を更新する
  - **AC**: `sessionRepo.addSession(sessionId)` が呼ばれる
  - **AC**: `messageRepo.initSession(sessionId)` が呼ばれる
  - **AC**: `sessionRepo.setActiveSession(sessionId)` が呼ばれる
- [x] `load(sessionId, cwd)` でも同様にマルチセッション対応する

## SessionHandler の修正

- [x] `session:switch` チャネル: アクティブセッションを切り替える
  - `sessionRepo.setActiveSession(sessionId)` を呼ぶ
  - レンダラーに `acp:session-switched` 通知を送る
  - **AC**: 切り替え後にレンダラーが新しいセッションのメッセージを取得できる
- [x] `session:messages` チャネル: アクティブセッション（または指定セッション）のメッセージを返すよう変更する
- [x] `session:active` チャネル: 現在のアクティブセッション ID を返す

## ConfigRepository との連携

- [x] セッション作成/ロード時に `ConfigRepository.upsertSession()` で永続化する
  - **AC**: セッション情報が `~/.kiroductor/sessions.json` に保存される
- [x] アプリ起動時に `ConfigRepository.readSessions()` で過去のセッション一覧を復元する

## IPC チャネル一覧（追加分）

| チャネル         | 引数                | 戻り値           | 説明                         |
| ---------------- | ------------------- | ---------------- | ---------------------------- |
| `session:switch` | `sessionId: string` | `void`           | アクティブセッション切替     |
| `session:active` | なし                | `string \| null` | アクティブセッション ID 取得 |
| `session:all`    | なし                | `string[]`       | 全セッション ID 取得         |

## Preload API の追加

- [ ] `window.kiroductor.session.switch(sessionId)` を追加する
- [ ] `window.kiroductor.session.getActive()` を追加する
- [ ] `window.kiroductor.session.getAll()` を追加する
- [ ] `window.kiroductor.session.onSessionSwitched(callback)` を追加する
