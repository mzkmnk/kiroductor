import { type Page, type Locator, expect } from '@playwright/test';

import { installMockKiroductorAPI, type MockConfig } from '../fixtures/mock-api';

/**
 * アプリ全体を操作する Page Object Model。
 *
 * ロケーターをここに集約することで、UI 変更時の修正箇所を最小化する。
 * 各テストでは `page.getByPlaceholder(...)` 等を直接使わず、このクラスのメンバーを使う。
 */
export class AppPage {
  /** プロンプト入力 textarea */
  readonly promptInput: Locator;
  /** 送信ボタン */
  readonly sendButton: Locator;
  /** 停止ボタン（エージェント処理中のみ表示） */
  readonly stopButton: Locator;
  /** diff 表示ボタン */
  readonly showDiffButton: Locator;
  /** セッション復元中インジケータ */
  readonly restoringIndicator: Locator;

  constructor(readonly page: Page) {
    this.promptInput = page.getByPlaceholder(/Ask to make changes/);
    this.sendButton = page.getByRole('button', { name: 'Send' });
    this.stopButton = page.getByRole('button', { name: 'Stop' });
    this.showDiffButton = page.getByLabel('Show diff');
    this.restoringIndicator = page.getByText('Restoring session...');
  }

  /**
   * window.kiroductor モック API をページに注入する。
   *
   * `page.clock.install()` の後、`goto()` の前に呼ぶこと。
   *
   * @param config - モックの動作設定（省略時はデフォルト 1 セッション）
   */
  async setup(config: MockConfig = {}) {
    await this.page.addInitScript(installMockKiroductorAPI, config);
  }

  /** ページを開く */
  async goto() {
    await this.page.goto('http://localhost:5173');
  }

  /**
   * PromptInput が表示されるまで待機する。
   *
   * アプリ初期化完了（セッション読み込み・UI マウント）を確認する目印として使う。
   */
  async waitForReady() {
    await expect(this.promptInput).toBeVisible();
  }

  /**
   * テキストでメッセージバブルのロケーターを取得する。
   *
   * @param text - 検索するテキスト
   * @param options - `exact: true` にすると完全一致
   */
  message(text: string, options?: { exact?: boolean }) {
    return this.page.getByText(text, options);
  }

  /**
   * タイトルでサイドバーのセッション項目を取得する。
   *
   * @param title - セッションタイトル
   */
  sessionItem(title: string) {
    return this.page.getByText(title);
  }
}
