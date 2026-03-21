import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataMethod } from '../metadata.method';

const SESSION_ID = 'session-1';

describe('MetadataMethod', () => {
  const sessionRepository = {
    setContextUsagePercentage: vi.fn(),
  };
  const notificationService = {
    sendToRenderer: vi.fn(),
  };
  let method: MetadataMethod;

  beforeEach(() => {
    vi.clearAllMocks();
    method = new MetadataMethod(sessionRepository, notificationService);
  });

  it('_kiro.dev/metadata を受信したとき sessionRepository に contextUsagePercentage を保存する', async () => {
    await method.handle('_kiro.dev/metadata', {
      sessionId: SESSION_ID,
      contextUsagePercentage: 42.5,
    });

    expect(sessionRepository.setContextUsagePercentage).toHaveBeenCalledWith(SESSION_ID, 42.5);
  });

  it('_kiro.dev/metadata を受信したとき acp:metadata チャネルでレンダラーに通知する', async () => {
    await method.handle('_kiro.dev/metadata', {
      sessionId: SESSION_ID,
      contextUsagePercentage: 5.44,
    });

    expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:metadata', {
      sessionId: SESSION_ID,
      contextUsagePercentage: 5.44,
    });
  });

  it('_kiro.dev/metadata 以外のメソッド名では何もしない', async () => {
    await method.handle('_kiro.dev/mcp/server_initialized', { foo: 'bar' });

    expect(sessionRepository.setContextUsagePercentage).not.toHaveBeenCalled();
    expect(notificationService.sendToRenderer).not.toHaveBeenCalled();
  });
});
