# kiroductor

kiro-cli の ACP（Agent Client Protocol）クライアントとして動作する Electron アプリ。

## プロジェクト概要

- **技術スタック**: Electron + React（TypeScript）+ Vite + Electron Forge
- **パッケージマネージャ**: pnpm
- **アーキテクチャ**: Handler / Service / Repository の3層構造（メインプロセス）

## コマンド

```bash
pnpm install          # 依存関係のインストール
pnpm start            # 開発サーバー起動（electron-forge start、HMR付き）
pnpm test             # テスト実行（vitest run）
pnpm test:watch       # テスト ウォッチモード
pnpm lint             # ESLint による静的解析
pnpm format           # Prettier によるフォーマット適用
pnpm format:check     # フォーマット確認（CI用）
pnpm make             # アプリパッケージ生成
```

## アーキテクチャ

### ディレクトリ構造

```
src/
├── main/                    # Electron メインプロセス
│   ├── main.ts              # エントリポイント + Composition Root
│   ├── handlers/            # IPC受付・バリデーション（Electron依存）
│   ├── services/            # ビジネスロジック（Electron非依存）
│   ├── repositories/        # インメモリ状態管理
│   └── acp/                 # ACP クライアント実装
│       ├── client-handler.ts
│       └── methods/         # 各ACPメソッド（1ファイル1メソッド）
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

| 層 | 責務 | Electron依存 |
|---|---|---|
| **Handler** | IPCチャネル受付、バリデーション、Service呼び出し | あり |
| **Service** | ビジネスロジック、ACP SDK操作 | なし |
| **Repository** | インメモリ状態管理（副作用なし） | なし |

### IPC チャネル

- `acp:start` / `acp:stop` / `acp:status` — ACP接続管理
- `session:new` / `session:prompt` / `session:cancel` / `session:messages` — セッション管理

## テスト戦略

Vitest を採用。コンストラクタインジェクションにより各層を独立してテスト可能。

| 層 | テスト方針 |
|---|---|
| **Repository** | モックなし、純粋な状態操作を直接テスト |
| **ACP Methods** | Repository・NotificationService・fs をモック注入 |
| **Service** | Repository と ClientSideConnection をモック注入 |
| **Handler** | Service をモックして IPC→Service の委譲を検証 |

## コード品質

- **TypeScript**: `strict: true`
- **ESLint**: flat config（`eslint.config.ts`）、React/TypeScript ルール
- **Prettier**: コードフォーマッター
- **Vitest**: ユニットテスト

## 主要な依存関係

- `@agentclientprotocol/sdk` — ACP プロトコル実装（`ClientSideConnection`、型付きメッセージ）
- `electron` — デスクトップアプリフレームワーク
- `react` / `react-dom` — UI ライブラリ
- `vite` — バンドラー（メイン・preload・レンダラー用に3設定）

## 注意事項

- IPC境界を越えるデータはシリアライズ可能なプレーンオブジェクトのみ（関数・クラスインスタンス不可）
- `kiro-cli login` 済みであることを前提とする
- `requestPermission` は MVP では最初のオプションを自動承認
- vite.renderer.config.ts は `@vitejs/plugin-react` が ESM only のため動的 import を使用
