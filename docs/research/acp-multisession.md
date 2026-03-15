# ACP マルチセッション調査結果

## 概要

kiro-cli v1.27.2 / ACP SDK v0.16.0 において、1つの `ClientSideConnection` で複数セッションを同時に管理できるかを検証した。

検証スクリプト: `docs/scripts/verify-acp-multisession.mjs`

## 結論

**1つの接続で複数セッションの同時管理は問題なし。** SDK 側・kiro-cli 側の両方で安全に動作する。

## 検証結果

| テスト                              | 結果 | 詳細                                                   |
| ----------------------------------- | ---- | ------------------------------------------------------ |
| 2セッション同時作成                 | OK   | `newSession()` を2回呼び、異なる sessionId が返される  |
| 逐次 prompt（A→B）                  | OK   | 各セッションが独立して正しく応答                       |
| sessionId ルーティング              | OK   | `session/update` の sessionId が undefined のものは0件 |
| 並行 prompt                         | OK   | `Promise.all` で同時送信しても両方 `end_turn` で完了   |
| loadSession 後の別セッション prompt | OK   | セッション A ロード後にセッション B へ prompt 可能     |

## SDK 側の根拠

### トランスポート層はセッション非依存

`ClientSideConnection` の内部 `Connection` クラスは JSON-RPC のリクエスト ID（`#pendingResponses = new Map()`）でメッセージをルーティングしており、セッション固有の状態を持たない。

### 全メソッドが sessionId を明示的にパラメータに含む

| メソッド        | sessionId                      | 備考               |
| --------------- | ------------------------------ | ------------------ |
| `newSession()`  | なし（レスポンスで返る）       | 新規セッション作成 |
| `prompt()`      | `PromptRequest.sessionId`      | 必須パラメータ     |
| `cancel()`      | `CancelNotification.sessionId` | 必須パラメータ     |
| `loadSession()` | `LoadSessionRequest.sessionId` | 必須パラメータ     |

### session/update 通知に sessionId が含まれる

```typescript
type SessionNotification = {
  sessionId: SessionId; // ← 必ず含まれる
  update: SessionUpdate;
};
```

クライアント側で正しいセッションにルーティング可能。

### イベントハンドラはステートレス

`readTextFile`, `writeTextFile`, `requestPermission`, `sessionUpdate` などのコールバックはすべてパラメータ駆動で、セッション固有の内部状態を持たない。

## kiro-cli 側の根拠

### 並行 prompt が成功する

2つのセッションに `Promise.all` で同時に prompt を送信しても、両方が `end_turn` で正常完了する。kiro-cli は内部的にセッション単位で処理を分離している。

### sessionId ルーティングが正確

並行 prompt 時でも `session/update` 通知の `sessionId` は正しく設定されており、orphaned（sessionId なし）の update は0件だった。

### loadSession 後のセッション切替が可能

セッション A を `loadSession` で復元した後、セッション B に prompt を送信しても問題なく応答が得られる。ロード操作が他のセッションに影響しない。

## Phase 6C への影響

Phase 6C の設計方針「**ACP接続は共有: 1つの `ClientSideConnection` で複数セッションを管理**」は妥当であり、変更不要。

- 逐次的なセッション切替だけでなく、並行 prompt も動作するため、将来的なバックグラウンドセッション処理も実現可能
- `session/update` の `sessionId` を使ったルーティングにより、メッセージの混在は発生しない
