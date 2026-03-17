# kiroductor

kiro-cli の ACP（Agent Client Protocol）クライアントとして動作する Electron アプリ。

## プロジェクト概要

- **技術スタック**: Electron + React（TypeScript）+ electron-vite + electron-builder
- **パッケージマネージャ**: pnpm
- **アーキテクチャ**: 機能ベースのディレクトリ構造 + Handler / Service / Repository の3層（メインプロセス）

## コマンド

```bash
pnpm install          # 依存関係のインストール
pnpm start            # 開発サーバー起動（electron-vite dev、HMR付き）
pnpm build            # electron-vite ビルド（main・preload・renderer）
pnpm test             # テスト実行（vitest run）
pnpm test:watch       # テスト ウォッチモード
pnpm lint             # ESLint による静的解析
pnpm format           # Prettier によるフォーマット適用
pnpm format:check     # フォーマット確認（CI用）
pnpm make             # アプリパッケージ生成（electron-builder）
pnpm make:mac         # macOS 向けパッケージ生成（DMG + ZIP）
```

## アーキテクチャ

### ディレクトリ構造

```
src/
├── main/                    # Electron メインプロセス
│   ├── main.ts              # エントリポイント
│   ├── container.ts         # Composition Root（DI設定）
│   ├── handlers.ts          # registerHandlers()（全handler登録）
│   ├── features/            # 機能単位のモジュール
│   │   ├── acp/             # ACP 接続管理
│   │   │   ├── acp.handler.ts
│   │   │   ├── acp-connection.service.ts
│   │   │   ├── connection.repository.ts
│   │   │   ├── client-handler.ts
│   │   │   ├── methods/     # 各ACPメソッド（1ファイル1メソッド）
│   │   │   └── __tests__/
│   │   ├── session/         # セッション管理
│   │   │   ├── session.handler.ts
│   │   │   ├── session.service.ts
│   │   │   ├── prompt.service.ts
│   │   │   ├── session.repository.ts
│   │   │   ├── message.repository.ts
│   │   │   ├── session-title.generator.ts
│   │   │   └── __tests__/
│   │   ├── repo/            # Git リポジトリ管理
│   │   │   ├── repo.handler.ts
│   │   │   ├── repo.service.ts
│   │   │   └── __tests__/
│   │   └── config/          # 設定・永続化
│   │       ├── settings.service.ts
│   │       ├── config.repository.ts
│   │       └── __tests__/
│   └── shared/              # 横断的関心事
│       ├── notification.service.ts
│       ├── interfaces/      # DI用インターフェース
│       ├── ipc.ts           # 型付きIPCラッパー
│       ├── debug-logger.ts
│       ├── fs.ts            # FileSystemインターフェース
│       └── __tests__/
├── preload/
│   └── preload.ts           # contextBridge で window.kiroductor を公開
└── renderer/                # React UI
    ├── App.tsx
    ├── hooks/
    ├── components/
    ├── types/
    └── styles/
```

### 層の責務

| 層             | 責務                                             | Electron依存 |
| -------------- | ------------------------------------------------ | ------------ |
| **Handler**    | IPCチャネル受付、バリデーション、Service呼び出し | あり         |
| **Service**    | ビジネスロジック、ACP SDK操作                    | なし         |
| **Repository** | インメモリ状態管理（副作用なし）                 | なし         |

### IPC チャネル

- `acp:start` / `acp:stop` / `acp:status` — ACP接続管理
- `session:new` / `session:prompt` / `session:cancel` / `session:messages` — セッション管理

## テスト戦略

Vitest を採用。**TDD古典派**スタイルで実装する。コンストラクタインジェクションにより各層を独立してテスト可能。

### 基本方針

- **ビジネスロジック（Service・Repository・ACP Methods）を主なテスト対象とする**
- **UI（renderer）のテストは最小限に抑える**
- この優先順位の背景：ユーザから見える部分（UI）ほど仕様変更が頻繁で、見えない部分（ビジネスロジック）ほど変更しにくく安定しているため、テストの費用対効果が高い層に注力する

### TDD古典派の進め方

- テストを先に書き、実装はテストを通すための最小限のコードとする
- モックは外部システム（fs、ACP SDK の `ClientSideConnection`）に限定し、同一モジュール内のクラスは実物を使う
- リファクタリング時にテストが壊れないよう、実装詳細ではなく振る舞いを検証する

### AC（受け入れ基準）と単体テストの粒度

各タスクは **AC（Acceptance Criteria）** と **単体テスト** をセットで進める。

