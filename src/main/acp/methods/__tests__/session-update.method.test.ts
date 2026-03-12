import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { SessionUpdateMethod } from '../session-update.method';
import { MessageRepository } from '../../../repositories/message.repository';
import type { SessionNotification } from '@agentclientprotocol/sdk/dist/schema/index';

describe('SessionUpdateMethod', () => {
  const makeNotificationService = () => ({
    sendToRenderer: vi.fn(),
  });

  const makeAgentMessageChunkParams = (text: string): SessionNotification => ({
    sessionId: 'session-1',
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    },
  });

  const makeToolCallParams = (
    toolCallId: string,
    title: string,
    rawInput?: unknown,
  ): SessionNotification => ({
    sessionId: 'session-1',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId,
      title,
      rawInput,
      status: 'in_progress',
    },
  });

  const makeToolCallUpdateParams = (
    toolCallId: string,
    status: 'in_progress' | 'completed' | 'failed',
    rawOutput?: unknown,
  ): SessionNotification => ({
    sessionId: 'session-1',
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status,
      rawOutput,
    },
  });

  let repo: MessageRepository;
  let notificationService: ReturnType<typeof makeNotificationService>;
  let method: SessionUpdateMethod;

  beforeEach(() => {
    repo = new MessageRepository();
    notificationService = makeNotificationService();
    method = new SessionUpdateMethod(repo, notificationService);
  });

  describe('agent_message_chunk', () => {
    it('streaming 中のエージェントメッセージに appendAgentChunk が呼ばれること', async () => {
      const agentMsg = repo.addAgentMessage('msg-1');

      await method.handle(makeAgentMessageChunkParams('Hello'));

      const messages = repo.getAll();
      const updated = messages.find((m) => m.id === agentMsg.id && m.type === 'agent');
      expect(updated?.type === 'agent' && updated.text).toBe('Hello');
    });

    it('notificationService.sendToRenderer が呼ばれること', async () => {
      repo.addAgentMessage('msg-1');

      await method.handle(makeAgentMessageChunkParams('Hello'));

      expect(notificationService.sendToRenderer).toHaveBeenCalled();
    });

    it('streaming 中のエージェントメッセージが存在しない場合、randomUUID で addAgentMessage を呼んでから appendAgentChunk すること', async () => {
      await method.handle(makeAgentMessageChunkParams('Fallback'));

      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('agent');
      expect(messages[0].type === 'agent' && messages[0].text).toBe('Fallback');
    });
  });

  describe('tool_call', () => {
    it('同じ toolCallId が存在しない場合、addToolCall が呼ばれること', async () => {
      await method.handle(makeToolCallParams('tc-1', 'Read file', { path: '/foo' }));

      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      const msg = messages[0];
      assert(msg.type === 'tool_call');
      expect(msg.id).toBe('tc-1');
      expect(msg.name).toBe('Read file');
      expect(msg.input).toEqual({ path: '/foo' });
    });

    it('同じ toolCallId が既に存在する場合、updateToolCall が呼ばれること（重複追加しない）', async () => {
      repo.addToolCall('tc-1', 'Read file', undefined);

      await method.handle(makeToolCallParams('tc-1', 'Read file updated', { path: '/bar' }));

      const messages = repo.getAll();
      expect(messages).toHaveLength(1);
      const msg = messages[0];
      assert(msg.type === 'tool_call');
      expect(msg.name).toBe('Read file updated');
      expect(msg.input).toEqual({ path: '/bar' });
    });

    it('notificationService.sendToRenderer が呼ばれること', async () => {
      await method.handle(makeToolCallParams('tc-1', 'Read file'));

      expect(notificationService.sendToRenderer).toHaveBeenCalled();
    });
  });

  describe('tool_call_update', () => {
    it('updateToolCall(toolCallId, { status, result: JSON.stringify(rawOutput) }) が呼ばれること', async () => {
      repo.addToolCall('tc-1', 'Read file', undefined);

      await method.handle(makeToolCallUpdateParams('tc-1', 'completed', { data: 'result' }));

      const messages = repo.getAll();
      const msg = messages[0];
      assert(msg.type === 'tool_call');
      expect(msg.status).toBe('completed');
      expect(msg.result).toBe(JSON.stringify({ data: 'result' }));
    });

    it('rawOutput が undefined の場合、result は更新されないこと', async () => {
      repo.addToolCall('tc-1', 'Read file', undefined);

      await method.handle(makeToolCallUpdateParams('tc-1', 'completed', undefined));

      const messages = repo.getAll();
      const msg = messages[0];
      assert(msg.type === 'tool_call');
      expect(msg.status).toBe('completed');
      expect(msg.result).toBeUndefined();
    });

    it('notificationService.sendToRenderer が呼ばれること', async () => {
      repo.addToolCall('tc-1', 'Read file', undefined);

      await method.handle(makeToolCallUpdateParams('tc-1', 'completed'));

      expect(notificationService.sendToRenderer).toHaveBeenCalled();
    });
  });

  describe('その他のイベント（フォールスルー）', () => {
    it('tool_call / tool_call_update / agent_message_chunk 以外では sendToRenderer のみ呼ばれ、repo への操作が行われないこと', async () => {
      const params: SessionNotification = {
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'usage_update',
          size: 100,
          used: 50,
        },
      };

      await method.handle(params);

      expect(notificationService.sendToRenderer).toHaveBeenCalled();
      expect(repo.getAll()).toHaveLength(0);
    });
  });
});
