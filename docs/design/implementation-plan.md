# Kiroductor 実装計画

## 1. プロジェクト構造

```
kiroductor/
├── package.json
├── tsconfig.json
├── vitest.config.ts                   # Vitest 設定
├── forge.config.ts                    # Electron Forge 設定
├── vite.main.config.ts                # Vite: メインプロセス用
├── vite.preload.config.ts             # Vite: preloadスクリプト用
├── vite.renderer.config.ts            # Vite: レンダラー（React）用
├── src/
│   ├── main/
│   │   ├── main.ts                    # Electron メインプロセスエントリ
│   │   │
│   │   ├── handlers/                  # Handler層: IPC受付、入力バリデーション
│   │   │   ├── acp.handler.ts         # acp:start, acp:stop, acp:status
│   │   │   ├── session.handler.ts     # session:new, session:prompt, session:cancel, session:messages
│   │   │   └── index.ts              # 全handlerの一括登録
│   │   │
│   │   ├── services/                  # Service層: ビジネスロジック
│   │   │   ├── acp-connection.service.ts      # ACP接続ライフサイクル（spawn, initialize, stop）
│   │   │   ├── session.service.ts             # セッション管理（create, cancel）
│   │   │   ├── prompt.service.ts              # プロンプト送信 + ストリーミング制御
│   │   │   └── notification.service.ts        # レンダラーへの通知転送
│   │   │
│   │   ├── repositories/             # Repository層: 状態管理・データアクセス
│   │   │   ├── connection.repository.ts       # ACP接続状態（connection, process, status）
│   │   │   ├── session.repository.ts          # セッション状態（sessionId）
│   │   │   └── message.repository.ts          # メッセージ履歴の蓄積・取得
│   │   │
│   │   └── acp/                       # ACPクライアント実装（agent→client メソッド）
│   │       ├── client-handler.ts      # acp.Client インターフェースのルーター
│   │       ├── methods/               # 各メソッドを1ファイルに分離
│   │       │   ├── session-update.ts          # sessionUpdate 通知処理
│   │       │   ├── request-permission.ts      # requestPermission 処理
│   │       │   ├── read-text-file.ts          # readTextFile 処理
│   │       │   └── write-text-file.ts         # writeTextFile 処理
│   │       └── __tests__/             # ACPメソッド単体テスト
│   │           ├── session-update.test.ts
│   │           ├── request-permission.test.ts
│   │           ├── read-text-file.test.ts
│   │           └── write-text-file.test.ts
│   │
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

## 2. バックエンド（メインプロセス）アーキテクチャ

### 設計方針

バックエンドを **Handler / Service / Repository** の3層に分離し、各ACPメソッドをファイル単位で独立させる。これにより:

- 各メソッドを個別にユニットテスト可能
- 依存関係の注入でモック差し替えが容易
- 各層の責務が明確で変更の影響範囲が限定的

```
┌─────────────────────────────────────────────────────────────┐
│  IPC (Electron ipcMain)                                     │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  Handler層                                                   │
│  IPCチャネルの受付、入力バリデーション、Serviceの呼び出し        │
│  ※ Electron依存はここに閉じ込める                              │
├─────────────────────────────────────────────────────────────┤
│  acp.handler.ts        session.handler.ts                    │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  Service層                                                   │
│  ビジネスロジック、ACP SDK操作、ワークフロー制御                 │
│  ※ Electron非依存、純粋なTypeScript                           │
├─────────────────────────────────────────────────────────────┤
│  acp-connection.service    session.service                    │
│  prompt.service            notification.service               │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  Repository層                                                │
│  状態の保持・取得・更新（インメモリストア）                      │
│  ※ 純粋なデータアクセス、副作用なし                             │
├─────────────────────────────────────────────────────────────┤
│  connection.repository    session.repository                  │
│  message.repository                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2a. Handler層 — `src/main/handlers/`

IPCチャネルを受け付け、入力バリデーション後にServiceを呼び出す薄いレイヤー。Electron（`ipcMain`, `BrowserWindow`）への依存はこの層に閉じ込める。

