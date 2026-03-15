# Phase 6A: `.kiroductor/` 設定管理 + Bare Repo クローン

ユーザーのプロジェクト設定とリポジトリ管理の基盤を構築する。
`.kiroductor/` ディレクトリ配下に設定ファイルとクローン済みリポジトリを管理する。

## 関連ドキュメント

- 前フェーズ: [Phase 6 — チャット UI](./phase6.md)
- 次フェーズ: [Phase 6B — ACP Session Load/List](./phase6b.md)
- 調査結果: [ACP Session Load 調査](../research/acp-session-load.md)

## ディレクトリ構造

```
~/.kiroductor/
├── settings.json          # アプリ全体の設定
├── sessions.json          # セッションとリポジトリの紐付け
└── repos/                 # bare clone 格納場所
    ├── github.com/
    │   ├── mzkmnk/
    │   │   └── kiroductor.git/
    │   └── other-org/
    │       └── kiroductor.git/    # 別 org の同名リポジトリも区別可能
    └── gitlab.com/
        └── user/
            └── project.git/
```

## 設定ファイル設計

### `sessions.json` — セッションとリポジトリの紐付け

```typescript
interface SessionMapping {
  /** kiro-cli の ACP セッション ID */
  acpSessionId: string;
  /** リポジトリの識別子（例: "github.com/mzkmnk/kiroductor"） */
  repoId: string;
  /** セッション作成時の作業ディレクトリ */
  cwd: string;
  /** セッションのタイトル（kiro-cli から取得、または null） */
  title: string | null;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 最終更新日時（ISO 8601） */
  updatedAt: string;
}

interface SessionsFile {
  sessions: SessionMapping[];
}
```

> **重要**: kiro-cli v1.27.2 では `listSessions` が未サポート（`-32601`）のため、
> セッション一覧はこの `sessions.json` がマスターデータとなる。
> `~/.kiro/sessions/cli/` には全クライアントのセッションが混在するため、
> kiroductor が作成/ロードしたセッションのみを `sessions.json` に記録し、サイドバーに表示する。
> 詳細: [ACP Session Load 調査](../research/acp-session-load.md)

## ConfigRepository — `.kiroductor/` ディレクトリの読み書きを管理する

- [x] `ConfigRepository` クラスを作成し、ファイルシステム（`fs`）を依存注入で受け取るようにする
- [x] `getBaseDir()`: `~/.kiroductor/` のパスを返す（`os.homedir()` ベース）
- [x] `ensureBaseDir()`: ベースディレクトリと `repos/` サブディレクトリが存在しなければ作成する
  - **AC**: ディレクトリが存在しない場合、`mkdir -p` 相当で作成される
  - **AC**: 既に存在する場合、エラーにならない
- [x] `readSettings()`: `settings.json` を読み込み、デフォルト値とマージして返す
  - **AC**: ファイルが存在しない場合、デフォルト設定を返す
  - **AC**: ファイルが存在する場合、JSON をパースして返す
- [x] `writeSettings(settings)`: `settings.json` を書き込む
  - **AC**: JSON を整形（2 スペースインデント）して書き込む
- [x] `readSessions()`: `sessions.json` を読み込み、セッション一覧を返す
  - **AC**: ファイルが存在しない場合、空配列を返す
- [x] `writeSessions(sessions)`: `sessions.json` を書き込む
- [x] `upsertSession(mapping)`: `acpSessionId` をキーにセッションを追加または更新する
  - **AC**: 同じ `acpSessionId` が存在する場合、更新される
  - **AC**: 存在しない場合、新規追加される
  - **AC**: `updatedAt` が現在時刻に更新される
- [x] `removeSession(acpSessionId)`: セッションを削除する
- [x] テスト: 各メソッドの動作を一時ディレクトリで検証する

## RepoService — Bare Repo のクローンと管理

- [ ] `RepoService` クラスを作成し、`ConfigRepository` と `spawn` を依存注入で受け取るようにする
- [ ] `parseRepoUrl(url)`: リポジトリ URL をパースして `{ host, org, repo }` を返す
  - **AC**: `https://github.com/mzkmnk/kiroductor.git` → `{ host: "github.com", org: "mzkmnk", repo: "kiroductor" }`
  - **AC**: `git@github.com:mzkmnk/kiroductor.git` → 同上
  - **AC**: `https://gitlab.com/user/project` → `{ host: "gitlab.com", org: "user", repo: "project" }`
- [ ] `getRepoPath(repoId)`: リポジトリの bare clone パスを返す
  - **AC**: `"github.com/mzkmnk/kiroductor"` → `~/.kiroductor/repos/github.com/mzkmnk/kiroductor.git`
- [ ] `clone(url)`: bare clone を実行する
  - **AC**: `git clone --bare <url> <path>` が実行される
  - **AC**: 既にクローン済みの場合、エラーにならない（`git fetch --all` を実行）
  - **AC**: クローン先ディレクトリの親が存在しなければ作成する
- [ ] `createWorktree(repoId, branch?)`: bare repo から worktree を作成し、パスを返す
  - **AC**: `git worktree add <path> <branch>` が実行される
  - **AC**: worktree のパスはシステムの一時ディレクトリ配下に作成する
  - **AC**: 返されたパスが ACP セッションの `cwd` として使用可能
- [ ] `listClonedRepos()`: クローン済みリポジトリの一覧を返す
  - **AC**: `~/.kiroductor/repos/` 配下のディレクトリ構造から `repoId` の一覧を生成する
- [ ] テスト: URL パース、パス生成のロジックを検証する（clone/worktree はモックで検証）

## IPC チャネルの追加

| チャネル                 | 引数                              | 戻り値               | 説明                       |
| ------------------------ | --------------------------------- | -------------------- | -------------------------- |
| `repo:clone`             | `url: string`                     | `{ repoId: string }` | リポジトリを bare clone    |
| `repo:list`              | なし                              | `RepoInfo[]`         | クローン済みリポジトリ一覧 |
| `repo:create-worktree`   | `repoId: string, branch?: string` | `{ cwd: string }`    | Worktree を作成            |
| `config:get-settings`    | なし                              | `KiroductorSettings` | 設定を取得                 |
| `config:update-settings` | `Partial<KiroductorSettings>`     | `void`               | 設定を更新                 |

## RepoHandler — リポジトリ操作の IPC ハンドラー

- [ ] `repo:clone`、`repo:list`、`repo:create-worktree` チャネルを登録する
- [ ] `config:get-settings`、`config:update-settings` チャネルを登録する

## Preload API の追加

- [ ] `window.kiroductor.repo` に `clone`、`list`、`createWorktree` を公開する
- [ ] `window.kiroductor.config` に `getSettings`、`updateSettings` を公開する
