# Kiroductor 実装計画

## 1. プロジェクト構造

```
kiroductor/
├── package.json
├── tsconfig.json
├── forge.config.ts                    # Electron Forge 設定
├── vite.main.config.ts                # Vite: メインプロセス用
├── vite.preload.config.ts             # Vite: preloadスクリプト用
├── vite.renderer.config.ts            # Vite: レンダラー（React）用
├── src/
│   ├── main/
│   │   ├── main.ts                    # Electron メインプロセスエントリ
│   │   ├── ipc-handlers.ts            # IPCハンドラ登録
│   │   └── acp/
│   │       ├── acp-manager.ts         # ライフサイクル: kiro-cli acpのspawn/kill
│   │       ├── acp-session.ts         # セッション状態 + プロンプト管理
│   │       └── client-handler.ts      # acp.Client実装（fs、パーミッション）
│   ├── preload/
│   │   └── preload.ts                 # contextBridgeでIPCをレンダラーに公開
│   ├── renderer/
│   │   ├── index.html
│   │   ├── index.tsx                  # Reactエントリ
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   └── useSession.ts          # セッションライフサイクルフック
│   │   ├── components/
│   │   │   ├── ChatView.tsx           # スクロール可能な会話ビュー
│   │   │   ├── MessageBubble.tsx      # 単一メッセージ（ユーザーまたはエージェント）
│   │   │   ├── ToolCallCard.tsx       # ツール呼び出し表示（ステータス付き）
│   │   │   ├── PromptInput.tsx        # テキスト入力 + 送信
│   │   │   ├── SessionBar.tsx         # セッションステータス / コントロール
│   │   │   └── StatusIndicator.tsx    # 接続/エージェント状態
│   │   ├── types/
│   │   │   └── ipc.ts                 # 共有IPCチャネル + ペイロード型
│   │   └── styles/
│   │       └── global.css
│   └── shared/
│       └── types.ts                   # メインとレンダラー間で共有する型
├── .gitignore
└── README.md
```

## 2. コアモジュールと責務

### 2a. `src/main/acp/acp-manager.ts` — ACPプロセスマネージャ

最も重要なモジュール。`kiro-cli acp`サブプロセスと`ClientSideConnection`のライフサイクルを管理する。

**責務:**
- Node `child_process.spawn`で`kiro-cli acp`を子プロセスとして起動
- Node.jsの`Readable`/`Writable`ストリームをWebストリームに変換（ACP TS SDKは内部的に`ndJsonStream`経由でWebストリームを使用）
- `@agentclientprotocol/sdk`の`ClientSideConnection`を作成（`ClientHandler`と双方向ストリームを返すファクトリ関数を渡す）
- `connection.initialize()`を呼び出し（プロトコルバージョン、クライアント情報、クライアントケイパビリティ）
- メソッド公開: `start()`, `stop()`, `getConnection()`, `isRunning()`
- プロセスのクラッシュ/終了を処理し、UIが反応するためのイベントを発行
- `connection.closed` Promiseと`connection.signal` AbortSignalでクリーンアップ処理

### 2b. `src/main/acp/acp-session.ts` — セッションコントローラ

ACPセッションライフサイクルをラップし、IPCにブリッジする。

**責務:**
- `connection.newSession({ cwd })`でセッション作成、`sessionId`を保存
- `connection.prompt({ sessionId, prompt: [{ type: "text", text }] })`でユーザーメッセージ送信
- `prompt()`呼び出しは長時間実行リクエスト — エージェント完了時（`stopReason`付き）にのみ返る。実行中、ストリーミング更新は`ClientHandler`の`sessionUpdate`コールバック経由で到着
- メッセージログ（ユーザーメッセージ、エージェントコンテンツチャンク、ツール呼び出しの配列）を維持し、IPC経由でレンダラーに転送
- `connection.cancel({ sessionId })`でユーザーが中止したい場合に対応

### 2c. `src/main/acp/client-handler.ts` — ACPクライアント実装

エージェントがクライアントにリクエストする際にSDKが呼び出す`acp.Client`インターフェースを実装。

**実装するメソッド:**
- `sessionUpdate(notification)` — 主要なストリーミングハンドラ。`agent_message_chunk`、`tool_call`、`tool_call_update`、`plan`、`available_commands_update`、ステータス更新を受信。各通知は`BrowserWindow.webContents.send()`でレンダラーに転送
- `requestPermission(request)` — エージェントがセンシティブな操作の許可を求める時。MVP では最初のオプションを自動承認
- `readTextFile(request)` — ファイルシステムからファイル読み取り。Node `fs.readFile`使用
- `writeTextFile(request)` — ファイル書き込み。Node `fs.writeFile`使用

