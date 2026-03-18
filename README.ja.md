# Kiroductor

**[kiro-cli](https://github.com/mzkmnk/kiro-cli) のための、モダンな AI コーディングデスクトップクライアント**

Kiroductor は、AI コーディングエージェントの力をデスクトップに届けます。コードの読み取り・書き込み・リファクタリングが可能な AI アシスタントと、クリーンで直感的なインターフェースを通じて対話できます。[Agent Client Protocol (ACP)](https://github.com/nicepkg/agent-client-protocol) をベースに構築されています。

[English](./README.md) | [日本語](./readme.md)

<!-- TODO: スクリーンショットを追加 -->
<!-- ![Kiroductor スクリーンショット](docs/assets/screenshot.png) -->

## 特徴

### マルチセッション対話

複数の AI セッションを並行して実行でき、それぞれ独立した会話履歴を持ちます。セッション間の切り替えはシームレスで、スクロール位置やコンテキストが保持されます。

### Git ワークツリー連携

コンフリクトを気にせず、複数のブランチで同時に作業できます。Kiroductor が Git ワークツリーを裏側で管理し、AI エージェントが独立したブランチ上で変更を行う間も、あなたはメインブランチでの作業を続けられます。

### リアルタイムストリーミング応答

AI の思考と応答をリアルタイムで確認できます。シンタックスハイライト付きのコードブロックや Markdown レンダリングによるストリーミング応答で、自然でスピーディな対話を実現します。

### スプリット Diff ビューア

AI が行ったすべての変更をコミット前にレビューできます。内蔵のスプリット Diff ビューアが、影響を受けるすべてのファイルの挿入・削除・変更を表示し、常にあなたがコントロールを握れます。

### ツールコールの透明性

AI エージェントが何をしているか、正確に把握できます。すべてのファイル読み取り・書き込み・ツール実行が展開可能なカードとして表示され、エージェントのアクションを完全に可視化します。

### モデル選択

利用可能な AI モデルから選択し、会話の途中でも切り替えが可能です。スピードを重視するか、深い分析を求めるか — タスクに最適なモデルを選べます。

## はじめかた

### 前提条件

- [kiro-cli](https://github.com/mzkmnk/kiro-cli) がインストール済みで認証済みであること（`kiro-cli login`）
- Node.js 20+
- pnpm 10+

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/mzkmnk/kiroductor.git
cd kiroductor

# 依存関係をインストール
pnpm install

# 開発モードでアプリを起動
pnpm start
```

### ビルド

```bash
# アプリケーションをビルド
pnpm build

# プラットフォーム向けにパッケージング
pnpm make
```

## 仕組み

Kiroductor は **Agent Client Protocol (ACP)** — stdio 上の JSON-RPC 2.0 ベースのプロトコル — を通じて kiro-cli のクライアントとして動作します。セッション開始時に kiro-cli をサブプロセスとして起動し、構造化されたメッセージでやり取りします。

```
あなた  →  Kiroductor (Electron)  →  kiro-cli (ACP)  →  AI モデル
```

AI エージェントができること：

- リポジトリ内のファイルの読み書き
- コマンドやツールの実行
- Git ブランチの作成・管理
- コードブロックを含むリッチな Markdown での応答

すべてのアクションにはあなたの承認が必要なため、常に主導権はあなたにあります。

## 技術スタック

| コンポーネント             | 技術                        |
| -------------------------- | --------------------------- |
| デスクトップフレームワーク | Electron                    |
| UI                         | React + TypeScript          |
| スタイリング               | Tailwind CSS + shadcn/ui    |
| ビルドツール               | electron-vite (Vite)        |
| プロトコル                 | Agent Client Protocol (ACP) |
| パッケージング             | electron-builder            |

## コントリビューション

コントリビューション大歓迎です！上記の開発セットアップを参考にしてください。

```bash
pnpm test          # ユニットテスト実行
pnpm lint          # ESLint 実行
pnpm format:check  # フォーマット確認
pnpm typecheck     # 型チェック
```

## ライセンス

[MIT](LICENSE)
