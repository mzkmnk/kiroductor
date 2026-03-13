import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { ConnectionRepository } from './repositories/connection.repository';
import { SessionRepository } from './repositories/session.repository';
import { MessageRepository } from './repositories/message.repository';
import { ElectronNotificationService } from './services/notification.service';
import { AcpConnectionService, type ClientHandlerFactory } from './services/acp-connection.service';
import { SessionService } from './services/session.service';
import { PromptService } from './services/prompt.service';
import { KiroductorClientHandler } from './acp/client-handler';
import { ReadTextFileMethod } from './acp/methods/read-text-file.method';
import { WriteTextFileMethod } from './acp/methods/write-text-file.method';
import { RequestPermissionMethod } from './acp/methods/request-permission.method';
import { SessionUpdateMethod } from './acp/methods/session-update.method';
import { AcpHandler } from './handlers/acp.handler';
import { SessionHandler } from './handlers/session.handler';
import { registerHandlers } from './handlers/index';

// Electron Forge が Vite ビルド後に注入するグローバル変数
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

/** アプリケーションのメインウィンドウインスタンス。未生成または破棄済みの場合は `null`。 */
let mainWindow: BrowserWindow | null = null;

// --- Composition Root ---

// Repositories
const connectionRepo = new ConnectionRepository();
const sessionRepo = new SessionRepository();
const messageRepo = new MessageRepository();

// Services
const notificationService = new ElectronNotificationService(() => mainWindow);

const fsAdapter = {
  readFile: (filePath: string, encoding: string): Promise<string> =>
    fs.promises.readFile(filePath, encoding as BufferEncoding) as Promise<string>,
  writeFile: (filePath: string, content: string, encoding: string): Promise<void> =>
    fs.promises.writeFile(filePath, content, encoding as BufferEncoding),
};

const readTextFileMethod = new ReadTextFileMethod(fsAdapter);
const writeTextFileMethod = new WriteTextFileMethod(fsAdapter);
const requestPermissionMethod = new RequestPermissionMethod(notificationService);
const sessionUpdateMethod = new SessionUpdateMethod(messageRepo, notificationService);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const clientHandlerFactory: ClientHandlerFactory = (_agent) =>
  new KiroductorClientHandler(
    readTextFileMethod,
    writeTextFileMethod,
    requestPermissionMethod,
    sessionUpdateMethod,
  );

const acpConnectionService = new AcpConnectionService(
  connectionRepo,
  notificationService,
  clientHandlerFactory,
);

/**
 * `ConnectionRepository` から現在の `ClientSideConnection` を取得するプロキシ。
 *
 * `SessionService` / `PromptService` は構築時に接続オブジェクトを必要とするが、
 * 接続は `AcpConnectionService.start()` 後に初めて確立される。
 * このプロキシを通じてレイジーに取得することで、構築時の依存を解決する。
 */
const connectionProxy: Pick<ClientSideConnection, 'newSession' | 'cancel' | 'prompt'> = {
  newSession: (params) => {
    const conn = connectionRepo.getConnection();
    if (!conn) throw new Error('ACP not connected');
    return conn.newSession(params);
  },
  cancel: (params) => {
    const conn = connectionRepo.getConnection();
    if (!conn) throw new Error('ACP not connected');
    return conn.cancel(params);
  },
  prompt: (params) => {
    const conn = connectionRepo.getConnection();
    if (!conn) throw new Error('ACP not connected');
    return conn.prompt(params);
  },
};

const sessionService = new SessionService(sessionRepo, messageRepo, connectionProxy);
const promptService = new PromptService(sessionRepo, messageRepo, connectionProxy);

// Handlers
const acpHandler = new AcpHandler(acpConnectionService, connectionRepo);
const sessionHandler = new SessionHandler(sessionService, promptService, messageRepo);

// --- End Composition Root ---

/**
 * Electron の `BrowserWindow` を生成してアプリケーションウィンドウを初期化する。
 *
 * 開発時は Vite 開発サーバーの URL を読み込み、
 * プロダクションビルドでは生成済み HTML ファイルを読み込む。
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerHandlers(acpHandler, sessionHandler);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
