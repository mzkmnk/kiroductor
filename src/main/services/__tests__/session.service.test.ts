import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { SessionService } from '../session.service';
import { SessionRepository } from '../../repositories/session.repository';
import { MessageRepository } from '../../repositories/message.repository';
import type { NotificationService } from '../../interfaces/notification.service';

describe('SessionService', () => {
  let sessionRepo: SessionRepository;
  let messageRepo: MessageRepository;
  let connection: {
    newSession: MockedFunction<
      (params: { cwd: string; mcpServers: [] }) => Promise<{ sessionId: string }>
    >;
    cancel: MockedFunction<(params: { sessionId: string }) => Promise<void>>;
    loadSession: MockedFunction<
      (params: { sessionId: string; cwd: string; mcpServers: [] }) => Promise<{ sessionId: string }>
    >;
  };
  let notificationService: {
    sendToRenderer: MockedFunction<NotificationService['sendToRenderer']>;
  };
  let service: SessionService;

  beforeEach(() => {
    sessionRepo = new SessionRepository();
    messageRepo = new MessageRepository();
    connection = {
      newSession: vi.fn().mockResolvedValue({ sessionId: 'test-session-id' }),
      cancel: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue({ sessionId: 'loaded-session-id' }),
    };
    notificationService = {
      sendToRenderer: vi.fn(),
    };
    service = new SessionService(
      sessionRepo,
      messageRepo,
      connection as unknown as Pick<ClientSideConnection, 'newSession' | 'cancel' | 'loadSession'>,
      notificationService as unknown as NotificationService,
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

    it('create() 後に sessionRepo.addSession() でセッションが追加されること', async () => {
      await service.create('/path/to/project');
      expect(sessionRepo.getAllSessionIds()).toContain('test-session-id');
    });

    it('create() 後に messageRepo.initSession() でセッションが初期化されること', async () => {
      await service.create('/path/to/project');
      expect(messageRepo.getAll('test-session-id')).toEqual([]);
    });

    it('create() 後に sessionRepo.setActiveSession() でアクティブセッションが設定されること', async () => {
      await service.create('/path/to/project');
      expect(sessionRepo.getActiveSessionId()).toBe('test-session-id');
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

  describe('load(sessionId, cwd)', () => {
    it('load() 前に対象セッションの messageRepo がクリアされること', async () => {
      messageRepo.addUserMessage('session-abc', 'existing message');
      let clearedBeforeLoad = false;
      connection.loadSession.mockImplementation(async () => {
        clearedBeforeLoad = messageRepo.getAll('session-abc').length === 0;
        return { sessionId: 'loaded-session-id' };
      });

      await service.load('session-abc', '/path/to/project');

      expect(clearedBeforeLoad).toBe(true);
    });

    it('connection.loadSession() に正しいパラメータが渡されること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(connection.loadSession).toHaveBeenCalledWith({
        sessionId: 'session-abc',
        cwd: '/path/to/project',
        mcpServers: [],
      });
    });

    it('load() 完了後に sessionRepo のセッション ID が更新されること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(sessionRepo.getSessionId()).toBe('session-abc');
    });

    it('load() 後に sessionRepo.addSession() でセッションが追加されること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(sessionRepo.getAllSessionIds()).toContain('session-abc');
    });

    it('load() 後に sessionRepo.setActiveSession() でアクティブセッションが設定されること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(sessionRepo.getActiveSessionId()).toBe('session-abc');
    });

    it('load() 開始時に sessionRepo.isLoading が true になること', async () => {
      let isLoadingDuringLoad = false;
      connection.loadSession.mockImplementation(async () => {
        isLoadingDuringLoad = sessionRepo.getIsLoading();
        return { sessionId: 'loaded-session-id' };
      });

      await service.load('session-abc', '/path/to/project');

      expect(isLoadingDuringLoad).toBe(true);
    });

    it('load() 完了後に sessionRepo.isLoading が false になること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(sessionRepo.getIsLoading()).toBe(false);
    });

    it('load() 開始時に acp:session-loading { loading: true } を通知すること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:session-loading', {
        loading: true,
      });
    });

    it('load() 完了後に acp:session-loading { loading: false } を通知すること', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:session-loading', {
        loading: false,
      });
    });
  });
});