### 2d. `src/main/ipc-handlers.ts` — IPC登録

レンダラーが呼び出すすべての`ipcMain.handle()`と`ipcMain.on()`ハンドラを登録。

**チャネル（リクエスト/レスポンス）:**
- `acp:start` — kiro-cli acpプロセス起動
- `acp:stop` — プロセス終了
- `acp:status` — 現在の接続ステータス取得
- `session:new` — 新規セッション作成（`cwd`を受け取る）
- `session:prompt` — プロンプト送信（`text`を受け取る）
- `session:cancel` — 実行中のプロンプトをキャンセル
- `session:messages` — 現在のメッセージ履歴取得

**チャネル（プッシュ通知、main → renderer）:**
- `session:update` — ACPセッション通知の転送（エージェントチャンク、ツール呼び出し等）
- `acp:status-change` — プロセスステータス変更（connected, disconnected, error）

### 2e. `src/preload/preload.ts` — Context Bridge

`contextBridge.exposeInMainWorld`で`window.kiroductor`に型付きAPIを公開:

```typescript
interface KiroductorAPI {
  acp: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<AcpStatus>;
    onStatusChange: (callback: (status: AcpStatus) => void) => () => void;
  };
  session: {
    create: (cwd: string) => Promise<{ sessionId: string }>;
    prompt: (text: string) => Promise<{ stopReason: string }>;
    cancel: () => Promise<void>;
    getMessages: () => Promise<Message[]>;
    onUpdate: (callback: (update: SessionUpdate) => void) => () => void;
  };
}
```

`onUpdate`と`onStatusChange`メソッドは`ipcRenderer.on()`を使用し、クリーンアップ用のunsubscribe関数を返す。preloadスクリプトは`ipcRenderer`を直接公開してはならない。

## 3. IPCアーキテクチャ

データは3つのレイヤーを通過する:

```
┌─────────────────────────────────────────────────────────┐
│  Renderer Process (React)                               │
│  window.kiroductor.session.prompt("fix the bug")        │
│  window.kiroductor.session.onUpdate(handleUpdate)       │
└──────────┬──────────────────────────────────▲────────────┘
           │ ipcRenderer.invoke              │ ipcRenderer.on
           │ (リクエスト/レスポンス)            │ (プッシュ通知)
┌──────────▼──────────────────────────────────┴────────────┐
│  Preload (contextBridge)                                 │
│  型付きAPI、ipcRendererの直接公開なし                       │
└──────────┬──────────────────────────────────▲────────────┘
           │ ipcMain.handle                  │ webContents.send
┌──────────▼──────────────────────────────────┴────────────┐
│  Main Process                                            │
│  ipc-handlers.ts  ←→  acp-session.ts  ←→  acp-manager   │
│                                              │           │
│                            ClientSideConnection          │
│                            (@agentclientprotocol/sdk)    │
└──────────────────────────────────┬───────────────────────┘
                                   │ JSON-RPC 2.0 over stdio
                                   │ (ndjson stream)
┌──────────────────────────────────▼───────────────────────┐
│  kiro-cli acp  (子プロセス)                               │
│  stdin ← リクエスト     stdout → レスポンス/通知            │
└──────────────────────────────────────────────────────────┘
```

### 設計上の重要な判断

**リクエスト/レスポンス vs プッシュ:** ユーザー起点のアクション（セッション作成、プロンプト送信）は`ipcMain.handle`/`ipcRenderer.invoke`を使用しPromiseを返す。エージェントからのストリーミング更新はプッシュパターンを使用: メインプロセスで`webContents.send`、preloadで`ipcRenderer.on`、レンダラーでコールバック。これは、単一の`prompt()`呼び出しが解決前に多くのストリーミング通知をトリガーするため必要。

**プロンプト呼び出しのブロッキング:** ACP `prompt()`メソッドはエージェント完了時（`stopReason`を返す）にのみ解決。実行中、すべての中間出力は`ClientHandler`の`sessionUpdate`通知を通じて到着。`session:prompt`のIPCハンドラは`connection.prompt()`を呼び出して結果を待ち、`client-handler.ts`は独立してレンダラーに更新をストリーミングする。レンダラーはストリーミングコンテンツを即座に表示し、`prompt()` IPC呼び出しが解決した時に「完了」状態を更新。