#### `acp.handler.ts`

```typescript
// 登録するIPCチャネル:
// acp:start  → acpConnectionService.start()
// acp:stop   → acpConnectionService.stop()
// acp:status → connectionRepository.getStatus()
```

#### `session.handler.ts`

```typescript
// 登録するIPCチャネル:
// session:new      → sessionService.create(cwd)
// session:prompt   → promptService.send(text)
// session:cancel   → sessionService.cancel()
// session:messages → messageRepository.getAll()
```

#### `index.ts`

```typescript
// 全handlerの一括登録エントリポイント
export function registerAllHandlers(deps: HandlerDependencies): void {
  registerAcpHandlers(deps);
  registerSessionHandlers(deps);
}
```

**テスト方針:** Handler層のテストは薄い統合テストで行う。`ipcMain`をモックして、正しいServiceメソッドが呼ばれることを検証。

### 2b. Service層 — `src/main/services/`

ビジネスロジックを担当。Electron非依存の純粋なTypeScriptクラス。コンストラクタインジェクションでRepositoryや他のServiceを受け取る。

#### `acp-connection.service.ts`

```typescript
class AcpConnectionService {
  constructor(
    private connectionRepo: ConnectionRepository,
    private notificationService: NotificationService,
  ) {}

  async start(): Promise<void>;
  // kiro-cli acp を spawn
  // ClientSideConnection を作成
  // connection.initialize() を呼び出し
  // connectionRepo に connection と process を保存
  // プロセスのexit/errorイベントをハンドリング

  async stop(): Promise<void>;
  // プロセスを kill
  // connectionRepo をクリア
}
```

#### `session.service.ts`

```typescript
class SessionService {
  constructor(
    private connectionRepo: ConnectionRepository,
    private sessionRepo: SessionRepository,
    private messageRepo: MessageRepository,
  ) {}

  async create(cwd: string): Promise<string>;
  // connection.newSession({ cwd, mcpServers: [] })
  // sessionRepo に sessionId を保存
  // messageRepo をリセット

  async cancel(): Promise<void>;
  // connection.cancel({ sessionId })
}
```

#### `prompt.service.ts`

```typescript
class PromptService {
  constructor(
    private connectionRepo: ConnectionRepository,
    private sessionRepo: SessionRepository,
    private messageRepo: MessageRepository,
  ) {}

  async send(text: string): Promise<PromptResult>;
  // messageRepo にユーザーメッセージを追加
  // messageRepo に空のエージェントメッセージを追加
  // connection.prompt({ sessionId, prompt: [...] }) を呼び出し（ブロッキング）
  // 完了後、エージェントメッセージを complete にマーク
  // stopReason を返す
}
```

#### `notification.service.ts`

```typescript
class NotificationService {
  constructor(private getWindow: () => BrowserWindow | null) {}

  sendToRenderer(channel: string, data: unknown): void;
  // BrowserWindow.webContents.send() のラッパー
  // ウィンドウが存在しない / destroyed の場合は無視
}
```

**テスト方針:** Service層が主要なテスト対象。Repositoryをモックして注入し、ロジックを検証する。ACP SDKの`ClientSideConnection`もモック可能。

### 2c. Repository層 — `src/main/repositories/`

インメモリの状態管理。純粋なデータアクセスレイヤーで副作用を持たない。テスト時にそのまま使える（モック不要のケースが多い）。

#### `connection.repository.ts`

```typescript
class ConnectionRepository {
  private connection: ClientSideConnection | null = null;
  private process: ChildProcess | null = null;
  private status: AcpStatus = 'disconnected';
  private stderrBuffer: string[] = [];

  getConnection(): ClientSideConnection | null;
  setConnection(conn: ClientSideConnection | null): void;
  getProcess(): ChildProcess | null;
  setProcess(proc: ChildProcess | null): void;
  getStatus(): AcpStatus;
  setStatus(status: AcpStatus): void;
  appendStderr(line: string): void;
  getStderrLogs(): string[];
  clear(): void;
}
```

