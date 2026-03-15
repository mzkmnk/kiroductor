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

    it('getActiveSessionId は null を返す', () => {
      expect(repo.getActiveSessionId()).toBeNull();
    });

    it('getAllSessionIds は空配列を返す', () => {
      expect(repo.getAllSessionIds()).toEqual([]);
    });
  });

  describe('getSessionId / setSessionId', () => {
    it('setSessionId で保存した値を getSessionId で取得できる', () => {
      repo.addSession('session-abc-123');
      repo.setSessionId('session-abc-123');
      expect(repo.getSessionId()).toBe('session-abc-123');
    });

    it('setSessionId(null) で null を設定できる', () => {
      repo.addSession('session-abc-123');
      repo.setSessionId('session-abc-123');
      repo.setSessionId(null);
      expect(repo.getSessionId()).toBeNull();
    });
  });

  describe('hasActiveSession', () => {
    it('セッション ID を設定すると true を返す', () => {
      repo.addSession('session-abc-123');
      repo.setSessionId('session-abc-123');
      expect(repo.hasActiveSession()).toBe(true);
    });

    it('セッション ID を null にすると false を返す', () => {
      repo.addSession('session-abc-123');
      repo.setSessionId('session-abc-123');
      repo.setSessionId(null);
      expect(repo.hasActiveSession()).toBe(false);
    });
  });

  describe('isLoading', () => {
    it('初期状態で getIsLoading() は false を返す', () => {
      expect(repo.getIsLoading()).toBe(false);
    });

    it('setIsLoading(true) で getIsLoading() が true を返す', () => {
      repo.setIsLoading(true);
      expect(repo.getIsLoading()).toBe(true);
    });

    it('setIsLoading(false) で getIsLoading() が false を返す', () => {
      repo.setIsLoading(true);
      repo.setIsLoading(false);
      expect(repo.getIsLoading()).toBe(false);
    });
  });

  describe('addSession', () => {
    it('sessionIds にセッション ID が追加される', () => {
      repo.addSession('session-1');
      expect(repo.getAllSessionIds()).toEqual(['session-1']);
    });

    it('複数のセッションを追加できる', () => {
      repo.addSession('session-1');
      repo.addSession('session-2');
      expect(repo.getAllSessionIds()).toEqual(['session-1', 'session-2']);
    });

    it('同じセッション ID を重複追加しても1つだけ保持される', () => {
      repo.addSession('session-1');
      repo.addSession('session-1');
      expect(repo.getAllSessionIds()).toEqual(['session-1']);
    });
  });

  describe('removeSession', () => {
    it('sessionIds からセッション ID が削除される', () => {
      repo.addSession('session-1');
      repo.addSession('session-2');
      repo.removeSession('session-1');
      expect(repo.getAllSessionIds()).toEqual(['session-2']);
    });

    it('アクティブセッションが削除された場合、activeSessionId が null になる', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      repo.removeSession('session-1');
      expect(repo.getActiveSessionId()).toBeNull();
    });

    it('アクティブでないセッションを削除しても activeSessionId は変わらない', () => {
      repo.addSession('session-1');
      repo.addSession('session-2');
      repo.setActiveSession('session-1');
      repo.removeSession('session-2');
      expect(repo.getActiveSessionId()).toBe('session-1');
    });
  });

  describe('setActiveSession', () => {
    it('sessionIds に含まれるセッション ID のみ設定可能', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      expect(repo.getActiveSessionId()).toBe('session-1');
    });

    it('存在しないセッション ID を指定した場合、エラーが投げられる', () => {
      expect(() => repo.setActiveSession('nonexistent')).toThrow();
    });
  });

  describe('getActiveSessionId', () => {
    it('アクティブセッション ID を返す', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      expect(repo.getActiveSessionId()).toBe('session-1');
    });

    it('アクティブセッションが未設定の場合 null を返す', () => {
      expect(repo.getActiveSessionId()).toBeNull();
    });
  });

  describe('getAllSessionIds', () => {
    it('全セッション ID を配列で返す', () => {
      repo.addSession('session-1');
      repo.addSession('session-2');
      repo.addSession('session-3');
      expect(repo.getAllSessionIds()).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('下位互換性', () => {
    it('getSessionId は activeSessionId を返す', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      expect(repo.getSessionId()).toBe('session-1');
    });

    it('setSessionId は activeSessionId を更新する', () => {
      repo.addSession('session-1');
      repo.setSessionId('session-1');
      expect(repo.getActiveSessionId()).toBe('session-1');
    });

    it('setSessionId(null) で activeSessionId が null になる', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      repo.setSessionId(null);
      expect(repo.getActiveSessionId()).toBeNull();
    });

    it('hasActiveSession は activeSessionId の有無を返す', () => {
      repo.addSession('session-1');
      repo.setActiveSession('session-1');
      expect(repo.hasActiveSession()).toBe(true);
    });
  });
});
