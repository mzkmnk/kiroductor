import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { SessionService } from '../session.service';

vi.mock('../session-title.generator', () => ({
  generateSessionTitle: vi.fn().mockReturnValue('Kyoto'),
}));
import { SessionRepository } from '../../repositories/session.repository';
import { MessageRepository } from '../../repositories/message.repository';
import type { ConfigRepository } from '../../repositories/config.repository';
import type { SessionMapping } from '../../repositories/config.repository';
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
  let configRepo: {
    upsertSession: MockedFunction<(mapping: SessionMapping) => Promise<void>>;
    readSessions: MockedFunction<() => Promise<SessionMapping[]>>;
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
    configRepo = {
      upsertSession: vi.fn().mockResolvedValue(undefined),
      readSessions: vi.fn().mockResolvedValue([]),
    };
    service = new SessionService(
      sessionRepo,
      messageRepo,
      connection as unknown as Pick<ClientSideConnection, 'newSession' | 'cancel' | 'loadSession'>,
      notificationService as unknown as NotificationService,
      configRepo as unknown as Pick<ConfigRepository, 'upsertSession' | 'readSessions'>,
    );
  });

  describe('create(cwd, currentBranch, sourceBranch)', () => {
    it('create() を呼ぶと connection.newSession({ cwd, mcpServers: [] }) が呼ばれること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(connection.newSession).toHaveBeenCalledWith({
        cwd: '/path/to/project',
        mcpServers: [],
      });
    });

    it('newSession() が返した sessionId が SessionRepository に保存されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(sessionRepo.getActiveSessionId()).toBe('test-session-id');
    });

    it('create() 後に sessionRepo.addSession() でセッションが追加されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(sessionRepo.getAllSessionIds()).toContain('test-session-id');
    });

    it('create() 後に messageRepo.initSession() でセッションが初期化されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(messageRepo.getAll('test-session-id')).toEqual([]);
    });

    it('create() 後に sessionRepo.setActiveSession() でアクティブセッションが設定されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(sessionRepo.getActiveSessionId()).toBe('test-session-id');
    });

    it('create() 後に configRepo.upsertSession() でセッション情報が永続化されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(configRepo.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          acpSessionId: 'test-session-id',
          cwd: '/path/to/project',
          repoId: '',
          title: 'Kyoto',
          currentBranch: 'kiroductor/tokyo',
          sourceBranch: 'main',
        }),
      );
    });

    it('create() で指定した currentBranch と sourceBranch が永続化されること', async () => {
      await service.create('/path/to/project', 'kiroductor/bourbon', 'feature/my-feature');
      expect(configRepo.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBranch: 'kiroductor/bourbon',
          sourceBranch: 'feature/my-feature',
        }),
      );
    });

    it('create(cwd, currentBranch, sourceBranch, repoId) で指定した repoId が永続化されること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main', 'repo-123');
      expect(configRepo.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          acpSessionId: 'test-session-id',
          repoId: 'repo-123',
        }),
      );
    });
  });

  describe('cancel()', () => {
    it('cancel() を呼ぶと connection.cancel({ sessionId }) が呼ばれること', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
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
      expect(sessionRepo.getActiveSessionId()).toBe('session-abc');
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

  describe('restoreSessions()', () => {
    it('configRepo.readSessions() で取得したセッションが sessionRepo に復元されること', async () => {
      const sessions: SessionMapping[] = [
        {
          acpSessionId: 'session-1',
          repoId: 'repo-1',
          cwd: '/path/1',
          title: null,
          currentBranch: 'kiroductor/tokyo',
          sourceBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          acpSessionId: 'session-2',
          repoId: 'repo-2',
          cwd: '/path/2',
          title: 'My Session',
          currentBranch: 'kiroductor/bourbon',
          sourceBranch: 'feature/test',
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ];
      configRepo.readSessions.mockResolvedValue(sessions);

      await service.restoreSessions();

      expect(sessionRepo.getAllSessionIds()).toEqual(['session-1', 'session-2']);
    });
  });
});
