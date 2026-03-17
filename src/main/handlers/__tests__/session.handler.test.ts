import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { SessionModelState } from '@agentclientprotocol/sdk/dist/schema/index';
import { SessionHandler } from '../session.handler';
import type { NotificationService } from '../../interfaces/notification.service';
import type { SessionService } from '../../services/session.service';
import type { PromptService } from '../../services/prompt.service';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('SessionHandler', () => {
  const SESSION_ID = 'test-session-id';

  let sessionService: {
    create: MockedFunction<
      (cwd: string, currentBranch: string, sourceBranch: string) => Promise<void>
    >;
    cancel: MockedFunction<(sessionId: string) => Promise<void>>;
    load: MockedFunction<(sessionId: string, cwd: string) => Promise<void>>;
    setModel: MockedFunction<(sessionId: string, modelId: string) => Promise<void>>;
    getModelState: MockedFunction<(sessionId: string) => unknown>;
    getMessages: MockedFunction<(sessionId: string) => unknown[]>;
    switchSession: MockedFunction<(sessionId: string) => void>;
    getActiveSessionId: MockedFunction<() => string | null>;
    getAllSessionIds: MockedFunction<() => string[]>;
    listSessions: MockedFunction<() => Promise<unknown[]>>;
    getProcessingSessionIds: MockedFunction<() => string[]>;
    isAcpConnected: MockedFunction<(sessionId: string) => boolean>;
    addProcessing: MockedFunction<(sessionId: string) => void>;
    removeProcessing: MockedFunction<(sessionId: string) => void>;
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
    sessionService = {
      create: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      setModel: vi.fn().mockResolvedValue(undefined),
      getModelState: vi.fn(),
      getMessages: vi.fn().mockReturnValue([]),
      switchSession: vi.fn(),
      getActiveSessionId: vi.fn().mockReturnValue(SESSION_ID),
      getAllSessionIds: vi.fn().mockReturnValue([SESSION_ID]),
      listSessions: vi.fn().mockResolvedValue([]),
      getProcessingSessionIds: vi.fn().mockReturnValue([]),
      isAcpConnected: vi.fn().mockReturnValue(false),
      addProcessing: vi.fn(),
      removeProcessing: vi.fn(),
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
      expect(channels).toContain('session:all');
      expect(channels).toContain('session:processing-sessions');
      expect(channels).toContain('session:is-acp-connected');
      expect(channels).toContain('session:get-models');
      expect(channels).toContain('session:set-model');
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
      it('指定した sessionId で promptService.send() を呼ぶ', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, SESSION_ID, 'hello');

        expect(promptService.send).toHaveBeenCalledWith(SESSION_ID, 'hello');
      });

      it('prompt 実行前に sessionService.addProcessing() が呼ばれ、完了後に removeProcessing() が呼ばれる', async () => {
        let addedBeforeSend = false;
        promptService.send.mockImplementation(async () => {
          addedBeforeSend = sessionService.addProcessing.mock.calls.length > 0;
          return 'end_turn';
        });
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, SESSION_ID, 'hello');

        expect(addedBeforeSend).toBe(true);
        expect(sessionService.addProcessing).toHaveBeenCalledWith(SESSION_ID);
        expect(sessionService.removeProcessing).toHaveBeenCalledWith(SESSION_ID);
      });

      it('prompt 完了後に acp:prompt-completed 通知を送信する', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (
          _event: unknown,
          sessionId: string,
          text: string,
        ) => Promise<{ stopReason: string }>;

        await promptHandler(null, SESSION_ID, 'hello');

        expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:prompt-completed', {
          sessionId: SESSION_ID,
        });
      });
    });

    describe('session:cancel', () => {
      it('指定した sessionId で cancel を実行する', async () => {
        handler.register();
        const cancelHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:cancel',
        )?.[1] as (_event: unknown, sessionId: string) => Promise<void>;

        await cancelHandler(null, SESSION_ID);

        expect(sessionService.cancel).toHaveBeenCalledWith(SESSION_ID);
      });
    });

    describe('session:messages', () => {
      it('sessionService.getMessages() の結果を返す', () => {
        const messages = [{ type: 'user', text: 'test message' }];
        sessionService.getMessages.mockReturnValue(messages);
        handler.register();
        const messagesHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:messages',
        )?.[1] as (_event: unknown, sessionId: string) => unknown;

        const result = messagesHandler(null, SESSION_ID);

        expect(result).toEqual(messages);
        expect(sessionService.getMessages).toHaveBeenCalledWith(SESSION_ID);
      });
    });

    describe('session:switch', () => {
      it('sessionService.switchSession() を呼び、レンダラーに通知を送る', () => {
        const OTHER_SESSION_ID = 'other-session-id';
        handler.register();
        const switchHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:switch',
        )?.[1] as (_event: unknown, sessionId: string) => void;

        switchHandler(null, OTHER_SESSION_ID);

        expect(sessionService.switchSession).toHaveBeenCalledWith(OTHER_SESSION_ID);
        expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:session-switched', {
          sessionId: OTHER_SESSION_ID,
        });
      });
    });

    describe('session:active', () => {
      it('sessionService.getActiveSessionId() の結果を返す', () => {
        handler.register();
        const activeHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:active',
        )?.[1] as () => string | null;

        const result = activeHandler();

        expect(result).toBe(SESSION_ID);
        expect(sessionService.getActiveSessionId).toHaveBeenCalledOnce();
      });

      it('アクティブセッションがない場合、null を返す', () => {
        sessionService.getActiveSessionId.mockReturnValue(null);
        handler.register();
        const activeHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:active',
        )?.[1] as () => string | null;

        const result = activeHandler();

        expect(result).toBeNull();
      });
    });

    describe('session:all', () => {
      it('sessionService.getAllSessionIds() の結果を返す', () => {
        const OTHER_SESSION_ID = 'other-session-id';
        sessionService.getAllSessionIds.mockReturnValue([SESSION_ID, OTHER_SESSION_ID]);
        handler.register();
        const allHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:all',
        )?.[1] as () => string[];

        const result = allHandler();

        expect(result).toEqual([SESSION_ID, OTHER_SESSION_ID]);
      });
    });

    describe('session:is-acp-connected', () => {
      it('ACP 接続済みセッションに対して true を返す', () => {
        sessionService.isAcpConnected.mockReturnValue(true);
        handler.register();
        const isAcpConnectedHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:is-acp-connected',
        )?.[1] as (_event: unknown, sessionId: string) => boolean;

        const result = isAcpConnectedHandler(null, SESSION_ID);

        expect(result).toBe(true);
        expect(sessionService.isAcpConnected).toHaveBeenCalledWith(SESSION_ID);
      });

      it('ACP 未接続セッションに対して false を返す', () => {
        sessionService.isAcpConnected.mockReturnValue(false);
        handler.register();
        const isAcpConnectedHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:is-acp-connected',
        )?.[1] as (_event: unknown, sessionId: string) => boolean;

        const result = isAcpConnectedHandler(null, SESSION_ID);

        expect(result).toBe(false);
      });
    });

    describe('session:get-models', () => {
      it('sessionService.getModelState() の結果を返す', () => {
        const modelState: SessionModelState = {
          currentModelId: 'claude-haiku-4.5',
          availableModels: [
            { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
          ],
        };
        sessionService.getModelState.mockReturnValue(modelState);
        handler.register();
        const getModelsHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:get-models',
        )?.[1] as (_event: unknown, sessionId: string) => unknown;

        const result = getModelsHandler(null, SESSION_ID);

        expect(result).toEqual(modelState);
        expect(sessionService.getModelState).toHaveBeenCalledWith(SESSION_ID);
      });

      it('session:new / session:load 完了前に呼ぶとエラーを投げる', () => {
        sessionService.getModelState.mockImplementation(() => {
          throw new Error('Model state not set');
        });
        handler.register();
        const getModelsHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:get-models',
        )?.[1] as (_event: unknown, sessionId: string) => unknown;

        expect(() => getModelsHandler(null, SESSION_ID)).toThrow();
      });
    });

    describe('session:set-model', () => {
      it('sessionService.setModel() を呼び、レンダラーに通知を送る', async () => {
        handler.register();
        const setModelHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:set-model',
        )?.[1] as (_event: unknown, sessionId: string, modelId: string) => Promise<void>;

        await setModelHandler(null, SESSION_ID, 'claude-sonnet-4.5');

        expect(sessionService.setModel).toHaveBeenCalledWith(SESSION_ID, 'claude-sonnet-4.5');
        expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:model-changed', {
          sessionId: SESSION_ID,
          modelId: 'claude-sonnet-4.5',
        });
      });
    });

    describe('session:list', () => {
      it('sessionService.listSessions() の結果を返す', async () => {
        const sessions = [{ acpSessionId: SESSION_ID, cwd: '/workspace' }];
        sessionService.listSessions.mockResolvedValue(sessions);
        handler.register();
        const listHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:list',
        )?.[1] as () => Promise<unknown>;

        const result = await listHandler();

        expect(result).toEqual(sessions);
        expect(sessionService.listSessions).toHaveBeenCalledOnce();
      });
    });
  });
});
