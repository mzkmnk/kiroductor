# Phase: セッション並列化サポート

## 概要

現在のセッション管理は「アクティブセッション1つだけ」が前提。
セッションAで prompt 実行中にセッションBに切り替えると、Aの実行は続くが UI に反映されず、メッセージも `clearSession()` で消えてしまう。

この Phase では、**バックグラウンドセッションの実行を維持しつつ、切り替え時にメッセージを保持**し、**サイドバーにセッション状態を表示**する。

## 変更方針

### 1. SessionRepository: セッションごとの処理状態を追跡

- [x] `processingSessionIds: Set<SessionId>` を追加
- [x] `addProcessing(sessionId)` / `removeProcessing(sessionId)` / `isProcessing(sessionId)` / `getProcessingSessionIds()` メソッドを追加
- **AC**:
  - `addProcessing('s1')` 後に `isProcessing('s1')` は `true` を返す
  - `removeProcessing('s1')` 後に `isProcessing('s1')` は `false` を返す
  - `getProcessingSessionIds()` は処理中セッション ID の配列を返す
  - 管理外のセッション ID を `addProcessing` しても例外を投げない（prompt 開始時に使うため）

### 2. SessionService.load(): メッセージを保持する

- [x] `load()` 内の `messageRepo.clearSession(sessionId)` を削除する
  - `loadSession()` で kiro-cli 側のセッション状態が復元され、`SessionUpdateMethod` 経由でメッセージが再受信されるため不要
  - ただし、セッションが初めて load される場合は `initSession()` で空配列を用意する
- **AC**:
  - セッション A のメッセージがある状態で `load('A', cwd)` を呼んでも、メッセージが消えないこと

### 3. SessionHandler: prompt / cancel にセッション ID を渡せるようにする

- [x] `session:prompt` — `text` のみ → `sessionId?: SessionId, text: string` に変更。省略時はアクティブセッション
- [x] `session:cancel` — 引数なし → `sessionId?: SessionId` に変更。省略時はアクティブセッション
- [x] prompt 開始時に `sessionRepo.addProcessing(sessionId)` を呼び、完了時に `removeProcessing(sessionId)` を呼ぶ
- [x] prompt 完了時に `acp:prompt-completed` 通知をレンダラーに送信する（`{ sessionId }` ペイロード）
- **AC**:
  - 非アクティブセッションの sessionId を指定して prompt を送信できること
  - prompt 実行中は `sessionRepo.isProcessing(sessionId)` が `true` を返すこと
  - prompt 完了後は `sessionRepo.isProcessing(sessionId)` が `false` を返すこと

### 4. IPC 型定義の更新

- [x] `IpcInvokeChannels['session:prompt']` の args を `[text: string]` → `[sessionId: SessionId | undefined, text: string]` に変更
- [x] `IpcInvokeChannels['session:cancel']` の args を `[]` → `[sessionId?: SessionId]` に変更
- [x] `IpcOnChannels` に `'acp:prompt-completed': { sessionId: SessionId }` を追加
- [x] `IpcInvokeChannels` に `'session:processing-sessions': { args: []; return: SessionId[] }` を追加

### 5. Preload API の更新

- [x] `session.prompt` — `(text: string)` → `(text: string, sessionId?: SessionId)` に変更
- [x] `session.cancel` — `()` → `(sessionId?: SessionId)` に変更
- [x] `session.onPromptCompleted` — `(callback: (payload: { sessionId: SessionId }) => void) => () => void` を追加
- [x] `session.getProcessingSessions` — `() => Promise<SessionId[]>` を追加

### 6. App.tsx: onUpdate のセッション ID フィルタリング

- [x] `onUpdate` コールバック内で `notification.sessionId` を確認し、**アクティブセッションのメッセージのみ** `dispatchChat` する
- [x] バックグラウンドセッションの更新は `MessageRepository` に蓄積されるだけ（main プロセス側で処理済み）
- [x] セッション切り替え時に `load()` を呼ばず、`switch()` + `getMessages(sessionId)` のみで切り替える（メッセージは既にメモリ上にある）
- [x] `isProcessing` をセッションごとに管理（`processingSessionIds: Set<string>` の state）
- [x] `onPromptCompleted` を購読し、完了時に `processingSessionIds` から削除
- **AC**:
  - セッション A で prompt 中にセッション B に切り替えても、A の実行が継続すること
  - セッション B に切り替え後、B のメッセージが表示されること
  - セッション A に戻ると、A のメッセージ（prompt 実行中のストリーミング含む）が表示されること

### 7. SessionSidebar: セッション状態の表示

- [x] `processingSessionIds` を props で受け取る
- [x] 処理中のセッションにインジケーター（アニメーション付きドット）を表示する
- **AC**:
  - prompt 実行中のセッションにインジケーターが表示されること
  - prompt 完了後にインジケーターが消えること

### 8. テストの更新

- [x] `SessionRepository` のテストに processing 関連を追加
- [x] `SessionHandler` のテストに sessionId 指定の prompt / cancel を追加
- [x] `SessionService` のテストで `clearSession` が呼ばれないことを確認
