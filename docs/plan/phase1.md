# Phase 1: スキャフォールド + テスト基盤

Electron + React + TypeScript のプロジェクト雛形を作り、テストが実行できる環境を整える。

## 関連ドキュメント

- [実装計画](../design/implementation-plan.md) — 全体のアーキテクチャと技術選定の背景
- 次フェーズ: [Phase 2 — Repository 層](./phase2.md)

## タスク

- [ ] pnpm が未インストールの場合は `npm install -g pnpm` で導入する
- [ ] Electron Forge でプロジェクトを初期化する
  - `pnpm create electron-app kiroductor --template=vite-typescript`
- [ ] レンダラー（画面側）で React が使えるよう Vite の設定を追加する
  - `vite.renderer.config.ts` に `@vitejs/plugin-react` を追加
- [ ] ソースコードのディレクトリ構造を作成する
  - `src/main/handlers/` — IPC リクエストの受け口
  - `src/main/services/` — ビジネスロジック
  - `src/main/repositories/` — メモリ上の状態管理
  - `src/main/acp/methods/` — kiro-cli から来るリクエストの処理
- [ ] `package.json` に `"packageManager": "pnpm@x.x.x"` を追加して pnpm を固定する
- [ ] テストフレームワーク（Vitest）をインストールし設定ファイルを作成する
  - `pnpm add -D vitest`
  - `vitest.config.ts` を作成
  - `package.json` に `test` / `test:watch` スクリプトを追加
- [ ] Tailwind CSS をインストール・設定する
  - `pnpm add -D tailwindcss postcss autoprefixer`
  - `tailwind.config.ts` と `postcss.config.js` を生成する
  - レンダラーの CSS エントリーポイントに `@tailwind` ディレクティブを追加する
- [ ] shadcn/ui を初期化する
  - `pnpm dlx shadcn@latest init` を実行し、スタイル・カラー・パスのプロンプトに答える
  - `components.json` が生成されることを確認する
- [ ] アプリを起動して React の "Hello World" が表示されることを確認する
- [ ] TypeScript の strict モードを有効化し、`.gitignore` を整備する
