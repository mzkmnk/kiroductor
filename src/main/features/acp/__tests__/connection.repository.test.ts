import { describe, it, expect, beforeEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { ConnectionRepository } from '../connection.repository';
import type { AcpStatus } from '../connection.repository';

describe('ConnectionRepository', () => {
  let repo: ConnectionRepository;

  beforeEach(() => {
    repo = new ConnectionRepository();
  });

  describe('初期状態', () => {
    it('getConnection は null を返す', () => {
      expect(repo.getConnection()).toBeNull();
    });

    it('getProcess は null を返す', () => {
      expect(repo.getProcess()).toBeNull();
    });

    it('getStatus は "disconnected" を返す', () => {
      expect(repo.getStatus()).toBe('disconnected');
    });

    it('getStderrLogs は空配列を返す', () => {
      expect(repo.getStderrLogs()).toEqual([]);
    });
  });

  describe('getProcess / setProcess', () => {
    it('setProcess で保存した値を getProcess で取得できる', () => {
      const mockProcess = { pid: 1234 } as unknown as ChildProcess;
      repo.setProcess(mockProcess);
      expect(repo.getProcess()).toBe(mockProcess);
    });

    it('setProcess(null) で null を設定できる', () => {
      const mockProcess = { pid: 1234 } as unknown as ChildProcess;
      repo.setProcess(mockProcess);
      repo.setProcess(null);
      expect(repo.getProcess()).toBeNull();
    });
  });

  describe('getConnection / setConnection', () => {
    it('setConnection で保存した値を getConnection で取得できる', () => {
      const mockConnection = { id: 'conn-1' } as unknown as ClientSideConnection;
      repo.setConnection(mockConnection);
      expect(repo.getConnection()).toBe(mockConnection);
    });

    it('setConnection(null) で null を設定できる', () => {
      const mockConnection = { id: 'conn-1' } as unknown as ClientSideConnection;
      repo.setConnection(mockConnection);
      repo.setConnection(null);
      expect(repo.getConnection()).toBeNull();
    });
  });

  describe('getStatus / setStatus', () => {
    const statuses: AcpStatus[] = ['disconnected', 'connecting', 'connected', 'error'];

    for (const status of statuses) {
      it(`setStatus("${status}") で保存した値を getStatus で取得できる`, () => {
        repo.setStatus(status);
        expect(repo.getStatus()).toBe(status);
      });
    }
  });

  describe('appendStderr / getStderrLogs', () => {
    it('appendStderr で追記したログを getStderrLogs で取得できる', () => {
      repo.appendStderr('line 1');
      repo.appendStderr('line 2');
      expect(repo.getStderrLogs()).toEqual(['line 1', 'line 2']);
    });

    it('getStderrLogs はコピーを返す（外部変更がバッファに影響しない）', () => {
      repo.appendStderr('line 1');
      const logs = repo.getStderrLogs();
      logs.push('injected');
      expect(repo.getStderrLogs()).toEqual(['line 1']);
    });
  });

  describe('clear', () => {
    it('clear で全状態を初期値に戻す', () => {
      const mockProcess = { pid: 1234 } as unknown as ChildProcess;
      const mockConnection = { id: 'conn-1' } as unknown as ClientSideConnection;

      repo.setProcess(mockProcess);
      repo.setConnection(mockConnection);
      repo.setStatus('connected');
      repo.appendStderr('some error');

      repo.clear();

      expect(repo.getProcess()).toBeNull();
      expect(repo.getConnection()).toBeNull();
      expect(repo.getStatus()).toBe('disconnected');
      expect(repo.getStderrLogs()).toEqual([]);
    });
  });
});
