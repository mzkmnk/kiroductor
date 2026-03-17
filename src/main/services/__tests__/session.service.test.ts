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
      (params: { cwd: string; mcpServers: [] }) => Promise<{
        sessionId: string;
        models?: {
          currentModelId: string;
          availableModels: Array<{ modelId: string; name: string; description?: string | null }>;
        } | null;
      }>
    >;
    cancel: MockedFunction<(params: { sessionId: string }) => Promise<void>>;
    loadSession: MockedFunction<
      (params: { sessionId: string; cwd: string; mcpServers: [] }) => Promise<{
        sessionId: string;
        models?: {
          currentModelId: string;
          availableModels: Array<{ modelId: string; name: string; description?: string | null }>;
        } | null;
      }>
    >;
    unstable_setSessionModel: MockedFunction<
      (params: { sessionId: string; modelId: string }) => Promise<Record<string, never>>
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
      unstable_setSessionModel: vi.fn().mockResolvedValue({}),
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
      connection as unknown as Pick<
        ClientSideConnection,
        'newSession' | 'cancel' | 'loadSession' | 'unstable_setSessionModel'
      >,
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

    it('create() 後に sessionRepo.isAcpConnected() が true を返すこと', async () => {
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(sessionRepo.isAcpConnected('test-session-id')).toBe(true);
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

  describe('cancel(sessionId)', () => {
    it('cancel(sessionId) を呼ぶと connection.cancel({ sessionId }) が呼ばれること', async () => {
      await service.cancel('test-session-id');
      expect(connection.cancel).toHaveBeenCalledWith({ sessionId: 'test-session-id' });
    });
  });

  describe('load(sessionId, cwd)', () => {
    it('load() 時に既存メッセージが保持されること', async () => {
      messageRepo.addUserMessage('session-abc', 'existing message');

      await service.load('session-abc', '/path/to/project');

      expect(messageRepo.getAll('session-abc')).toEqual([
        expect.objectContaining({ type: 'user', text: 'existing message' }),
      ]);
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

    it('load() 後に sessionRepo.isAcpConnected() が true を返すこと', async () => {
      await service.load('session-abc', '/path/to/project');
      expect(sessionRepo.isAcpConnected('session-abc')).toBe(true);
    });
  });

  describe('create() のモデル保存', () => {
    const MODELS = {
      currentModelId: 'claude-haiku-4.5',
      availableModels: [
        { modelId: 'auto', name: 'auto', description: 'Auto' },
        { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
      ],
    };

    it('newSession レスポンスに models がある場合、sessionRepo にモデル状態が保存されること', async () => {
      connection.newSession.mockResolvedValue({ sessionId: 'test-session-id', models: MODELS });
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      const state = sessionRepo.getModelState('test-session-id');
      expect(state).toEqual(MODELS);
    });

    it('newSession レスポンスに models がない場合、モデル状態が保存されないこと', async () => {
      connection.newSession.mockResolvedValue({ sessionId: 'test-session-id' });
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      expect(() => sessionRepo.getModelState('test-session-id')).toThrow();
    });
  });

  describe('load() のモデル保存', () => {
    const MODELS = {
      currentModelId: 'claude-sonnet-4.5',
      availableModels: [
        { modelId: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5', description: 'Sonnet' },
      ],
    };

    it('loadSession レスポンスに models がある場合、sessionRepo にモデル状態が保存されること', async () => {
      connection.loadSession.mockResolvedValue({ sessionId: 'session-abc', models: MODELS });
      await service.load('session-abc', '/path/to/project');
      const state = sessionRepo.getModelState('session-abc');
      expect(state).toEqual(MODELS);
    });

    it('loadSession レスポンスに models がない場合、モデル状態が保存されないこと', async () => {
      connection.loadSession.mockResolvedValue({ sessionId: 'session-abc' });
      await service.load('session-abc', '/path/to/project');
      expect(() => sessionRepo.getModelState('session-abc')).toThrow();
    });
  });

  describe('setModel(sessionId, modelId)', () => {
    it('connection.unstable_setSessionModel() が正しいパラメータで呼ばれること', async () => {
      connection.newSession.mockResolvedValue({
        sessionId: 'test-session-id',
        models: {
          currentModelId: 'claude-haiku-4.5',
          availableModels: [
            { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
            { modelId: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5', description: 'Sonnet' },
          ],
        },
      });
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      await service.setModel('test-session-id', 'claude-sonnet-4.5');
      expect(connection.unstable_setSessionModel).toHaveBeenCalledWith({
        sessionId: 'test-session-id',
        modelId: 'claude-sonnet-4.5',
      });
    });

    it('setModel() 後に sessionRepo.getModelState() の currentModelId が更新されること', async () => {
      connection.newSession.mockResolvedValue({
        sessionId: 'test-session-id',
        models: {
          currentModelId: 'claude-haiku-4.5',
          availableModels: [
            { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
            { modelId: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5', description: 'Sonnet' },
          ],
        },
      });
      await service.create('/path/to/project', 'kiroductor/tokyo', 'main');
      await service.setModel('test-session-id', 'claude-sonnet-4.5');
      expect(sessionRepo.getModelState('test-session-id').currentModelId).toBe('claude-sonnet-4.5');
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

    it('restoreSessions() で復元されたセッションは isAcpConnected() が false であること', async () => {
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
      ];
      configRepo.readSessions.mockResolvedValue(sessions);

      await service.restoreSessions();

      expect(sessionRepo.isAcpConnected('session-1')).toBe(false);
    });
  });
});
