# Phase 1: スキャフォールド + テスト基盤

Electron + React + TypeScript のプロジェクト雛形を作り、テストが実行できる環境を整える。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — 全体のアーキテクチャと技術選定の背景
- 次フェーズ: [Phase 2 — Repository 層](./phase2.md)

## タスク

- [x] pnpm が未インストールの場合は `npm install -g pnpm` で導入する
- [x] Electron Forge でプロジェクトを初期化する
  - vite-typescript テンプレート相当のファイルを手動で構成
  - `forge.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts` を作成
- [x] レンダラー（画面側）で React が使えるよう Vite の設定を追加する
  - `vite.renderer.config.ts` に `@vitejs/plugin-react` を静的 import で追加
- [x] ソースコードのディレクトリ構造を作成する
  - `src/main/handlers/` — IPC リクエストの受け口
  - `src/main/services/` — ビジネスロジック
  - `src/main/repositories/` — メモリ上の状態管理
  - `src/main/acp/methods/` — kiro-cli から来るリクエストの処理
  - `src/preload/` — contextBridge スクリプト
  - `src/renderer/` — React UI
  - > `src/shared/` は Phase 5 の IPC 配線時に実際の型が確定してから作成する
- [x] `package.json` に `"packageManager": "pnpm@10.29.3"` を追加して pnpm を固定する
- [x] テストフレームワーク（Vitest）をインストールし設定ファイルを作成する
  - `vitest.config.ts` を作成（vitest 4.x）
  - `package.json` に `test` / `test:watch` スクリプトを追加
  - テストファイルが存在しない間は `--passWithNoTests` で CI を通す
- [x] Tailwind CSS v4 をインストール・設定する
  - `pnpm add -D tailwindcss @tailwindcss/vite`
  - `postcss.config.js` / `tailwind.config.ts` は不要（v4 では `@tailwindcss/vite` プラグインが処理）
  - `vite.renderer.config.ts` にプラグインを追加
  - `src/renderer/styles/global.css` に `@import 'tailwindcss'` を追加
  - shadcn/ui 用カスタムプロパティを `@theme inline` で登録
- [x] shadcn/ui を初期化する
  - `components.json` を手動で作成（`new-york` スタイル、Tailwind v4 互換）
- [x] アプリを起動して React の "Hello World" が表示されることを確認する（`src/renderer/App.tsx`）
- [x] TypeScript の strict モードを有効化し、`.gitignore` を整備する
  - `tsconfig.json` で `"strict": true`, `"moduleResolution": "bundler"` を設定
- [x] Prettier をインストール・設定する
  - `.prettierrc` を作成（`singleQuote: true`, `semi: true`, `printWidth: 100` など）
  - `.prettierignore` を作成（`out/`, `.vite/`, `node_modules/` 等を除外）
  - `package.json` に `format` / `format:check` スクリプトを追加
- [x] ESLint をインストール・設定する
  - ESLint 9.x（flat config）を採用。ESLint 10 は `eslint-plugin-react` と非互換のため 9.x に固定
  - `eslint.config.ts`（flat config）を作成
  - `package.json` に `lint` スクリプトを追加
- [x] CI（GitHub Actions）を設定する
  - `docs/design/ci.yml` を参照し、`.github/workflows/ci.yml` としてプロジェクトルートに配置する
  - GitHub App に `workflows` 権限が必要。権限がない場合はブラウザから手動で追加する
  - 3 ジョブ構成:
    - **lint**: Prettier check + ESLint
    - **test**: `vitest run`
    - **build**: `tsc --noEmit` + 各 Vite バンドルのビルド

## 採用バージョン

| パッケージ                      | バージョン | 備考                                 |
| ------------------------------- | ---------- | ------------------------------------ |
| electron                        | 40.8.0     |                                      |
| @electron-forge/\*              | 7.11.1     |                                      |
| react / react-dom               | 19.2.4     |                                      |
| typescript                      | 5.9.3      |                                      |
| vite                            | 7.3.1      |                                      |
| vitest                          | 4.0.18     |                                      |
| tailwindcss / @tailwindcss/vite | 4.2.1      | v4 CSS-first 構成                    |
| eslint                          | 9.39.4     | 10 系は plugin 非互換のため 9 系最新 |
| prettier                        | 3.8.1      |                                      |
| @agentclientprotocol/sdk        | 0.16.0     |                                      |
