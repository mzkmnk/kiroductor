import { describe, it, expect, vi } from 'vitest';
import {
  KiroductorClientHandler,
  type IReadTextFileMethod,
  type IWriteTextFileMethod,
  type IRequestPermissionMethod,
  type ISessionUpdateMethod,
} from '../client-handler';
import type {
  ReadTextFileRequest,
  WriteTextFileRequest,
  RequestPermissionRequest,
  SessionNotification,
} from '@agentclientprotocol/sdk/dist/schema/index';

const makeReadTextFileMethod = (): IReadTextFileMethod => ({ handle: vi.fn() });

const makeWriteTextFileMethod = (): IWriteTextFileMethod => ({ handle: vi.fn() });

const makeRequestPermissionMethod = (): IRequestPermissionMethod => ({ handle: vi.fn() });

const makeSessionUpdateMethod = (): ISessionUpdateMethod => ({ handle: vi.fn() });

const makeHandler = (overrides?: {
  readTextFileMethod?: IReadTextFileMethod;
  writeTextFileMethod?: IWriteTextFileMethod;
  requestPermissionMethod?: IRequestPermissionMethod;
  sessionUpdateMethod?: ISessionUpdateMethod;
}) =>
  new KiroductorClientHandler(
    overrides?.readTextFileMethod ?? makeReadTextFileMethod(),
    overrides?.writeTextFileMethod ?? makeWriteTextFileMethod(),
    overrides?.requestPermissionMethod ?? makeRequestPermissionMethod(),
    overrides?.sessionUpdateMethod ?? makeSessionUpdateMethod(),
  );

describe('KiroductorClientHandler', () => {
  describe('readTextFile', () => {
    it('ReadTextFileMethod へ委譲すること', async () => {
      const readTextFileMethod = makeReadTextFileMethod();
      vi.mocked(readTextFileMethod.handle).mockResolvedValue({ content: 'hello' });
      const handler = makeHandler({ readTextFileMethod });

      const params: ReadTextFileRequest = { path: '/foo/bar.txt' };
      const result = await handler.readTextFile(params);

      expect(readTextFileMethod.handle).toHaveBeenCalledWith(params);
      expect(result).toEqual({ content: 'hello' });
    });
  });

  describe('writeTextFile', () => {
    it('WriteTextFileMethod へ委譲すること', async () => {
      const writeTextFileMethod = makeWriteTextFileMethod();
      vi.mocked(writeTextFileMethod.handle).mockResolvedValue({});
      const handler = makeHandler({ writeTextFileMethod });

      const params: WriteTextFileRequest = { path: '/foo/bar.txt', content: 'hello' };
      const result = await handler.writeTextFile(params);

      expect(writeTextFileMethod.handle).toHaveBeenCalledWith(params);
      expect(result).toEqual({});
    });
  });

  describe('requestPermission', () => {
    it('RequestPermissionMethod へ委譲すること', async () => {
      const requestPermissionMethod = makeRequestPermissionMethod();
      vi.mocked(requestPermissionMethod.handle).mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'opt-1' },
      });
      const handler = makeHandler({ requestPermissionMethod });

      const params: RequestPermissionRequest = {
        sessionId: 'session-1',
        toolCall: { status: 'in_progress', toolCallId: 'tool-1' },
        options: [{ optionId: 'opt-1', kind: 'allow_once', name: '許可' }],
      };
      const result = await handler.requestPermission(params);

      expect(requestPermissionMethod.handle).toHaveBeenCalledWith(params);
      expect(result).toEqual({ outcome: { outcome: 'selected', optionId: 'opt-1' } });
    });
  });

  describe('sessionUpdate', () => {
    it('SessionUpdateMethod へ委譲すること', async () => {
      const sessionUpdateMethod = makeSessionUpdateMethod();
      vi.mocked(sessionUpdateMethod.handle).mockResolvedValue(undefined);
      const handler = makeHandler({ sessionUpdateMethod });

      const params: SessionNotification = {
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hi' },
        },
      };
      await handler.sessionUpdate(params);

      expect(sessionUpdateMethod.handle).toHaveBeenCalledWith(params);
    });
  });

  describe('extNotification', () => {
    it('エラーを投げないこと', async () => {
      const handler = makeHandler();

      await expect(
        handler.extNotification('_kiro.dev/mcp/server_initialized', {}),
      ).resolves.toBeUndefined();
    });

    it('任意のメソッド名で呼ばれてもエラーを投げないこと', async () => {
      const handler = makeHandler();

      await expect(
        handler.extNotification('_kiro.dev/commands/available', { commands: [] }),
      ).resolves.toBeUndefined();
    });
  });
});
