import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { SettingsService } from '../settings.service';
import type { ConfigRepository, KiroductorSettings } from '../../repositories/config.repository';

describe('SettingsService', () => {
  let configRepo: {
    readSettings: MockedFunction<() => Promise<KiroductorSettings>>;
    writeSettings: MockedFunction<(settings: KiroductorSettings) => Promise<void>>;
  };
  let service: SettingsService;

  beforeEach(() => {
    configRepo = {
      readSettings: vi.fn().mockResolvedValue({}),
      writeSettings: vi.fn().mockResolvedValue(undefined),
    };
    service = new SettingsService(
      configRepo as unknown as Pick<ConfigRepository, 'readSettings' | 'writeSettings'>,
    );
  });

  describe('getSettings()', () => {
    it('configRepo.readSettings() の結果を返す', async () => {
      const settings: KiroductorSettings = {};
      configRepo.readSettings.mockResolvedValue(settings);

      const result = await service.getSettings();

      expect(result).toEqual(settings);
      expect(configRepo.readSettings).toHaveBeenCalledOnce();
    });
  });

  describe('updateSettings(partial)', () => {
    it('既存の設定とマージして書き込む', async () => {
      const current: KiroductorSettings = {};
      configRepo.readSettings.mockResolvedValue(current);

      const partial: Partial<KiroductorSettings> = {};
      await service.updateSettings(partial);

      expect(configRepo.readSettings).toHaveBeenCalledOnce();
      expect(configRepo.writeSettings).toHaveBeenCalledWith({ ...current, ...partial });
    });
  });
});