#### `session.repository.ts`

```typescript
class SessionRepository {
  private sessionId: string | null = null;

  getSessionId(): string | null;
  setSessionId(id: string | null): void;
  hasActiveSession(): boolean;
}
```

#### `message.repository.ts`

```typescript
class MessageRepository {
  private messages: Message[] = [];

  getAll(): Message[];
  addUserMessage(text: string): void;
  addAgentMessage(): void;
  appendAgentChunk(text: string): void;
  completeAgentMessage(): void;
  addToolCall(toolCallId: string, name: string, rawInput?: unknown): void;
  updateToolCall(toolCallId: string, updates: Partial<ToolCallMessage>): void;
  clear(): void;
}
```

**テスト方針:** Repository層は状態管理のみなので、モックなしで直接テスト。add/get/update/clearの動作を検証。

### 2d. ACPクライアント実装 — `src/main/acp/`

`acp.Client`インターフェースの実装。各メソッドを個別ファイルに分離し、`client-handler.ts`がルーターとして各メソッドに委譲する。

#### `client-handler.ts` — ルーター

```typescript
class KiroductorClientHandler implements Client {
  constructor(
    private agent: Agent,
    private sessionUpdateMethod: SessionUpdateMethod,
    private requestPermissionMethod: RequestPermissionMethod,
    private readTextFileMethod: ReadTextFileMethod,
    private writeTextFileMethod: WriteTextFileMethod,
  ) {}

  async sessionUpdate(params: SessionNotification): Promise<void> {
    return this.sessionUpdateMethod.handle(params);
  }

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return this.requestPermissionMethod.handle(params);
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    return this.readTextFileMethod.handle(params);
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    return this.writeTextFileMethod.handle(params);
  }
}
```

#### `methods/session-update.ts`

```typescript
class SessionUpdateMethod {
  constructor(
    private messageRepo: MessageRepository,
    private notificationService: NotificationService,
  ) {}

  async handle(params: SessionNotification): Promise<void>;
  // params.update.sessionUpdate で分岐:
  //   "agent_message_chunk" → messageRepo.appendAgentChunk() + レンダラー通知
  //   "tool_call"           → messageRepo.addToolCall() + レンダラー通知
  //   "tool_call_update"    → messageRepo.updateToolCall() + レンダラー通知
  //   その他                 → レンダラーに転送のみ
}
```

#### `methods/request-permission.ts`

```typescript
class RequestPermissionMethod {
  constructor(private notificationService: NotificationService) {}

  async handle(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  // MVP: 最初のオプションを自動承認
  // レンダラーに承認通知を送信
  // { outcome: { outcome: "selected", optionId: firstOption.optionId } } を返す
}
```

#### `methods/read-text-file.ts`

```typescript
class ReadTextFileMethod {
  constructor(private fs: { readFile: typeof fsPromises.readFile }) {}

  async handle(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  // fs.readFile(params.path, "utf-8")
  // { content } を返す
}
```

> **注意:** `ReadTextFileRequest` には `limit`（最大行数）と `line`（開始行番号、1-based）のオプションフィールドが存在する。MVP では無視してファイル全体を返す実装で問題ないが、kiro-cli が部分読み込みを要求した場合に対応できない。将来的に対応が必要になる可能性がある。

#### `methods/write-text-file.ts`

```typescript
class WriteTextFileMethod {
  constructor(private fs: { writeFile: typeof fsPromises.writeFile }) {}

  async handle(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  // fs.writeFile(params.path, params.content, "utf-8")
  // {} を返す
}
```

**テスト方針:** 各メソッドファイルを独立してユニットテスト。依存（Repository、NotificationService、fs）はすべてコンストラクタ注入なのでモック差し替えが容易。

### 2e. 依存関係の組み立て — `src/main/main.ts`

アプリ起動時に全インスタンスを生成し、依存関係を注入する（Composition Root パターン）。

