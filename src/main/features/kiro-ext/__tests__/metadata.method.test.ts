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

  it('sessionRepository に contextUsagePercentage を保存する', async () => {
    await method.handle({
      sessionId: SESSION_ID,
      contextUsagePercentage: 42.5,
    });

    expect(sessionRepository.setContextUsagePercentage).toHaveBeenCalledWith(SESSION_ID, 42.5);
  });

  it('acp:metadata チャネルでレンダラーに通知する', async () => {
    await method.handle({
      sessionId: SESSION_ID,
      contextUsagePercentage: 5.44,
    });

    expect(notificationService.sendToRenderer).toHaveBeenCalledWith('acp:metadata', {
      sessionId: SESSION_ID,
      contextUsagePercentage: 5.44,
    });
  });
});
