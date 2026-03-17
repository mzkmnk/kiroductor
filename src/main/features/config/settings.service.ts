import type { ConfigRepository, KiroductorSettings } from './config.repository';

/**
 * アプリケーション設定の読み書きを管理するサービス。
 */
export class SettingsService {
  /**
   * @param configRepo - 設定ファイルの読み書きを行うリポジトリ（依存注入）
   */
  constructor(
    private readonly configRepo: Pick<ConfigRepository, 'readSettings' | 'writeSettings'>,
  ) {}

  /**
   * 現在のアプリ設定を返す。
   *
   * @returns {@link KiroductorSettings}
   */
  async getSettings(): Promise<KiroductorSettings> {
    return this.configRepo.readSettings();
  }

  /**
   * アプリ設定を部分更新する。
   *
   * 既存の設定とマージし、上書き保存する。
   *
   * @param partial - 更新するフィールド
   */
  async updateSettings(partial: Partial<KiroductorSettings>): Promise<void> {
    const current = await this.configRepo.readSettings();
    await this.configRepo.writeSettings({ ...current, ...partial });
  }
}