```typescript
// main.ts（擬似コード）
const connectionRepo = new ConnectionRepository();
const sessionRepo = new SessionRepository();
const messageRepo = new MessageRepository();

const notificationService = new NotificationService(() => mainWindow);
const acpConnectionService = new AcpConnectionService(connectionRepo, notificationService);
const sessionService = new SessionService(connectionRepo, sessionRepo, messageRepo);
const promptService = new PromptService(connectionRepo, sessionRepo, messageRepo);

// ACPメソッドの組み立て
const sessionUpdateMethod = new SessionUpdateMethod(messageRepo, notificationService);
const requestPermissionMethod = new RequestPermissionMethod(notificationService);
const readTextFileMethod = new ReadTextFileMethod(fs);
const writeTextFileMethod = new WriteTextFileMethod(fs);

// Handler登録
registerAllHandlers({
  acpConnectionService,
  sessionService,
  promptService,
  connectionRepo,
  messageRepo,
});
```

### 2f. `src/preload/preload.ts` — Context Bridge

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
│                                                          │
│  ┌─ Handler層 ────────────────────────────────────────┐  │
│  │  acp.handler ←→ session.handler                    │  │
│  └───────────┬────────────────────────────────────────┘  │
│              │                                           │
│  ┌─ Service層 ────────────────────────────────────────┐  │
│  │  acp-connection.service  session.service            │  │
│  │  prompt.service          notification.service       │  │
│  └───────────┬────────────────────────────────────────┘  │
│              │                                           │
│  ┌─ Repository層 ─────────────────────────────────────┐  │
│  │  connection.repo  session.repo  message.repo       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ ACP Client (agent→client) ────────────────────────┐  │
│  │  client-handler.ts → methods/                      │  │
│  │    session-update │ request-permission              │  │
│  │    read-text-file │ write-text-file                 │  │
│  └───────────┬────────────────────────────────────────┘  │
│              │                                           │
│         ClientSideConnection                             │
│         (@agentclientprotocol/sdk)                       │
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
// acp-connection.service.ts の擬似コード
import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

const proc = spawn('kiro-cli', ['acp'], { stdio: ['pipe', 'pipe', 'pipe'] });

// SDKはWeb ReadableStream / WritableStreamを期待する
const readStream = Readable.toWeb(proc.stdout);
const writeStream = Writable.toWeb(proc.stdin);
const stream = ndJsonStream(writeStream, readStream);

const connection = new ClientSideConnection(
  (agent) =>
    new KiroductorClientHandler(
      agent,
      sessionUpdateMethod,
      requestPermissionMethod,
      readTextFileMethod,
      writeTextFileMethod,
    ),
  stream,
);

await connection.initialize({
  protocolVersion: PROTOCOL_VERSION, // number型（現在は1）
  clientInfo: { name: 'kiroductor', version: '0.1.0' },
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
  },
});

// connectionRepo に保存
this.connectionRepo.setConnection(connection);
this.connectionRepo.setProcess(proc);
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
  | { type: 'user'; text: string; timestamp: number }
  | { type: 'agent'; chunks: string[]; complete: boolean; timestamp: number }
  | {
      type: 'tool_call';
      toolCallId: string;
      name: string;
      rawInput?: unknown;
      rawOutput?: unknown;
      status: 'running' | 'done' | 'error';
      timestamp: number;
    };
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
    "vite": "^5.0.0",
    "vitest": "^3.0.0",
    "prettier": "^3.0.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react": "^7.0.0",
    "eslint-plugin-react-hooks": "^5.0.0"
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

- `pnpm start` — `electron-forge start`（HMR付き開発モード）
- `pnpm make` — `electron-forge make`（パッケージアプリ）
- `pnpm test` — `vitest run`（テスト実行）
- `pnpm test:watch` — `vitest`（ウォッチモード）
- `pnpm lint` — `eslint .`（ESLint）
- `pnpm format` — `prettier --write .`（フォーマット適用）
- `pnpm format:check` — `prettier --check .`（フォーマット確認、CI用）

