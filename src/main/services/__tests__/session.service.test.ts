import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { SessionService } from '../session.service';
import { SessionRepository } from '../../repositories/session.repository';
import { MessageRepository } from '../../repositories/message.repository';

describe('SessionService', () => {
  let sessionRepo: SessionRepository;
  let messageRepo: MessageRepository;
  let connection: {
    newSession: MockedFunction<
      (params: { cwd: string; mcpServers: [] }) => Promise<{ sessionId: string }>
    >;
    cancel: MockedFunction<(params: { sessionId: string }) => Promise<void>>;
  };
  let service: SessionService;

  beforeEach(() => {
    sessionRepo = new SessionRepository();
    messageRepo = new MessageRepository();
    connection = {
      newSession: vi.fn().mockResolvedValue({ sessionId: 'test-session-id' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    service = new SessionService(
      sessionRepo,
      messageRepo,
      connection as unknown as Pick<ClientSideConnection, 'newSession' | 'cancel'>,
    );
  });

  describe('create(cwd)', () => {
    it('create(cwd) を呼ぶと connection.newSession({ cwd, mcpServers: [] }) が呼ばれること', async () => {
      await service.create('/path/to/project');
      expect(connection.newSession).toHaveBeenCalledWith({
        cwd: '/path/to/project',
        mcpServers: [],
      });
    });

    it('newSession() が返した sessionId が SessionRepository に保存されること', async () => {
      await service.create('/path/to/project');
      expect(sessionRepo.getSessionId()).toBe('test-session-id');
    });

    it('create() 後に MessageRepository がクリアされること', async () => {
      messageRepo.addUserMessage('existing message');
      await service.create('/path/to/project');
      expect(messageRepo.getAll()).toHaveLength(0);
    });
  });

  describe('cancel()', () => {
    it('cancel() を呼ぶと connection.cancel({ sessionId }) が呼ばれること', async () => {
      await service.create('/path/to/project');
      await service.cancel();
      expect(connection.cancel).toHaveBeenCalledWith({ sessionId: 'test-session-id' });
    });

    it('アクティブなセッションがない場合、cancel() は何もしない（エラーを投げない）こと', async () => {
      await expect(service.cancel()).resolves.not.toThrow();
      expect(connection.cancel).not.toHaveBeenCalled();
    });
  });
});
