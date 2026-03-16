import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { SessionHandler } from '../session.handler';
import type { NotificationService } from '../../interfaces/notification.service';
import { SessionService } from '../../services/session.service';
import { PromptService } from '../../services/prompt.service';
import { MessageRepository } from '../../repositories/message.repository';
import { SessionRepository } from '../../repositories/session.repository';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('SessionHandler', () => {
  const SESSION_ID = 'test-session-id';

  let messageRepo: MessageRepository;
  let sessionRepo: SessionRepository;
  let sessionService: {
    create: MockedFunction<
      (cwd: string, currentBranch: string, sourceBranch: string) => Promise<void>
    >;
    cancel: MockedFunction<(sessionId: string) => Promise<void>>;
    load: MockedFunction<(sessionId: string, cwd: string) => Promise<void>>;
  };
  let promptService: {
    send: MockedFunction<(sessionId: string, text: string) => Promise<string>>;
  };
  let notificationService: {
    sendToRenderer: MockedFunction<NotificationService['sendToRenderer']>;
  };
  let configRepo: {
    readSessions: MockedFunction<() => Promise<[]>>;
  };
  let handler: SessionHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    messageRepo = new MessageRepository();
    sessionRepo = new SessionRepository();
    sessionRepo.addSession(SESSION_ID);
    sessionRepo.setActiveSession(SESSION_ID);
    sessionService = {
      create: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
    };
    promptService = {
      send: vi.fn().mockResolvedValue('end_turn'),
    };
    notificationService = {
      sendToRenderer: vi.fn(),
    };
    configRepo = {
      readSessions: vi.fn().mockResolvedValue([]),
    };
    handler = new SessionHandler(
      sessionService as unknown as SessionService,
      promptService as unknown as PromptService,
      messageRepo,
      sessionRepo,
      notificationService,
      configRepo,
    );
  });

  describe('register()', () => {
    it('全チャンネルを登録する', () => {
      handler.register();

      const channels = ipcHandle.mock.calls.map((call) => call[0] as string);
      expect(channels).toContain('session:new');
      expect(channels).toContain('session:load');
      expect(channels).toContain('session:prompt');
      expect(channels).toContain('session:cancel');
      expect(channels).toContain('session:messages');
      expect(channels).toContain('session:switch');
      expect(channels).toContain('session:active');
      expect(channels).toContain('session:all');
      expect(channels).toContain('session:processing-sessions');
    });

    describe('session:new', () => {
      it('受け取った cwd, currentBranch, sourceBranch を引数として sessionService.create() を呼ぶ', async () => {
        handler.register();
        const newHandler = ipcHandle.mock.calls.find((call) => call[0] === 'session:new')?.[1] as (
          _event: unknown,
          cwd: string,
          currentBranch: string,
          sourceBranch: string,
        ) => Promise<void>;

        await newHandler(null, '/workspace/myproject', 'kiroductor/tokyo', 'main');

        expect(sessionService.create).toHaveBeenCalledWith(
          '/workspace/myproject',
          'kiroductor/tokyo',
          'main',
        );
      });
    });

    describe('session:load', () => {
      it('受け取った sessionId と cwd を引数として sessionService.load() を呼ぶ', async () => {
        handler.register();
        const loadHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:load',
        )?.[1] as (_event: unknown, sessionId: string, cwd: string) => Promise<void>;

        await loadHandler(null, 'session-abc', '/workspace/myproject');

        expect(sessionService.load).toHaveBeenCalledWith('session-abc', '/workspace/myproject');
      });
    });

    describe('session:prompt', () => {
      it('sessionId 省略時はアクティブセッションで promptService.send() を呼ぶ', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string | undefined,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, undefined, 'hello');

        expect(promptService.send).toHaveBeenCalledWith(SESSION_ID, 'hello');
      });

      it('sessionId を指定すると、そのセッションで promptService.send() を呼ぶ', async () => {
        const OTHER_SESSION_ID = 'other-session-id';
        sessionRepo.addSession(OTHER_SESSION_ID);
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string | undefined,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, OTHER_SESSION_ID, 'hello');

        expect(promptService.send).toHaveBeenCalledWith(OTHER_SESSION_ID, 'hello');
      });

      it('prompt 実行中は sessionRepo.isProcessing() が true を返す', async () => {
        let isProcessingDuringPrompt = false;
        promptService.send.mockImplementation(async () => {
          isProcessingDuringPrompt = sessionRepo.isProcessing(SESSION_ID);
          return 'end_turn';
        });
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string | undefined,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, undefined, 'hello');

        expect(isProcessingDuringPrompt).toBe(true);
        expect(sessionRepo.isProcessing(SESSION_ID)).toBe(false);
      });

      it('prompt 完了後に acp:prompt-completed 通知を送信する', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string | undefined,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, undefined, 'hello');

        expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:prompt-completed', {
          sessionId: SESSION_ID,
        });
      });
    });

    describe('session:cancel', () => {
      it('sessionId 省略時はアクティブセッションで cancel を実行する', async () => {
        handler.register();
        const cancelHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:cancel',
        )?.[1] as (_event: unknown, sessionId?: string) => Promise<void>;

        await cancelHandler(null);

        expect(sessionService.cancel).toHaveBeenCalledWith(SESSION_ID);
      });

      it('sessionId を指定するとそのセッションで cancel を実行する', async () => {
        const OTHER_SESSION_ID = 'other-session-id';
        handler.register();
        const cancelHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:cancel',
        )?.[1] as (_event: unknown, sessionId?: string) => Promise<void>;

        await cancelHandler(null, OTHER_SESSION_ID);

        expect(sessionService.cancel).toHaveBeenCalledWith(OTHER_SESSION_ID);
      });
    });

    describe('session:messages', () => {
      it('アクティブセッションの messageRepository.getAll(sessionId) の結果を返す', async () => {
        messageRepo.addUserMessage(SESSION_ID, 'test message');
        handler.register();
        const messagesHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:messages',
        )?.[1] as (_event: unknown, sessionId?: string) => Promise<unknown>;

        const result = await messagesHandler(null);

        expect(result).toEqual([expect.objectContaining({ type: 'user', text: 'test message' })]);
      });

      it('セッション ID を指定した場合、そのセッションのメッセージを返す', async () => {
        const OTHER_SESSION_ID = 'other-session-id';
        sessionRepo.addSession(OTHER_SESSION_ID);
        messageRepo.addUserMessage(OTHER_SESSION_ID, 'other message');
        handler.register();
        const messagesHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:messages',
        )?.[1] as (_event: unknown, sessionId?: string) => Promise<unknown>;

        const result = await messagesHandler(null, OTHER_SESSION_ID);

        expect(result).toEqual([expect.objectContaining({ type: 'user', text: 'other message' })]);
      });
    });

    describe('session:switch', () => {
      it('sessionRepo.setActiveSession() を呼び、レンダラーに通知を送る', () => {
        const OTHER_SESSION_ID = 'other-session-id';
        sessionRepo.addSession(OTHER_SESSION_ID);
        handler.register();
        const switchHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:switch',
        )?.[1] as (_event: unknown, sessionId: string) => void;

        switchHandler(null, OTHER_SESSION_ID);

        expect(sessionRepo.getActiveSessionId()).toBe(OTHER_SESSION_ID);
        expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:session-switched', {
          sessionId: OTHER_SESSION_ID,
        });
      });

      it('存在しないセッション ID を指定した場合、エラーが投げられる', () => {
        handler.register();
        const switchHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:switch',
        )?.[1] as (_event: unknown, sessionId: string) => void;

        expect(() => switchHandler(null, 'nonexistent')).toThrow();
      });
    });

    describe('session:active', () => {
      it('現在のアクティブセッション ID を返す', () => {
        handler.register();
        const activeHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:active',
        )?.[1] as () => string | null;

        const result = activeHandler();

        expect(result).toBe(SESSION_ID);
      });

      it('アクティブセッションがない場合、null を返す', () => {
        sessionRepo.removeSession(SESSION_ID);
        handler.register();
        const activeHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:active',
        )?.[1] as () => string | null;

        const result = activeHandler();

        expect(result).toBeNull();
      });
    });

    describe('session:all', () => {
      it('管理中の全セッション ID を返す', () => {
        const OTHER_SESSION_ID = 'other-session-id';
        sessionRepo.addSession(OTHER_SESSION_ID);
        handler.register();
        const allHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:all',
        )?.[1] as () => string[];

        const result = allHandler();

        expect(result).toEqual([SESSION_ID, OTHER_SESSION_ID]);
      });
    });

    describe('session:list', () => {
      it('configRepo.readSessions() の結果を返す', async () => {
        handler.register();
        const listHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:list',
        )?.[1] as () => Promise<unknown>;

        await listHandler();

        expect(configRepo.readSessions).toHaveBeenCalledOnce();
      });
    });
  });
});
