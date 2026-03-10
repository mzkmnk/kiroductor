# Phase 2: Repository 層 + テスト

## タスク

- [ ] `connection.repository.ts` 実装
  - `getConnection` / `setConnection`
  - `getProcess` / `setProcess`
  - `getStatus` / `setStatus`
  - `appendStderr` / `getStderrLogs`
  - `clear`
- [ ] `connection.repository.test.ts` 作成・パス
- [ ] `session.repository.ts` 実装
  - `getSessionId` / `setSessionId`
  - `hasActiveSession`
- [ ] `session.repository.test.ts` 作成・パス
- [ ] `message.repository.ts` 実装
  - `addUserMessage`
  - `addAgentMessage` / `appendAgentChunk` / `completeAgentMessage`
  - `addToolCall` / `updateToolCall`
  - `getAll` / `clear`
- [ ] `message.repository.test.ts` 作成・パス