- **AC の書き方**: `docs/plan/` のフェーズファイルで、各チェックボックスタスクの直下に箇条書きで AC を列挙する
  - 例: `- **AC**: 初期状態で `getSessionId()`は`null` を返す`
  - AC は「入力 → 期待される出力・副作用」の形式で書く
  - 1 タスクにつき AC は 1〜5 個程度を目安とする
- **単体テストの粒度**: AC の項目ごとに `it(...)` を1つ対応させる（AC がそのままテスト名になる）
- **進め方の順序**:
  1. フェーズファイルに AC を追記する（仕様を明確にする）
  2. AC に対応するテストを書く（Red）
  3. テストが通る最小限の実装をする（Green）
  4. リファクタリングする（Refactor）

### 層別テスト方針

| 層                 | 優先度 | モック対象              | テスト内容                            |
| ------------------ | ------ | ----------------------- | ------------------------------------- |
| **Repository**     | 高     | なし（純粋な状態管理）  | add/get/update/clear の振る舞い       |
| **ACP Methods**    | 高     | fs、NotificationService | 各メソッドの入力→出力、副作用呼び出し |
| **Service**        | 高     | ClientSideConnection    | ビジネスロジック、エラーハンドリング  |
| **Handler**        | 中     | Service                 | IPC → Service 委譲の検証              |
| **UI（renderer）** | 低     | —                       | 最小限（主要な統合動作のみ）          |

## コード品質

- **TypeScript**: `strict: true`
- **ESLint**: flat config（`eslint.config.ts`）、React/TypeScript ルール
- **Prettier**: コードフォーマッター
- **Vitest**: ユニットテスト

## ドキュメントコメント規約

クラス・関数・変数・型には **TSDoc 形式**でコメントを記載する。

```ts
/**
 * 一文で概要を書く。
 *
 * 必要であれば詳細を続ける。
 *
 * @param name - パラメータの説明
 * @returns 戻り値の説明
 */
```

- `/** ... */` 形式を使用（`//` コメントは実装詳細のみ）
- 自明な getter/setter にも一文の概要は必ず書く
- 型参照は `{@link TypeName}` で記述する

## 型定義の方針

`@agentclientprotocol/sdk` が提供する型（`SessionModelState`、`ModelInfo`、`ModelId`、`SessionId` など）を優先的に使用する。SDK に存在しない型のみプロジェクト独自で定義する（`src/shared/ipc.ts` など）。

## 主要な依存関係

- `@agentclientprotocol/sdk` — ACP プロトコル実装（`ClientSideConnection`、型付きメッセージ）
- `electron` — デスクトップアプリフレームワーク
- `react` / `react-dom` — UI ライブラリ
- `electron-vite` — ビルドツール（Vite ベース、main・preload・renderer 統合設定）
- `electron-builder` — パッケージング（DMG・Squirrel・deb・rpm）

## PRテンプレート

Pull Request を作成する際は、`.github/pull_request_template.md` のテンプレートを必ず使用すること。

テンプレートの各セクションを埋める方針：

- **概要**: このPRで何をしたか・なぜそれをしたかを簡潔に説明する
- **変更内容**: 変更の詳細をリストアップする
- **関連Issue**: 関連するIssueがあれば `Closes #番号` の形式で記載する
- **テスト**: 追加・更新したユニットテストと手動確認の内容を記載する
- **チェックリスト**: `pnpm format:check`・`pnpm lint`・型チェックを実施し、それぞれ確認したらチェックを入れる

## タスク管理ルール

`docs/plan/` 配下のフェーズファイルにチェックボックス付きタスクがある場合、タスクを完了したら該当するチェックボックスを `[ ]` から `[x]` に更新すること。

## shadcn/ui コンポーネント

`src/renderer/components/ui/` および `src/renderer/lib/utils.ts` は `pnpm dlx shadcn@latest add` で自動生成されるファイルである。**手動で変更しないこと**。
カスタマイズは呼び出し側コンポーネントの `className` プロパティで行う（`cn()` ユーティリティを使用）。

これらのファイルは ESLint・Prettier の対象から除外している。

テーマ（カラーパレット・フォント）のカスタマイズは `src/renderer/styles/global.css` の `:root` および `.dark` セレクタ内で行う。
shadcn/ui のベストプラクティスに従い、CSS は1ファイルに統合している。

## 注意事項

- IPC境界を越えるデータはシリアライズ可能なプレーンオブジェクトのみ（関数・クラスインスタンス不可）
- `kiro-cli login` 済みであることを前提とする
- `requestPermission` は MVP では最初のオプションを自動承認
- electron-vite の設定は `electron.vite.config.ts` に統合（main・preload・renderer）
- electron-builder の設定は `electron-builder.yml` で管理
