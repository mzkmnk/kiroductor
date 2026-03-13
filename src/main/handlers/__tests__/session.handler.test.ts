import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { SessionHandler } from '../session.handler';
import { SessionService } from '../../services/session.service';
import { PromptService } from '../../services/prompt.service';
import { MessageRepository } from '../../repositories/message.repository';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('SessionHandler', () => {
  let messageRepo: MessageRepository;
  let sessionService: {
    create: MockedFunction<(cwd: string) => Promise<void>>;
    cancel: MockedFunction<() => Promise<void>>;
  };
  let promptService: {
    send: MockedFunction<(text: string) => Promise<string>>;
  };
  let handler: SessionHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    messageRepo = new MessageRepository();
    sessionService = {
      create: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    promptService = {
      send: vi.fn().mockResolvedValue('end_turn'),
    };
    handler = new SessionHandler(
      sessionService as unknown as SessionService,
      promptService as unknown as PromptService,
      messageRepo,
    );
  });

  describe('register()', () => {
    it('session:new / session:prompt / session:cancel / session:messages の4チャンネルを登録する', () => {
      handler.register();

      const channels = ipcHandle.mock.calls.map((call) => call[0] as string);
      expect(channels).toContain('session:new');
      expect(channels).toContain('session:prompt');
      expect(channels).toContain('session:cancel');
      expect(channels).toContain('session:messages');
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

    describe('session:prompt', () => {
      it('受け取った text を引数として promptService.send() を呼ぶ', async () => {
        handler.register();
        const promptHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:prompt',
        )?.[1] as (_event: unknown, text: string) => Promise<string>;

        await promptHandler(null, 'hello');

        expect(promptService.send).toHaveBeenCalledWith('hello');
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
      it('messageRepository.getAll() の結果を返す', async () => {
        messageRepo.addUserMessage('test message');
        handler.register();
        const messagesHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'session:messages',
        )?.[1] as () => Promise<unknown>;

        const result = await messagesHandler();

        expect(result).toEqual([expect.objectContaining({ type: 'user', text: 'test message' })]);
      });
    });
  });
});