**シリアライゼーション境界:** IPC境界を越えるすべてのデータはシリアライズ可能でなければならない（関数、クラスインスタンスは不可）。`src/shared/types.ts`の`SessionUpdate`型はプレーンオブジェクトの判別共用体にすべき。

## 4. ACPクライアント実装アプローチ

### 公式SDKの使用

`@agentclientprotocol/sdk`（現在v0.15.0）を使用。`ClientSideConnection`、すべての型付きプロトコルメッセージを提供。JSON-RPCをスクラッチで再実装しない。

### 起動と接続

```typescript
// acp-manager.ts の擬似コード
import { spawn } from "child_process";
import { Readable, Writable } from "stream";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

const proc = spawn("kiro-cli", ["acp"], { stdio: ["pipe", "pipe", "pipe"] });

// SDKはWeb ReadableStream / WritableStreamを期待する
const readStream = Readable.toWeb(proc.stdout);
const writeStream = Writable.toWeb(proc.stdin);
const stream = ndJsonStream(writeStream, readStream);

const connection = new ClientSideConnection(
  (agent) => new KiroductorClientHandler(agent, mainWindow),
  stream
);

await connection.initialize({
  protocolVersion: PROTOCOL_VERSION, // number型（現在は1）
  clientInfo: { name: "kiroductor", version: "0.1.0" },
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
  },
});
```

### ストリーミング通知

`KiroductorClientHandler.sessionUpdate()`メソッドが通知を受信。MVPで処理すべき主要な通知タイプ:

- `agent_message_chunk` — 現在のエージェントメッセージにテキストを追加; レンダラーに転送
- `tool_call` — ツール呼び出しエントリを追加（名前、入力、ステータス）; レンダラーに転送
- `tool_call_update` — ツール呼び出しの結果を更新; レンダラーに転送
- `plan` — MVPではオプションだが、タスクステータス表示に有用

### エラーハンドリング

- `proc.on("exit", ...)` — プロセスクラッシュ検出、ステータス更新、レンダラー通知
- `proc.stderr` — ログにパイプまたはデバッグパネルに表示
- `connection.closed` — Promiseベースのクリーンアップ
- すべてのIPCハンドラをtry/catchでラップし、構造化エラーを返す

## 5. UIコンポーネント

### コンポーネントツリー

```
App
├── SessionBar              # 上部バー: ステータスドット、セッションID、cwd、停止ボタン
├── ChatView                # メインスクロールエリア
│   ├── MessageBubble       # ユーザーメッセージ（右寄せ、青）
│   ├── MessageBubble       # エージェントメッセージ（左寄せ、グレー）
│   │   └── [インラインテキスト、カーソル付きストリーミング]
│   ├── ToolCallCard        # 展開可能カード（ツール名/入力/出力表示）
│   └── ... (繰り返し)
├── PromptInput             # 下部: テキストエリア + 送信ボタン、エージェント動作中は無効
└── StatusIndicator         # 接続状態オーバーレイ/バナー
```

### 状態管理

MVPではReactの`useReducer` + Context を使用 — この規模ではReduxやZustandは不要。単一の`SessionContext`が提供:

- `messages: Message[]` — 会話ログ
- `status: "idle" | "waiting" | "streaming" | "error"` — 現在のプロンプト状態
- `connectionStatus: "disconnected" | "connecting" | "connected" | "error"` — ACPプロセス状態
- `sendPrompt: (text: string) => void` — プロンプト送信
- `cancelPrompt: () => void` — 実行中のプロンプトをキャンセル

### メッセージ型（判別共用体）

```typescript
type Message =
  | { type: "user"; text: string; timestamp: number }
  | { type: "agent"; chunks: string[]; complete: boolean; timestamp: number }
  | { type: "tool_call"; toolCallId: string; name: string; rawInput?: unknown;
      rawOutput?: unknown; status: "running" | "done" | "error"; timestamp: number };
```

## 6. ビルドとDev環境

### パッケージマネージャとビルド

- **Electron Forge** + Viteプラグイン（`@electron-forge/plugin-vite`）
- 3つのVite設定: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- TypeScript `strict: true`

### 主要な依存関係

