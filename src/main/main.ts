import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createDebugLogger } from './shared/debug-logger';
import { buildContainer } from './container';
import { registerHandlers } from './handlers';

const log = createDebugLogger('Main');

/** アプリケーションのメインウィンドウインスタンス。未生成または破棄済みの場合は `null`。 */
let mainWindow: BrowserWindow | null = null;

const { acpHandler, sessionHandler, repoHandler, acpConnectionService, sessionService } =
  buildContainer(() => mainWindow);

/**
 * Electron の `BrowserWindow` を生成してアプリケーションウィンドウを初期化する。
 *
 * 開発時は Vite 開発サーバーの URL を読み込み、
 * プロダクションビルドでは生成済み HTML ファイルを読み込む。
 *
 * ウィンドウのロード完了後に ACP 接続を自動で開始し、
 * `process.cwd()` を作業ディレクトリとしてセッションを作成する。
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    const cwd = process.cwd();
    log.info(`did-finish-load: ACP 接続を開始します cwd=${cwd}`);
    sessionService
      .restoreSessions()
      .then(() => acpConnectionService.start())
      .then(() => log.info('初期化完了'))
      .catch((err: unknown) => {
        log.error('初期化失敗', err);
      });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  log.info('app ready');
  registerHandlers(acpHandler, sessionHandler, repoHandler);
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
