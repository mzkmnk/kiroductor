import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRepository } from '../message.repository';
import type { AgentMessage, ToolCallMessage } from '../message.repository';

describe('MessageRepository', () => {
  let repo: MessageRepository;

  beforeEach(() => {
    repo = new MessageRepository();
  });

  describe('初期状態', () => {
    it('getAll は空配列を返す', () => {
      expect(repo.getAll()).toEqual([]);
    });
  });

  describe('addUserMessage', () => {
    it('addUserMessage("hello") を呼ぶと type: "user", text: "hello" のメッセージが getAll() で取得できる', () => {
      repo.addUserMessage('hello');
      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ type: 'user', text: 'hello' });
    });

    it('追加されたメッセージに一意な id が付与される', () => {
      const m1 = repo.addUserMessage('first');
      const m2 = repo.addUserMessage('second');
      expect(m1.id).toBeTruthy();
      expect(m2.id).toBeTruthy();
      expect(m1.id).not.toBe(m2.id);
    });
  });

  describe('addAgentMessage', () => {
    it('addAgentMessage("agent-1") を呼ぶと type: "agent", status: "streaming", text: "" のメッセージが追加される', () => {
      repo.addAgentMessage('agent-1');
      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ id: 'agent-1', type: 'agent', text: '', status: 'streaming' });
    });
  });

  describe('appendAgentChunk', () => {
    it('appendAgentChunk(id, chunk) を複数回呼ぶとテキストが順番に連結される', () => {
      repo.addAgentMessage('agent-1');
      repo.appendAgentChunk('agent-1', 'Hello');
      repo.appendAgentChunk('agent-1', ' ');
      repo.appendAgentChunk('agent-1', 'World');
      const messages = repo.getAll();
      expect((messages[0] as AgentMessage).text).toBe('Hello World');
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addAgentMessage('agent-1');
      repo.appendAgentChunk('unknown-id', 'chunk');
      expect((repo.getAll()[0] as AgentMessage).text).toBe('');
    });
  });

  describe('completeAgentMessage', () => {
    it('completeAgentMessage(id) を呼ぶと対象メッセージの status が "completed" になる', () => {
      repo.addAgentMessage('agent-1');
      repo.appendAgentChunk('agent-1', 'response text');
      repo.completeAgentMessage('agent-1');
      const messages = repo.getAll();
      expect((messages[0] as AgentMessage).status).toBe('completed');
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addAgentMessage('agent-1');
      repo.completeAgentMessage('unknown-id');
      expect((repo.getAll()[0] as AgentMessage).status).toBe('streaming');
    });
  });

  describe('addToolCall', () => {
    it('addToolCall(id, name, input) を呼ぶと type: "tool_call", status: "running" のメッセージが追加される', () => {
      repo.addToolCall('tool-1', 'read_file', { path: '/tmp/foo.txt' });
      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'tool-1',
        type: 'tool_call',
        name: 'read_file',
        input: { path: '/tmp/foo.txt' },
        status: 'running',
      });
    });
  });

  describe('updateToolCall', () => {
    it('updateToolCall(id, { status: "completed", result: "..." }) でステータスと結果が更新される', () => {
      repo.addToolCall('tool-1', 'read_file', { path: '/tmp/foo.txt' });
      repo.updateToolCall('tool-1', { status: 'completed', result: 'file content here' });
      const messages = repo.getAll();
      expect(messages[0]).toMatchObject({ status: 'completed', result: 'file content here' });
    });

    it('存在しない id に対しては何も起きない', () => {
      repo.addToolCall('tool-1', 'read_file', {});
      repo.updateToolCall('unknown-id', { status: 'completed' });
      expect((repo.getAll()[0] as ToolCallMessage).status).toBe('running');
    });
  });

  describe('getAll', () => {
    it('追加順にすべてのメッセージが返される', () => {
      repo.addUserMessage('hello');
      repo.addAgentMessage('agent-1');
      repo.addToolCall('tool-1', 'search', {});
      const messages = repo.getAll();
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('agent');
      expect(messages[2].type).toBe('tool_call');
    });

    it('返り値の配列を変更しても内部状態に影響しない', () => {
      repo.addUserMessage('hello');
      const messages = repo.getAll();
      messages.pop();
      expect(repo.getAll()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('clear() 後は getAll() が空配列を返す', () => {
      repo.addUserMessage('hello');
      repo.addAgentMessage('agent-1');
      repo.addToolCall('tool-1', 'search', {});
      repo.clear();
      expect(repo.getAll()).toEqual([]);
    });
  });
});