```json
{
  "dependencies": {
    "@agentclientprotocol/sdk": "^0.15.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/plugin-vite": "^7.0.0",
    "electron": "^40.0.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### 注意: Viteレンダラー設定

`@vitejs/plugin-react`はESM onlyパッケージのため、`vite.renderer.config.ts`では動的importを使用する必要がある:

```typescript
export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default;
  return { plugins: [react()] };
});
```

### スクリプト

- `npm start` — `electron-forge start`（HMR付き開発モード）
- `npm run make` — `electron-forge make`（パッケージアプリ）
- `npm run lint` — ESLint

## 7. 段階的実装順序

### Phase 1: スキャフォールド

1. Electron Forgeでプロジェクト初期化: `npx create-electron-app kiroductor --template=vite-typescript`
2. レンダラーVite設定にReactを追加
3. `src/main/`, `src/preload/`, `src/renderer/`のディレクトリ構造作成
4. 空のElectronウィンドウでReact "Hello World"表示確認
5. TypeScript strictモード、`.gitignore`設定

### Phase 2: ACP接続

6. `@agentclientprotocol/sdk`インストール
7. `acp-manager.ts`実装: `kiro-cli acp`起動、`ClientSideConnection`作成、`initialize()`呼び出し
8. `client-handler.ts`実装（`sessionUpdate`, `readTextFile`, `writeTextFile`, `requestPermission`のスタブ）
9. 手動テスト: プロセス起動、初期化ハンドシェイク完了、接続確認
10. エラーハンドリング追加: プロセス終了、stderrログ、接続クローズ

### Phase 3: セッション + プロンプト

11. `acp-session.ts`実装: `createSession()`, `sendPrompt()`, `cancel()`
12. `client-handler.ts`の`sessionUpdate`でメッセージ蓄積実装
13. `ipc-handlers.ts`配線: すべてのIPCチャネル登録
14. `preload.ts`実装: 型付き`window.kiroductor` API公開
15. エンドツーエンドテスト: レンダラーからセッション作成、"hello"送信、ストリーミングレスポンス確認

### Phase 4: チャットUI

16. `PromptInput`コンポーネント（テキストエリア、送信ボタン、無効状態）
17. `MessageBubble`コンポーネント（ユーザー vs エージェントスタイリング、ストリーミングテキスト追加）
18. `ToolCallCard`コンポーネント（展開可能、ツール名/入力/出力表示）
19. `ChatView`コンポーネント（スクロール可能コンテナ、新コンテンツで自動スクロール）
20. `SessionBar`（ステータスインジケーター、セッションコントロール）
21. `useSession`フック接続

### Phase 5: ポリッシュとエッジケース

22. エージェントプロセスクラッシュの graceful ハンドリング
23. キャンセルボタン実装
24. 自動スクロール動作（ユーザーが上にスクロールした場合は追従しない）
25. パーミッションリクエストのハンドリング
26. `cwd`選択用ディレクトリピッカー
27. キーボードショートカット（Enter送信、Shift+Enter改行、Escキャンセル）

### Phase 6: （将来、MVP後）

- 複数セッション / タブ
- 並列エージェント実行
- セッション永続化 / リロード
- エージェントが書いたファイルのdiffビューア
- 設定パネル（kiro-cliパス、テーマ）

## 8. 主要な技術判断とトレードオフ

| 判断 | 選択 | 理由 | トレードオフ |
|------|------|------|------------|
| ACP SDK vs 自前JSON-RPC | 公式SDK使用 | `ClientSideConnection`、型付きメッセージ、`ndJsonStream`トランスポートを提供。再実装は無駄 | pre-1.0パッケージへの依存。`acp-manager.ts`でラップして変更を局所化 |
| Electron Forge + Vite | Forge + Viteプラグイン | 公式推奨ビルドツール。Viteプラグインで高速HMR | 3つのVite設定ファイルが必要だが、適切なプロセス分離を提供 |
| ストリーミング方式 | `webContents.send`によるプッシュ | エージェントの通知をUIに即座に表示する必要がある。ポーリングはレイテンシと複雑性を追加 | preloadスクリプトでイベントリスナーのクリーンアップに注意が必要 |
| 状態管理 | `useReducer` + Context | 単一セッション+メッセージリストの規模にはReact組み込みで十分 | マルチセッション対応時にはZustandへのアップグレードが必要 |
| パーミッション処理 | MVPでは自動承認 | 開発速度優先 | セキュリティ低下。将来的に承認/拒否ダイアログを追加 |
| 認証 | 延期 | `kiro-cli login`済みを前提。OAuth実装はMVPの範囲外 | 未ログイン時のUXが悪い |
