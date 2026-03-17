import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import { AcpConnectionService } from '../acp-connection.service';
import type { ClientHandlerFactory, SpawnFn } from '../acp-connection.service';
import { ConnectionRepository } from '../connection.repository';

// vi.mock はホイストされるため vi.hoisted で先に定義する
const { mockInitialize } = vi.hoisted(() => ({
  mockInitialize: vi.fn().mockResolvedValue({}),
}));

// ACP SDK のモック
vi.mock('@agentclientprotocol/sdk', () => {
  class MockClientSideConnection {
    initialize = mockInitialize;
  }
  return {
    ClientSideConnection: MockClientSideConnection,
    ndJsonStream: vi.fn().mockReturnValue({}),
    PROTOCOL_VERSION: 1,
  };
});

// stream モジュールのモック
vi.mock('stream', () => {
  const Readable = {
    toWeb: vi.fn().mockReturnValue({}),
  };
  const Writable = {
    toWeb: vi.fn().mockReturnValue({}),
  };
  return { Readable, Writable };
});

/** テスト用の子プロセスモック */
function makeSpawnMock() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter;
    kill: MockedFunction<() => void>;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

describe('AcpConnectionService', () => {
  let connectionRepo: ConnectionRepository;
  let notificationService: {
    sendToRenderer: MockedFunction<(channel: string, data: unknown) => void>;
  };
  let clientHandlerFactory: ReturnType<typeof vi.fn>;
  let spawnMock: ReturnType<typeof vi.fn>;
  let proc: ReturnType<typeof makeSpawnMock>;
  let service: AcpConnectionService;

  beforeEach(() => {
    connectionRepo = new ConnectionRepository();
    notificationService = { sendToRenderer: vi.fn() };
    clientHandlerFactory = vi.fn().mockReturnValue({});
    proc = makeSpawnMock();
    spawnMock = vi.fn().mockReturnValue(proc);

    service = new AcpConnectionService(
      connectionRepo,
      notificationService,
      clientHandlerFactory as unknown as ClientHandlerFactory,
      spawnMock as unknown as SpawnFn,
    );
  });

  describe('start()', () => {
    it('kiro-cli が ["acp"] 引数で spawn されること', async () => {
      await service.start();
      expect(spawnMock).toHaveBeenCalledWith('kiro-cli', ['acp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('spawn 後に Repository の status が "connecting" になること', async () => {
      // spawnFn の呼び出し直後に status を確認するためにモックを工夫する
      let statusAfterSpawn: string | undefined;
      spawnMock.mockImplementation(() => {
        statusAfterSpawn = connectionRepo.getStatus();
        return proc;
      });

      await service.start();
      expect(statusAfterSpawn).toBe('connecting');
    });

    it('connection.initialize() が呼ばれること', async () => {
      await service.start();
      expect(mockInitialize).toHaveBeenCalledWith({
        protocolVersion: 1,
        clientInfo: { name: 'kiroductor', version: '0.1.0' },
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      });
    });

    it('initialize 完了後に Repository に connection と process が保存され、status が "connected" になること', async () => {
      await service.start();
      expect(connectionRepo.getConnection()).not.toBeNull();
      expect(connectionRepo.getProcess()).not.toBeNull();
      expect(connectionRepo.getStatus()).toBe('connected');
    });
  });

  describe('stop()', () => {
    it('stop() を呼ぶと子プロセスの kill() が呼ばれること', async () => {
      await service.start();
      await service.stop();
      expect(proc.kill).toHaveBeenCalled();
    });

    it('stop() 後に Repository が clear されること', async () => {
      await service.start();
      await service.stop();
      expect(connectionRepo.getConnection()).toBeNull();
      expect(connectionRepo.getProcess()).toBeNull();
      expect(connectionRepo.getStatus()).toBe('disconnected');
    });

    it('プロセスが存在しない場合でも stop() がエラーを投げないこと', async () => {
      await expect(service.stop()).resolves.not.toThrow();
    });
  });

  describe('getStatus()', () => {
    it('初期状態で "disconnected" を返す', () => {
      expect(service.getStatus()).toBe('disconnected');
    });

    it('start() 完了後に "connected" を返す', async () => {
      await service.start();
      expect(service.getStatus()).toBe('connected');
    });
  });

  describe('プロセス異常終了のハンドリング', () => {
    it('プロセスが exit イベントを発行したとき、Repository の status が "error" になること', async () => {
      await service.start();
      proc.emit('exit', 1, null);
      expect(connectionRepo.getStatus()).toBe('error');
    });

    it('プロセスが code 0 で exit したとき、error にならないこと', async () => {
      await service.start();
      proc.emit('exit', 0, null);
      expect(connectionRepo.getStatus()).toBe('connected');
    });

    it('プロセスが exit イベントを発行したとき、レンダラーに status: "error" が通知されること', async () => {
      await service.start();
      proc.emit('exit', 1, null);
      expect(notificationService.sendToRenderer).toHaveBeenCalledWith(
        'acp:status-change',
        expect.objectContaining({ status: 'error' }),
      );
    });

    it('プロセスが error イベントを発行したとき、Repository の status が "error" になること', async () => {
      await service.start();
      proc.emit('error', new Error('spawn failed'));
      expect(connectionRepo.getStatus()).toBe('error');
    });

    it('プロセスが error イベントを発行したとき、レンダラーに status: "error" が通知されること', async () => {
      await service.start();
      proc.emit('error', new Error('spawn failed'));
      expect(notificationService.sendToRenderer).toHaveBeenCalledWith(
        'acp:status-change',
        expect.objectContaining({ status: 'error' }),
      );
    });
  });
});
