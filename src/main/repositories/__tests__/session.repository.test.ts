import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRepository } from '../session.repository';

describe('SessionRepository', () => {
  let repo: SessionRepository;

  beforeEach(() => {
    repo = new SessionRepository();
  });

  describe('初期状態', () => {
    it('getActiveSessionId は null を返す', () => {
      expect(repo.getActiveSessionId()).toBeNull();
    });

    it('getAllSessionIds は空配列を返す', () => {
      expect(repo.getAllSessionIds()).toEqual([]);
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

  describe('processing', () => {
    it('初期状態で getProcessingSessionIds() は空配列を返す', () => {
      expect(repo.getProcessingSessionIds()).toEqual([]);
    });

    it('addProcessing() 後に isProcessing() は true を返す', () => {
      repo.addProcessing('session-1');
      expect(repo.isProcessing('session-1')).toBe(true);
    });

    it('removeProcessing() 後に isProcessing() は false を返す', () => {
      repo.addProcessing('session-1');
      repo.removeProcessing('session-1');
      expect(repo.isProcessing('session-1')).toBe(false);
    });

    it('getProcessingSessionIds() は処理中セッション ID の配列を返す', () => {
      repo.addProcessing('session-1');
      repo.addProcessing('session-2');
      expect(repo.getProcessingSessionIds()).toEqual(['session-1', 'session-2']);
    });

    it('管理外のセッション ID でも addProcessing は例外を投げない', () => {
      expect(() => repo.addProcessing('unmanaged')).not.toThrow();
      expect(repo.isProcessing('unmanaged')).toBe(true);
    });
  });

  describe('acpConnected', () => {
    it('初期状態で isAcpConnected() は false を返す', () => {
      expect(repo.isAcpConnected('session-1')).toBe(false);
    });

    it('markAcpConnected() 後に isAcpConnected() は true を返す', () => {
      repo.markAcpConnected('session-1');
      expect(repo.isAcpConnected('session-1')).toBe(true);
    });

    it('markAcpConnected していないセッション ID は false を返す', () => {
      repo.markAcpConnected('session-1');
      expect(repo.isAcpConnected('session-2')).toBe(false);
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
});
