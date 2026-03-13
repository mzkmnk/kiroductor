import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { AcpHandler } from '../acp.handler';
import { AcpConnectionService } from '../../services/acp-connection.service';
import { ConnectionRepository } from '../../repositories/connection.repository';

const { ipcHandle } = vi.hoisted(() => ({ ipcHandle: vi.fn() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

describe('AcpHandler', () => {
  let connectionRepo: ConnectionRepository;
  let acpConnectionService: {
    start: MockedFunction<() => Promise<void>>;
    stop: MockedFunction<() => Promise<void>>;
  };
  let handler: AcpHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    connectionRepo = new ConnectionRepository();
    acpConnectionService = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    handler = new AcpHandler(
      acpConnectionService as unknown as AcpConnectionService,
      connectionRepo,
    );
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
      it('connectionRepository.getStatus() の結果を返す', async () => {
        connectionRepo.setStatus('connected');
        handler.register();
        const statusHandler = ipcHandle.mock.calls.find(
          (call) => call[0] === 'acp:status',
        )?.[1] as () => Promise<string>;

        const result = await statusHandler();

        expect(result).toBe('connected');
      });
    });
  });
});
