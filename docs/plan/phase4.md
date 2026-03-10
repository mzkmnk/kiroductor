# Phase 4: Service 層 + テスト

## タスク

- [ ] `notification.service.ts` 実装
  - `sendToRenderer(channel, data)` — `BrowserWindow.webContents.send()` のラッパー
  - ウィンドウが存在しない / destroyed の場合は無視
- [ ] `acp-connection.service.ts` 実装
  - `start()`: `kiro-cli acp` を spawn → `ClientSideConnection` 作成 → `initialize()` → repo に保存
  - `stop()`: プロセスを kill → repo をクリア
  - プロセスの `exit` / `error` イベントをハンドリング
- [ ] `acp-connection.service.test.ts` 作成・パス（spawn / connection のモック）
- [ ] `session.service.ts` 実装
  - `create(cwd)`: `connection.newSession({ cwd, mcpServers: [] })` → `sessionId` を保存 → messageRepo をリセット
  - `cancel()`: `connection.cancel({ sessionId })`
- [ ] `session.service.test.ts` 作成・パス
- [ ] `prompt.service.ts` 実装
  - `send(text)`: ユーザーメッセージ追加 → 空エージェントメッセージ追加 → `connection.prompt()` 呼び出し → 完了後 complete にマーク → `stopReason` を返す
- [ ] `prompt.service.test.ts` 作成・パス
