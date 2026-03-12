import { describe, it, expect, vi } from 'vitest';
import { RequestPermissionMethod } from '../request-permission.method';
import type { RequestPermissionRequest } from '@agentclientprotocol/sdk/dist/schema/index';

describe('RequestPermissionMethod', () => {
  const makeNotificationService = () => ({
    sendToRenderer: vi.fn(),
  });

  const makeParams = (overrides?: Partial<RequestPermissionRequest>): RequestPermissionRequest => ({
    sessionId: 'session-1',
    toolCall: { status: 'in_progress', toolCallId: 'tool-call-1' },
    options: [
      { optionId: 'option-1', kind: 'allow_once', name: '一度だけ許可' },
      { optionId: 'option-2', kind: 'reject_once', name: '一度だけ拒否' },
    ],
    ...overrides,
  });

  it('最初のオプション ID が返されること', async () => {
    const notificationService = makeNotificationService();
    const method = new RequestPermissionMethod(notificationService);

    const result = await method.handle(makeParams());

    expect(result.outcome).toEqual({
      outcome: 'selected',
      optionId: 'option-1',
    });
  });

  it('レンダラーへの通知が実行されること', async () => {
    const notificationService = makeNotificationService();
    const method = new RequestPermissionMethod(notificationService);

    await method.handle(makeParams());

    expect(notificationService.sendToRenderer).toHaveBeenCalled();
  });
});
