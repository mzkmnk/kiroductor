# Phase 1: スキャフォールド + テスト基盤

## タスク

- [ ] Electron Forge でプロジェクト初期化
  ```
  npx create-electron-app kiroductor --template=vite-typescript
  ```
- [ ] レンダラー Vite 設定に React を追加
  - `vite.renderer.config.ts` で `@vitejs/plugin-react` を動的 import で追加（ESM only パッケージのため）
- [ ] ディレクトリ構造を作成
  - `src/main/handlers/`
  - `src/main/services/`
  - `src/main/repositories/`
  - `src/main/acp/methods/`
- [ ] Vitest をインストール・設定
  - `vitest.config.ts` を作成
  - `package.json` にスクリプト追加（`test`, `test:watch`）
- [ ] 空の Electron ウィンドウで React "Hello World" 表示確認
- [ ] TypeScript strict モード有効化・`.gitignore` 設定