### コード品質ツール

| ツール         | 用途                         | 設定ファイル                      |
| -------------- | ---------------------------- | --------------------------------- |
| **Prettier**   | コードフォーマット           | `.prettierrc`, `.prettierignore`  |
| **ESLint**     | 静的解析                     | `eslint.config.ts`（flat config） |
| **TypeScript** | 型チェック（`strict: true`） | `tsconfig.json`                   |
| **Vitest**     | ユニットテスト               | `vitest.config.ts`                |

#### ESLint 主要プラグイン

- `@eslint/js` — ESLint 組み込みルール
- `typescript-eslint` — TypeScript 対応
- `eslint-plugin-react` — React ルール
- `eslint-plugin-react-hooks` — Hooks のルール（exhaustive-deps 等）

### CI（GitHub Actions）

`.github/workflows/ci.yml` で以下の3ジョブを並列実行:

```
push / PR → main
         ├── [lint]  Prettier check + ESLint
         ├── [test]  vitest run
         └── [build] tsc --noEmit + Vite bundles ×3
```

> **注意:** `electron-forge make` は実行バイナリ生成まで行うため CI では省略し、型チェックと Vite バンドルのビルドのみを検証する。バイナリ生成は別途 release ワークフローで対応する。

## 7. 段階的実装順序

### Phase 1: スキャフォールド + テスト基盤

1. Electron Forgeでプロジェクト初期化: `npx create-electron-app kiroductor --template=vite-typescript`
2. レンダラーVite設定にReactを追加
3. `src/main/handlers/`, `src/main/services/`, `src/main/repositories/`, `src/main/acp/methods/` のディレクトリ構造作成
4. Vitest インストール・設定（`vitest.config.ts`）
5. 空のElectronウィンドウでReact "Hello World"表示確認
6. TypeScript strictモード、`.gitignore`設定

### Phase 2: Repository層 + テスト

7. `connection.repository.ts` 実装 + テスト
8. `session.repository.ts` 実装 + テスト
9. `message.repository.ts` 実装 + テスト
   - addUserMessage, addAgentMessage, appendAgentChunk, completeAgentMessage
   - addToolCall, updateToolCall
   - getAll, clear

### Phase 3: ACPメソッド（agent→client）+ テスト

10. `methods/read-text-file.ts` 実装 + テスト（fsモック注入）
11. `methods/write-text-file.ts` 実装 + テスト（fsモック注入）
12. `methods/request-permission.ts` 実装 + テスト（NotificationServiceモック）
13. `methods/session-update.ts` 実装 + テスト（MessageRepository + NotificationServiceモック）
14. `client-handler.ts` ルーター実装（各メソッドに委譲するだけ）

### Phase 4: Service層 + テスト

15. `notification.service.ts` 実装
16. `acp-connection.service.ts` 実装 + テスト（spawn/connection のモック）
17. `session.service.ts` 実装 + テスト（ConnectionRepo + SessionRepo モック）
18. `prompt.service.ts` 実装 + テスト（ConnectionRepo + MessageRepo モック）

### Phase 5: Handler層 + IPC配線

19. `acp.handler.ts` 実装（ipcMain.handle → Service呼び出し）
20. `session.handler.ts` 実装（ipcMain.handle → Service呼び出し）
21. `handlers/index.ts` で一括登録
22. `main.ts` で Composition Root（全インスタンス生成 + DI）
23. `preload.ts` 実装: 型付き`window.kiroductor` API公開
24. エンドツーエンドテスト: レンダラーからセッション作成、"hello"送信、ストリーミングレスポンス確認

### Phase 6: チャットUI

25. `PromptInput`コンポーネント（テキストエリア、送信ボタン、無効状態）
26. `MessageBubble`コンポーネント（ユーザー vs エージェントスタイリング、ストリーミングテキスト追加）
27. `ToolCallCard`コンポーネント（展開可能、ツール名/入力/出力表示）
28. `ChatView`コンポーネント（スクロール可能コンテナ、新コンテンツで自動スクロール）
29. `SessionBar`（ステータスインジケーター、セッションコントロール）
30. `useSession`フック接続

