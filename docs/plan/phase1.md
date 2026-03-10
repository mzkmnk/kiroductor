# Phase 1: スキャフォールド + テスト基盤

Electron + React + TypeScript のプロジェクト雛形を作り、テストが実行できる環境を整える。

## タスク

- [ ] Electron Forge でプロジェクトを初期化する
  - `npx create-electron-app kiroductor --template=vite-typescript`
- [ ] レンダラー（画面側）で React が使えるよう Vite の設定を追加する
  - `vite.renderer.config.ts` に `@vitejs/plugin-react` を追加
- [ ] ソースコードのディレクトリ構造を作成する
  - `src/main/handlers/` — IPC リクエストの受け口
  - `src/main/services/` — ビジネスロジック
  - `src/main/repositories/` — メモリ上の状態管理
  - `src/main/acp/methods/` — kiro-cli から来るリクエストの処理
- [ ] テストフレームワーク（Vitest）をインストールし設定ファイルを作成する
  - `vitest.config.ts` を作成
  - `package.json` に `test` / `test:watch` スクリプトを追加
- [ ] アプリを起動して React の "Hello World" が表示されることを確認する
- [ ] TypeScript の strict モードを有効化し、`.gitignore` を整備する
