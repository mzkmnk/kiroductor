# Phase 3: ACP メソッド（agent→client）+ テスト

## タスク

- [ ] `methods/read-text-file.ts` 実装
  - `fs.readFile(params.path, "utf-8")` で全体を読み込み `{ content }` を返す
  - MVP では `params.limit` / `params.line` は無視（詳細は `implementation-plan.md` 参照）
- [ ] `read-text-file.test.ts` 作成・パス
  - 正常系: 指定パスの内容を返す
  - 異常系: 存在しないファイルでエラーを投げる
- [ ] `methods/write-text-file.ts` 実装
  - `fs.writeFile(params.path, params.content, "utf-8")` して `{}` を返す
- [ ] `write-text-file.test.ts` 作成・パス
- [ ] `methods/request-permission.ts` 実装
  - MVP: 最初のオプションを自動承認
  - `{ outcome: { outcome: "selected", optionId: firstOption.optionId } }` を返す
  - レンダラーに承認通知を送信
- [ ] `request-permission.test.ts` 作成・パス
- [ ] `methods/session-update.ts` 実装
  - `agent_message_chunk` → `messageRepo.appendAgentChunk()` + レンダラー通知
  - `tool_call` → `messageRepo.addToolCall()` + レンダラー通知
  - `tool_call_update` → `messageRepo.updateToolCall()` + レンダラー通知
  - その他 → レンダラーに転送のみ
- [ ] `session-update.test.ts` 作成・パス
- [ ] `client-handler.ts` ルーター実装
  - `KiroductorClientHandler implements Client`
  - 各メソッドに委譲するだけ
