import { describe, it, expect, beforeEach, assert } from 'vitest';
import { MessageRepository } from '../message.repository';

describe('MessageRepository', () => {
  let repo: MessageRepository;
  const SESSION_A = 'session-a';
  const SESSION_B = 'session-b';

  beforeEach(() => {
    repo = new MessageRepository();
  });

  describe('初期状態', () => {
    it('getAll は空配列を返す', () => {
      expect(repo.getAll(SESSION_A)).toEqual([]);
    });
  });

  describe('initSession', () => {
    it('initSession で空のメッセージ配列が初期化される', () => {
      repo.initSession(SESSION_A);
      expect(repo.getAll(SESSION_A)).toEqual([]);
    });

    it('既に存在するセッションに対して initSession を呼んでも上書きしない', () => {
      repo.initSession(SESSION_A);
      repo.addUserMessage(SESSION_A, 'hello');
      repo.initSession(SESSION_A);
      expect(repo.getAll(SESSION_A)).toHaveLength(1);
    });
  });

  describe('clearSession', () => {
    it('clearSession で指定セッションのメッセージがクリアされる', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      repo.clearSession(SESSION_A);
      expect(repo.getAll(SESSION_A)).toEqual([]);
    });

    it('clearSession は他のセッションに影響しない', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      repo.addUserMessage(SESSION_B, 'world');
      repo.clearSession(SESSION_A);
      expect(repo.getAll(SESSION_A)).toEqual([]);
      expect(repo.getAll(SESSION_B)).toHaveLength(1);
    });
  });

  describe('addUserMessage', () => {
    it('addUserMessage(sessionId, "hello") を呼ぶと type: "user", text: "hello" のメッセージが getAll(sessionId) で取得できる', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      const messages = repo.getAll(SESSION_A);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ type: 'user', text: 'hello' });
    });

    it('attachments を渡したとき正しく保存されること', () => {
      const attachments = [{ mimeType: 'image/png', data: 'base64data' }];
      repo.addUserMessage(SESSION_A, 'hello', attachments);
      const messages = repo.getAll(SESSION_A);
      expect(messages[0]).toMatchObject({
        type: 'user',
        text: 'hello',
        attachments: [{ mimeType: 'image/png', data: 'base64data' }],
      });
    });

    it('attachments 省略時は attachments プロパティが存在しないこと', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      const messages = repo.getAll(SESSION_A);
      expect(messages[0]).not.toHaveProperty('attachments');
    });

    it('空の attachments 配列を渡した場合も attachments プロパティが保持されること', () => {
      repo.addUserMessage(SESSION_A, 'hello', []);
      const messages = repo.getAll(SESSION_A);
      expect(messages[0]).toHaveProperty('attachments', []);
    });

    it('追加されたメッセージに一意な id が付与される', () => {
      const m1 = repo.addUserMessage(SESSION_A, 'first');
      const m2 = repo.addUserMessage(SESSION_A, 'second');
      expect(m1.id).toBeTruthy();
      expect(m2.id).toBeTruthy();
      expect(m1.id).not.toBe(m2.id);
    });
  });

  describe('addAgentMessage', () => {
    it('addAgentMessage(sessionId, "agent-1") を呼ぶと type: "agent", status: "streaming", text: "" のメッセージが追加される', () => {
      repo.addAgentMessage(SESSION_A, 'agent-1');
      const messages = repo.getAll(SESSION_A);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'agent-1',
        type: 'agent',
        text: '',
        status: 'streaming',
      });
    });
  });

  describe('appendAgentChunk', () => {
    it('appendAgentChunk(sessionId, id, chunk) を複数回呼ぶとテキストが順番に連結される', () => {
      repo.addAgentMessage(SESSION_A, 'agent-1');
      repo.appendAgentChunk(SESSION_A, 'agent-1', 'Hello');
      repo.appendAgentChunk(SESSION_A, 'agent-1', ' ');
      repo.appendAgentChunk(SESSION_A, 'agent-1', 'World');
      const messages = repo.getAll(SESSION_A);
      const msg = messages[0];
      assert(msg.type === 'agent');
      expect(msg.text).toBe('Hello World');
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addAgentMessage(SESSION_A, 'agent-1');
      repo.appendAgentChunk(SESSION_A, 'unknown-id', 'chunk');
      const msg = repo.getAll(SESSION_A)[0];
      assert(msg.type === 'agent');
      expect(msg.text).toBe('');
    });
  });

  describe('completeAgentMessage', () => {
    it('completeAgentMessage(sessionId, id) を呼ぶと対象メッセージの status が "completed" になる', () => {
      repo.addAgentMessage(SESSION_A, 'agent-1');
      repo.appendAgentChunk(SESSION_A, 'agent-1', 'response text');
      repo.completeAgentMessage(SESSION_A, 'agent-1');
      const messages = repo.getAll(SESSION_A);
      const msg = messages[0];
      assert(msg.type === 'agent');
      expect(msg.status).toBe('completed');
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addAgentMessage(SESSION_A, 'agent-1');
      repo.completeAgentMessage(SESSION_A, 'unknown-id');
      const msg = repo.getAll(SESSION_A)[0];
      assert(msg.type === 'agent');
      expect(msg.status).toBe('streaming');
    });
  });

  describe('addToolCall', () => {
    it('addToolCall(sessionId, id, name, input) を呼ぶと type: "tool_call", status: "in_progress" のメッセージが追加される', () => {
      repo.addToolCall(SESSION_A, 'tool-1', 'read_file', { path: '/tmp/foo.txt' });
      const messages = repo.getAll(SESSION_A);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'tool-1',
        type: 'tool_call',
        name: 'read_file',
        input: { path: '/tmp/foo.txt' },
        status: 'in_progress',
      });
    });
  });

  describe('updateToolCall', () => {
    it('updateToolCall(sessionId, id, { status: "completed", result: "..." }) でステータスと結果が更新される', () => {
      repo.addToolCall(SESSION_A, 'tool-1', 'read_file', { path: '/tmp/foo.txt' });
      repo.updateToolCall(SESSION_A, 'tool-1', {
        status: 'completed',
        result: 'file content here',
      });
      const messages = repo.getAll(SESSION_A);
      expect(messages[0]).toMatchObject({ status: 'completed', result: 'file content here' });
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addToolCall(SESSION_A, 'tool-1', 'read_file', {});
      repo.updateToolCall(SESSION_A, 'unknown-id', { status: 'completed' });
      const msg = repo.getAll(SESSION_A)[0];
      assert(msg.type === 'tool_call');
      expect(msg.status).toBe('in_progress');
    });

    it('updateToolCall(sessionId, id, { name: "new name" }) で name フィールドが更新される', () => {
      repo.addToolCall(SESSION_A, 'tool-1', 'old_name', {});
      repo.updateToolCall(SESSION_A, 'tool-1', { name: 'new name' });
      const msg = repo.getAll(SESSION_A)[0];
      assert(msg.type === 'tool_call');
      expect(msg.name).toBe('new name');
    });

    it('updateToolCall(sessionId, id, { input: { key: "val" } }) で input フィールドが更新される', () => {
      repo.addToolCall(SESSION_A, 'tool-1', 'read_file', {});
      repo.updateToolCall(SESSION_A, 'tool-1', { input: { key: 'val' } });
      const msg = repo.getAll(SESSION_A)[0];
      assert(msg.type === 'tool_call');
      expect(msg.input).toEqual({ key: 'val' });
    });
  });

  describe('getAll', () => {
    it('追加順にすべてのメッセージが返される', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      repo.addAgentMessage(SESSION_A, 'agent-1');
      repo.addToolCall(SESSION_A, 'tool-1', 'search', {});
      const messages = repo.getAll(SESSION_A);
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('agent');
      expect(messages[2].type).toBe('tool_call');
    });

    it('返り値の配列を変更しても内部状態に影響しない', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      const messages = repo.getAll(SESSION_A);
      messages.pop();
      expect(repo.getAll(SESSION_A)).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('clear() 後は全セッションの getAll() が空配列を返す', () => {
      repo.addUserMessage(SESSION_A, 'hello');
      repo.addAgentMessage(SESSION_B, 'agent-1');
      repo.clear();
      expect(repo.getAll(SESSION_A)).toEqual([]);
      expect(repo.getAll(SESSION_B)).toEqual([]);
    });
  });

  describe('セッション間のメッセージ分離', () => {
    it('異なるセッションにメッセージを追加しても互いに影響しない', () => {
      repo.addUserMessage(SESSION_A, 'hello from A');
      repo.addUserMessage(SESSION_B, 'hello from B');

      const messagesA = repo.getAll(SESSION_A);
      const messagesB = repo.getAll(SESSION_B);

      expect(messagesA).toHaveLength(1);
      expect(messagesB).toHaveLength(1);
      expect(messagesA[0]).toMatchObject({ type: 'user', text: 'hello from A' });
      expect(messagesB[0]).toMatchObject({ type: 'user', text: 'hello from B' });
    });

    it('あるセッションのエージェントメッセージ操作が他セッションに影響しない', () => {
      repo.addAgentMessage(SESSION_A, 'agent-a');
      repo.addAgentMessage(SESSION_B, 'agent-b');

      repo.appendAgentChunk(SESSION_A, 'agent-a', 'chunk A');
      repo.completeAgentMessage(SESSION_A, 'agent-a');

      const msgA = repo.getAll(SESSION_A)[0];
      const msgB = repo.getAll(SESSION_B)[0];
      assert(msgA.type === 'agent');
      assert(msgB.type === 'agent');
      expect(msgA.text).toBe('chunk A');
      expect(msgA.status).toBe('completed');
      expect(msgB.text).toBe('');
      expect(msgB.status).toBe('streaming');
    });

    it('あるセッションのツール呼び出し更新が他セッションに影響しない', () => {
      repo.addToolCall(SESSION_A, 'tool-a', 'read_file', {});
      repo.addToolCall(SESSION_B, 'tool-b', 'write_file', {});

      repo.updateToolCall(SESSION_A, 'tool-a', { status: 'completed', result: 'done' });

      const msgA = repo.getAll(SESSION_A)[0];
      const msgB = repo.getAll(SESSION_B)[0];
      assert(msgA.type === 'tool_call');
      assert(msgB.type === 'tool_call');
      expect(msgA.status).toBe('completed');
      expect(msgB.status).toBe('in_progress');
    });
  });
});
