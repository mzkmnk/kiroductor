import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRepository } from '../session.repository';

describe('SessionRepository', () => {
  let repo: SessionRepository;

  beforeEach(() => {
    repo = new SessionRepository();
  });

  describe('初期状態', () => {
    it('getSessionId は null を返す', () => {
      expect(repo.getSessionId()).toBeNull();
    });

    it('hasActiveSession は false を返す', () => {
      expect(repo.hasActiveSession()).toBe(false);
    });
  });

  describe('getSessionId / setSessionId', () => {
    it('setSessionId で保存した値を getSessionId で取得できる', () => {
      repo.setSessionId('session-abc-123');
      expect(repo.getSessionId()).toBe('session-abc-123');
    });

    it('setSessionId(null) で null を設定できる', () => {
      repo.setSessionId('session-abc-123');
      repo.setSessionId(null);
      expect(repo.getSessionId()).toBeNull();
    });
  });

  describe('hasActiveSession', () => {
    it('セッション ID を設定すると true を返す', () => {
      repo.setSessionId('session-abc-123');
      expect(repo.hasActiveSession()).toBe(true);
    });

    it('セッション ID を null にすると false を返す', () => {
      repo.setSessionId('session-abc-123');
      repo.setSessionId(null);
      expect(repo.hasActiveSession()).toBe(false);
    });
  });
});
