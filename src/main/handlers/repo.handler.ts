import type { RepoService } from '../services/repo.service';
import type { ConfigRepository } from '../repositories/config.repository';
import { handle } from '../ipc';

/**
 * リポジトリ操作と設定管理を IPC 経由で受け付けるハンドラー。
 *
 * `register()` を呼ぶことで `ipcMain` に各チャンネルを登録する。
 */
export class RepoHandler {
  /**
   * @param repoService - リポジトリのクローンと worktree 管理を行うサービス（依存注入）
   * @param configRepo - 設定ファイルの読み書きを行うリポジトリ（依存注入）
   */
  constructor(
    private readonly repoService: Pick<
      RepoService,
      'clone' | 'createWorktree' | 'listClonedRepos' | 'listBranches' | 'getBatchDiffStats'
    >,
    private readonly configRepo: Pick<ConfigRepository, 'readSettings' | 'writeSettings'>,
  ) {}

  /**
   * リポジトリ操作・設定管理の IPC チャンネルを `ipcMain` に登録する。
   *
   * 登録するチャンネル:
   * - `repo:clone` — リポジトリを bare clone し `repoId` を返す
   * - `repo:list` — クローン済みリポジトリ一覧を返す
   * - `repo:create-worktree` — bare repo から worktree を作成し `cwd` を返す
   * - `repo:list-branches` — 指定リポジトリのリモートブランチ一覧を返す
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

    handle('repo:diff-stats', (_event, requests) => this.repoService.getBatchDiffStats(requests));

    handle('config:get-settings', () => this.configRepo.readSettings());

    handle('config:update-settings', async (_event, partial) => {
      const current = await this.configRepo.readSettings();
      await this.configRepo.writeSettings({ ...current, ...partial });
    });
  }
}