### Phase 7: ポリッシュとエッジケース

31. エージェントプロセスクラッシュの graceful ハンドリング
32. キャンセルボタン実装
33. 自動スクロール動作（ユーザーが上にスクロールした場合は追従しない）
34. パーミッションリクエストのハンドリング
35. `cwd`選択用ディレクトリピッカー
36. キーボードショートカット（Enter送信、Shift+Enter改行、Escキャンセル）

### Phase 8: （将来、MVP後）

- 複数セッション / タブ
- 並列エージェント実行
- セッション永続化 / リロード
- エージェントが書いたファイルのdiffビューア
- 設定パネル（kiro-cliパス、テーマ）

## 8. テスト戦略

### テストフレームワーク

**Vitest** を採用。Viteベースのプロジェクトとの相性が良く、TypeScript サポートが組み込み。

### テスト対象とアプローチ

```
テストピラミッド:

    ╱  E2E  ╲         手動テスト（Electron起動 + kiro-cli acp）
   ╱─────────╲
  ╱ Handler   ╲       薄い統合テスト（ipcMainモック → Service呼び出し検証）
 ╱─────────────╲
╱   Service     ╲     主要テスト対象（Repository/依存モック → ロジック検証）
╱─────────────────╲
╱ ACP Methods       ╲  メソッド単位ユニットテスト（依存モック → 入出力検証）
╱─────────────────────╲
╱   Repository           ╲  モック不要の純粋テスト（状態操作の検証）
```

### 層別テスト方針

| 層              | テストファイル配置        | モック対象                          | テスト内容                            |
| --------------- | ------------------------- | ----------------------------------- | ------------------------------------- |
| **Repository**  | `repositories/__tests__/` | なし（純粋な状態管理）              | add/get/update/clear の動作           |
| **ACP Methods** | `acp/__tests__/`          | Repository, NotificationService, fs | 各メソッドの入力→出力、副作用呼び出し |
| **Service**     | `services/__tests__/`     | Repository, ClientSideConnection    | ビジネスロジック、エラーハンドリング  |
| **Handler**     | `handlers/__tests__/`     | Service                             | IPC → Service 委譲の検証              |

### ACPメソッドのテスト例

```typescript
// acp/__tests__/read-text-file.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ReadTextFileMethod } from '../methods/read-text-file';

describe('ReadTextFileMethod', () => {
  it('指定パスのファイル内容を返す', async () => {
    const mockFs = {
      readFile: vi.fn().mockResolvedValue('file content'),
    };
    const method = new ReadTextFileMethod(mockFs);

    const result = await method.handle({
      path: '/tmp/test.txt',
      sessionId: 'sess-1',
    });

    expect(mockFs.readFile).toHaveBeenCalledWith('/tmp/test.txt', 'utf-8');
    expect(result).toEqual({ content: 'file content' });
  });

  it('存在しないファイルでエラーを投げる', async () => {
    const mockFs = {
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    };
    const method = new ReadTextFileMethod(mockFs);

    await expect(method.handle({ path: '/tmp/no.txt', sessionId: 'sess-1' })).rejects.toThrow(
      'ENOENT',
    );
  });
});
```

