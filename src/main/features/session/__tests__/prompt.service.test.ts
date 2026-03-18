import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { PromptService } from '../prompt.service';
import { MessageRepository } from '../message.repository';

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

    it('images を渡した場合 connection.prompt() に text と image の ContentBlock が渡されること', async () => {
      const images = [{ mimeType: 'image/png', data: 'base64png' }];
      await service.send(SESSION_ID, 'Look at this', images);
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        prompt: [
          { type: 'text', text: 'Look at this' },
          { type: 'image', mimeType: 'image/png', data: 'base64png' },
        ],
      });
    });

    it('images が undefined の場合 connection.prompt() に text のみの ContentBlock が渡されること', async () => {
      await service.send(SESSION_ID, 'hello');
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        prompt: [{ type: 'text', text: 'hello' }],
      });
    });

    it('images が空配列の場合 connection.prompt() に text のみの ContentBlock が渡されること', async () => {
      await service.send(SESSION_ID, 'hello', []);
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        prompt: [{ type: 'text', text: 'hello' }],
      });
    });

    it('複数画像を渡した場合すべて ContentBlock に含まれること', async () => {
      const images = [
        { mimeType: 'image/png', data: 'png-data' },
        { mimeType: 'image/jpeg', data: 'jpeg-data' },
      ];
      await service.send(SESSION_ID, 'two images', images);
      expect(connection.prompt).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        prompt: [
          { type: 'text', text: 'two images' },
          { type: 'image', mimeType: 'image/png', data: 'png-data' },
          { type: 'image', mimeType: 'image/jpeg', data: 'jpeg-data' },
        ],
      });
    });

    it('images を渡した場合 MessageRepository に attachments が保存されること', async () => {
      const images = [{ mimeType: 'image/png', data: 'base64png' }];
      await service.send(SESSION_ID, 'hello', images);
      const messages = messageRepo.getAll(SESSION_ID);
      expect(messages[0]).toMatchObject({
        type: 'user',
        text: 'hello',
        attachments: images,
      });
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
