# Phase 5: Handler 層 + IPC 配線

## タスク

- [ ] `acp.handler.ts` 実装
  - `acp:start` → `acpConnectionService.start()`
  - `acp:stop` → `acpConnectionService.stop()`
  - `acp:status` → `connectionRepository.getStatus()`
- [ ] `session.handler.ts` 実装
  - `session:new` → `sessionService.create(cwd)`
  - `session:prompt` → `promptService.send(text)`
  - `session:cancel` → `sessionService.cancel()`
  - `session:messages` → `messageRepository.getAll()`
- [ ] `handlers/index.ts` で全 handler を一括登録
- [ ] `main.ts` で Composition Root を実装
  - 全インスタンス生成 → 依存関係注入 → handler 登録
- [ ] `preload.ts` 実装
  - `contextBridge.exposeInMainWorld` で `window.kiroductor` を公開
  - `onUpdate` / `onStatusChange` はクリーンアップ関数を返す
  - `ipcRenderer` を直接公開しない
- [ ] エンドツーエンド動作確認
  - レンダラーからセッション作成 → "hello" 送信 → ストリーミングレスポンス確認
