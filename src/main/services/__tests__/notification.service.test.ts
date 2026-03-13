import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { ElectronNotificationService } from '../notification.service';

/** BrowserWindow の最小モック */
const makeBrowserWindow = (isDestroyed = false) =>
  ({
    isDestroyed: vi.fn(() => isDestroyed),
    webContents: {
      send: vi.fn(),
    },
  }) as unknown as BrowserWindow;

describe('ElectronNotificationService', () => {
  describe('sendToRenderer', () => {
    it('ウィンドウが存在するとき、webContents.send が呼ばれること', () => {
      const window = makeBrowserWindow();
      const service = new ElectronNotificationService(() => window);

      service.sendToRenderer('test:channel', { foo: 'bar' });

      expect(window.webContents.send).toHaveBeenCalledWith('test:channel', { foo: 'bar' });
    });

    it('ウィンドウが null のとき、何もしないこと（エラーを出さないこと）', () => {
      const service = new ElectronNotificationService(() => null);

      expect(() => service.sendToRenderer('test:channel', { foo: 'bar' })).not.toThrow();
    });

    it('ウィンドウが破棄済みのとき、何もしないこと（エラーを出さないこと）', () => {
      const window = makeBrowserWindow(true);
      const service = new ElectronNotificationService(() => window);

      service.sendToRenderer('test:channel', { foo: 'bar' });

      expect(window.webContents.send).not.toHaveBeenCalled();
    });

    it('チャネル名とデータが正確に渡されること', () => {
      const window = makeBrowserWindow();
      const service = new ElectronNotificationService(() => window);
      const data = { sessionId: 'abc', update: { type: 'done' } };

      service.sendToRenderer('acp:session-update', data);

      expect(window.webContents.send).toHaveBeenCalledWith('acp:session-update', data);
    });
  });
});
