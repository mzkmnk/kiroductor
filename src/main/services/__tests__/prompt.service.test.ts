import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { PromptService } from '../prompt.service';
import { SessionRepository } from '../../repositories/session.repository';
import { MessageRepository } from '../../repositories/message.repository';

describe('PromptService', () => {
  let sessionRepo: SessionRepository;
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
    sessionRepo = new SessionRepository();
    sessionRepo.setSessionId('test-session-id');
    messageRepo = new MessageRepository();
    connection = {
      prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    };
    service = new PromptService(
      sessionRepo,
      messageRepo,
      connection as unknown as Pick<ClientSideConnection, 'prompt'>,
    );
  });

  describe('send(text)', () => {
    it('send(text) を呼ぶと MessageRepository にユーザーメッセージが追加されること', async () => {
      await service.send('hello');
      const messages = messageRepo.getAll();
      expect(messages.some((m) => m.type === 'user' && m.text === 'hello')).toBe(true);
    });

    it('connection.prompt({ sessionId, prompt: [{ type: text, text }] }) が呼ばれること', async () => {
      await service.send('Fix the bug');
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: 'test-session-id',
        prompt: [{ type: 'text', text: 'Fix the bug' }],
      });
    });

    it('prompt() 完了後にエージェントメッセージの status が completed になること', async () => {
      await service.send('hello');
      const messages = messageRepo.getAll();
      const agentMessage = messages.find((m) => m.type === 'agent');
      expect(agentMessage).toMatchObject({ type: 'agent', status: 'completed' });
    });

    it('send() が prompt() レスポンスの stopReason を返すこと', async () => {
      connection.prompt.mockResolvedValueOnce({ stopReason: 'max_tokens' });
      const result = await service.send('hello');
      expect(result).toBe('max_tokens');
    });

    it('メッセージが正しい順番で Repository に追加されること（user → agent）', async () => {
      await service.send('hello');
      const messages = messageRepo.getAll();
      expect(messages[0]).toMatchObject({ type: 'user', text: 'hello' });
      expect(messages[1]).toMatchObject({ type: 'agent' });
    });
  });
});
