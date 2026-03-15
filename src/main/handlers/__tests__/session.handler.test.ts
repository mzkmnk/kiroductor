import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { SessionHandler } from '../session.handler';
import type { NotificationService } from '../../services/notification.service';
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
    create: MockedFunction<(cwd: string) => Promise<void>>;
    cancel: MockedFunction<() => Promise<void>>;
    load: MockedFunction<(sessionId: string, cwd: string) => Promise<void>>;
  };
  let promptService: {
    send: MockedFunction<(sessionId: string, text: string) => Promise<string>>;
  };
  let notificationService: {
    sendToRenderer: MockedFunction<NotificationService['sendToRenderer']>;
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
    handler = new SessionHandler(
      sessionService as unknown as SessionService,
      promptService as unknown as PromptService,
      messageRepo,
      sessionRepo,
      notificationService,
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
    });

    describe('session:new', () => {
      it('受け取った cwd を引数として sessionService.create() を呼ぶ', async () => {
        handler.register();
        const newHandler = ipcHandle.mock.calls.find((call) => call[0] === 'session:new')?.[1] as (
          _event: unknown,
          cwd: string,
        ) => Promise<void>;

        await newHandler(null, '/workspace/myproject');

        expect(sessionService.create).toHaveBeenCalledWith('/workspace/myproject');
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
      it('受け取った text を引数として promptService.send() を呼ぶ', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (_event: unknown, text: string) => Promise<string>;

        await promptHandler(null, 'hello');

        expect(promptService.send).toHaveBeenCalledWith(SESSION_ID, 'hello');
      });
    });

    describe('session:cancel', () => {
      it('呼ばれたら sessionService.cancel() を実行する', async () => {
        handler.register();
        const cancelHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:cancel',
        )?.[1] as () => Promise<void>;

        await cancelHandler();

        expect(sessionService.cancel).toHaveBeenCalledOnce();
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
  });
});