```typescript
// acp/__tests__/session-update.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SessionUpdateMethod } from '../methods/session-update';
import { MessageRepository } from '../../repositories/message.repository';

describe('SessionUpdateMethod', () => {
  it('agent_message_chunk でメッセージにチャンクを追加する', async () => {
    const messageRepo = new MessageRepository();
    messageRepo.addAgentMessage();
    const notificationService = { sendToRenderer: vi.fn() };

    const method = new SessionUpdateMethod(messageRepo, notificationService);
    await method.handle({
      sessionId: 'sess-1',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Hello' },
      },
    });

    const messages = messageRepo.getAll();
    expect(messages[0].type).toBe('agent');
    if (messages[0].type === 'agent') {
      expect(messages[0].chunks).toEqual(['Hello']);
    }
    expect(notificationService.sendToRenderer).toHaveBeenCalled();
  });

  it('tool_call でツール呼び出しを追加する', async () => {
    const messageRepo = new MessageRepository();
    const notificationService = { sendToRenderer: vi.fn() };

    const method = new SessionUpdateMethod(messageRepo, notificationService);
    await method.handle({
      sessionId: 'sess-1',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tc-1',
        name: 'edit_file',
        status: 'running',
      },
    });

    const messages = messageRepo.getAll();
    expect(messages[0].type).toBe('tool_call');
    if (messages[0].type === 'tool_call') {
      expect(messages[0].name).toBe('edit_file');
      expect(messages[0].status).toBe('running');
    }
  });
});
```

### DI によるテスタビリティの確保

各クラスはコンストラクタで依存を受け取る。テスト時はモックを注入:

```typescript
// Service テストの例
const mockConnectionRepo = {
  getConnection: vi.fn().mockReturnValue(mockConnection),
  getStatus: vi.fn().mockReturnValue('connected'),
};
const mockSessionRepo = {
  getSessionId: vi.fn().mockReturnValue('sess-1'),
};
const mockMessageRepo = new MessageRepository(); // 実物を使ってもOK

const service = new PromptService(mockConnectionRepo, mockSessionRepo, mockMessageRepo);
```

Repository層は副作用がないため、テスト時にモックせず実物を使うことも可能。これにより、テストの信頼性が向上する。

## 9. 主要な技術判断とトレードオフ

| 判断                       | 選択                                   | 理由                                                                                       | トレードオフ                                                                               |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| バックエンドアーキテクチャ | Handler / Service / Repository 3層     | 各層の責務が明確。テスト時にモック差し替えが容易。変更影響の局所化                         | ファイル数が増える。小規模MVPにはやや重いが、テスタビリティを優先                          |
| ACPメソッド分離            | メソッドごとに1ファイル                | 各メソッドを独立してユニットテスト可能。新メソッド追加時に既存コードに触れない             | `client-handler.ts`がルーターとして各メソッドに委譲する間接層が増える                      |
| DI方式                     | コンストラクタインジェクション（手動） | DIコンテナなしでシンプル。`main.ts`のComposition Rootで組み立て                            | クラス数が増えるとComposition Rootが長くなる。必要になったらDIコンテナ（tsyringe等）を導入 |
| テストフレームワーク       | Vitest                                 | Viteベースのプロジェクトとネイティブ統合。TypeScript組み込みサポート。Jestと互換API        | Electron固有のテスト（IPC等）はモックが必要                                                |
| ACP SDK vs 自前JSON-RPC    | 公式SDK使用                            | `ClientSideConnection`、型付きメッセージ、`ndJsonStream`トランスポートを提供。再実装は無駄 | pre-1.0パッケージへの依存。Service層でラップして変更を局所化                               |
| Electron Forge + Vite      | Forge + Viteプラグイン                 | 公式推奨ビルドツール。Viteプラグインで高速HMR                                              | 3つのVite設定ファイルが必要だが、適切なプロセス分離を提供                                  |
| ストリーミング方式         | `webContents.send`によるプッシュ       | エージェントの通知をUIに即座に表示する必要がある。ポーリングはレイテンシと複雑性を追加     | preloadスクリプトでイベントリスナーのクリーンアップに注意が必要                            |
| 状態管理（フロント）       | `useReducer` + Context                 | 単一セッション+メッセージリストの規模にはReact組み込みで十分                               | マルチセッション対応時にはZustandへのアップグレードが必要                                  |
| パーミッション処理         | MVPでは自動承認                        | 開発速度優先                                                                               | セキュリティ低下。将来的に承認/拒否ダイアログを追加                                        |
| 認証                       | 延期                                   | `kiro-cli login`済みを前提。OAuth実装はMVPの範囲外                                         | 未ログイン時のUXが悪い                                                                     |
