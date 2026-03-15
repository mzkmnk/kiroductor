import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { PromptService } from '../prompt.service';
import { MessageRepository } from '../../repositories/message.repository';

describe('PromptService', () => {
  const SESSION_ID = 'test-session-id';

  let messageRepo: MessageRepository;
  let connection: {
    prompt: MockedFunction<
      (params: {
        sessionId: string;
        prompt: Array<{ type: string; text: string }>;
      }) => Promise<{ stopReason: string }>
    >;
  };
  let service: PromptService;

  beforeEach(() => {
    messageRepo = new MessageRepository();
    connection = {
      prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    };
    service = new PromptService(
      messageRepo,
      connection as unknown as Pick<ClientSideConnection, 'prompt'>,
    );
  });

  describe('send(sessionId, text)', () => {
    it('指定されたセッションのメッセージにユーザーメッセージが追加されること', async () => {
      await service.send(SESSION_ID, 'hello');
      const messages = messageRepo.getAll(SESSION_ID);
      expect(messages.some((m) => m.type === 'user' && m.text === 'hello')).toBe(true);
    });

    it('connection.prompt() に正しい sessionId が渡されること', async () => {
      await service.send(SESSION_ID, 'Fix the bug');
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        prompt: [{ type: 'text', text: 'Fix the bug' }],
      });
    });

    it('prompt() 完了後にエージェントメッセージの status が completed になること', async () => {
      await service.send(SESSION_ID, 'hello');
      const messages = messageRepo.getAll(SESSION_ID);
      const agentMessage = messages.find((m) => m.type === 'agent');
      expect(agentMessage).toMatchObject({ type: 'agent', status: 'completed' });
    });

    it('send() が prompt() レスポンスの stopReason を返すこと', async () => {
      connection.prompt.mockResolvedValueOnce({ stopReason: 'max_tokens' });
      const result = await service.send(SESSION_ID, 'hello');
      expect(result).toBe('max_tokens');
    });

    it('メッセージが正しい順番で Repository に追加されること（user → agent）', async () => {
      await service.send(SESSION_ID, 'hello');
      const messages = messageRepo.getAll(SESSION_ID);
      expect(messages[0]).toMatchObject({ type: 'user', text: 'hello' });
      expect(messages[1]).toMatchObject({ type: 'agent' });
    });

    it('異なるセッション ID を指定した場合、そのセッションのメッセージに追加されること', async () => {
      const otherSessionId = 'other-session-id';
      await service.send(SESSION_ID, 'hello');
      await service.send(otherSessionId, 'world');

      const messages1 = messageRepo.getAll(SESSION_ID);
      const messages2 = messageRepo.getAll(otherSessionId);

      expect(messages1.some((m) => m.type === 'user' && m.text === 'hello')).toBe(true);
      expect(messages1.some((m) => m.type === 'user' && m.text === 'world')).toBe(false);
      expect(messages2.some((m) => m.type === 'user' && m.text === 'world')).toBe(true);
    });
  });
});
