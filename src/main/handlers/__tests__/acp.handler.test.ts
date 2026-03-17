import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { AcpHandler } from '../acp.handler';
import type { AcpStatus } from '../../repositories/connection.repository';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('AcpHandler', () => {
  let acpConnectionService: {
    start: MockedFunction<() => Promise<void>>;
    stop: MockedFunction<() => Promise<void>>;
    getStatus: MockedFunction<() => AcpStatus>;
  };
  let handler: AcpHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    acpConnectionService = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue('disconnected'),
    };
    handler = new AcpHandler(acpConnectionService);
  });

  describe('register()', () => {
    it('acp:start / acp:stop / acp:status の3チャンネルを登録する', () => {
      handler.register();

      const channels = ipcHandle.mock.calls.map((call) => call[0] as string);
      expect(channels).toContain('acp:start');
      expect(channels).toContain('acp:stop');
      expect(channels).toContain('acp:status');
    });

    describe('acp:start', () => {
      it('呼ばれたら acpConnectionService.start() を実行する', async () => {
        handler.register();
        const startHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'acp:start',
        )?.[1] as () => Promise<void>;

        await startHandler();

        expect(acpConnectionService.start).toHaveBeenCalledOnce();
      });
    });

    describe('acp:stop', () => {
      it('呼ばれたら acpConnectionService.stop() を実行する', async () => {
        handler.register();
        const stopHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'acp:stop',
        )?.[1] as () => Promise<void>;

        await stopHandler();

        expect(acpConnectionService.stop).toHaveBeenCalledOnce();
      });
    });

    describe('acp:status', () => {
      it('acpConnectionService.getStatus() の結果を返す', () => {
        acpConnectionService.getStatus.mockReturnValue('connected');
        handler.register();
        const statusHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'acp:status',
        )?.[1] as () => AcpStatus;

        const result = statusHandler();

        expect(result).toBe('connected');
        expect(acpConnectionService.getStatus).toHaveBeenCalledOnce();
      });
    });
  });
});
