import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionModelState } from '@agentclientprotocol/sdk/dist/schema/index';
import type { SessionModeState } from '@agentclientprotocol/sdk/dist/schema/index';
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

  describe('modelState', () => {
    const MODEL_STATE: SessionModelState = {
      currentModelId: 'claude-haiku-4.5',
      availableModels: [
        { modelId: 'auto', name: 'auto', description: 'Auto select' },
        { modelId: 'claude-haiku-4.5', name: 'claude-haiku-4.5', description: 'Haiku' },
        { modelId: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5', description: 'Sonnet' },
      ],
    };

    it('初期状態で getModelState() はエラーを投げる', () => {
      expect(() => repo.getModelState('session-1')).toThrow();
    });

    it('setModelState() で設定したモデル状態を getModelState() で取得できる', () => {
      repo.setModelState('session-1', MODEL_STATE);
      expect(repo.getModelState('session-1')).toEqual(MODEL_STATE);
    });

    it('updateCurrentModelId() で currentModelId を更新できる', () => {
      repo.setModelState('session-1', MODEL_STATE);
      repo.updateCurrentModelId('session-1', 'claude-sonnet-4.5');
      expect(repo.getModelState('session-1').currentModelId).toBe('claude-sonnet-4.5');
    });

    it('updateCurrentModelId() はモデル状態未設定の場合エラーを投げる', () => {
      expect(() => repo.updateCurrentModelId('nonexistent', 'claude-sonnet-4.5')).toThrow();
    });

    it('異なるセッションのモデル状態は独立して管理される', () => {
      repo.setModelState('session-1', MODEL_STATE);
      repo.setModelState('session-2', {
        currentModelId: 'claude-sonnet-4.5',
        availableModels: MODEL_STATE.availableModels,
      });
      expect(repo.getModelState('session-1').currentModelId).toBe('claude-haiku-4.5');
      expect(repo.getModelState('session-2').currentModelId).toBe('claude-sonnet-4.5');
    });
  });

  describe('modeState', () => {
    const MODE_STATE: SessionModeState = {
      currentModeId: 'kiro_default',
      availableModes: [
        { id: 'kiro_default', name: 'Default' },
        { id: 'test-reviewer', name: 'test-reviewer' },
        { id: 'test-coder', name: 'test-coder' },
      ],
    };

    it('初期状態で getModeState() はエラーを投げる', () => {
      expect(() => repo.getModeState('session-1')).toThrow();
    });

    it('setModeState() で設定した mode 状態を getModeState() で取得できる', () => {
      repo.setModeState('session-1', MODE_STATE);
      expect(repo.getModeState('session-1')).toEqual(MODE_STATE);
    });

    it('updateCurrentModeId() で currentModeId を更新できる', () => {
      repo.setModeState('session-1', MODE_STATE);
      repo.updateCurrentModeId('session-1', 'test-reviewer');
      expect(repo.getModeState('session-1').currentModeId).toBe('test-reviewer');
    });

    it('updateCurrentModeId() は mode 状態未設定の場合エラーを投げる', () => {
      expect(() => repo.updateCurrentModeId('nonexistent', 'test-reviewer')).toThrow();
    });

    it('異なるセッションの mode 状態は独立して管理される', () => {
      repo.setModeState('session-1', MODE_STATE);
      repo.setModeState('session-2', { ...MODE_STATE, currentModeId: 'test-coder' });
      expect(repo.getModeState('session-1').currentModeId).toBe('kiro_default');
      expect(repo.getModeState('session-2').currentModeId).toBe('test-coder');
    });
  });

  describe('contextUsagePercentage', () => {
    it('初期状態で getContextUsagePercentage() は null を返す', () => {
      expect(repo.getContextUsagePercentage('session-1')).toBeNull();
    });

    it('setContextUsagePercentage() で設定した値を getContextUsagePercentage() で取得できる', () => {
      repo.setContextUsagePercentage('session-1', 42.5);
      expect(repo.getContextUsagePercentage('session-1')).toBe(42.5);
    });

    it('異なるセッションの contextUsagePercentage は独立して管理される', () => {
      repo.setContextUsagePercentage('session-1', 10);
      repo.setContextUsagePercentage('session-2', 90);
      expect(repo.getContextUsagePercentage('session-1')).toBe(10);
      expect(repo.getContextUsagePercentage('session-2')).toBe(90);
    });

    it('値を上書きできる', () => {
      repo.setContextUsagePercentage('session-1', 30);
      repo.setContextUsagePercentage('session-1', 60);
      expect(repo.getContextUsagePercentage('session-1')).toBe(60);
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
