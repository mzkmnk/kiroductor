import type { RepoService } from '../services/repo.service';
import type { SettingsService } from '../services/settings.service';
import { handle } from '../ipc';

/**
 * リポジトリ操作と設定管理を IPC 経由で受け付けるハンドラー。
 *
 * `register()` を呼ぶことで `ipcMain` に各チャンネルを登録する。
 */
export class RepoHandler {
  /**
   * @param repoService - リポジトリのクローンと worktree 管理を行うサービス（依存注入）
   * @param settingsService - アプリ設定の読み書きを行うサービス（依存注入）
   */
  constructor(
    private readonly repoService: Pick<
      RepoService,
      | 'clone'
      | 'createWorktree'
      | 'listClonedRepos'
      | 'listBranches'
      | 'getDiffStatsBySession'
      | 'getDiffBySession'
    >,
    private readonly settingsService: Pick<SettingsService, 'getSettings' | 'updateSettings'>,
  ) {}

  /**
   * リポジトリ操作・設定管理の IPC チャンネルを `ipcMain` に登録する。
   *
   * 登録するチャンネル:
   * - `repo:clone` — リポジトリを bare clone し `repoId` を返す
   * - `repo:list` — クローン済みリポジトリ一覧を返す
   * - `repo:create-worktree` — bare repo から worktree を作成し `cwd` を返す
   * - `repo:list-branches` — 指定リポジトリのリモートブランチ一覧を返す
   * - `repo:diff-stats` — 指定セッションの git diff 統計情報を返す
   * - `repo:diff` — 指定セッションの unified diff 本文を返す
   * - `config:get-settings` — アプリ設定を返す
   * - `config:update-settings` — アプリ設定を部分更新する
   */
  register(): void {
    handle('repo:clone', async (_event, url) => {
      const repoId = await this.repoService.clone(url);
      return { repoId };
    });

    handle('repo:list', () => this.repoService.listClonedRepos());

    handle('repo:create-worktree', (_event, repoId, branch) =>
      this.repoService.createWorktree(repoId, branch),
    );

    handle('repo:list-branches', (_event, repoId) => this.repoService.listBranches(repoId));

    handle('repo:diff-stats', (_event, sessionId) =>
      this.repoService.getDiffStatsBySession(sessionId),
    );

    handle('repo:diff', (_event, sessionId) => this.repoService.getDiffBySession(sessionId));

    handle('config:get-settings', () => this.settingsService.getSettings());

    handle('config:update-settings', (_event, partial) =>
      this.settingsService.updateSettings(partial),
    );
  }
}
