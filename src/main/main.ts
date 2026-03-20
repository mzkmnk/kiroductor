import { app, BrowserWindow } from 'electron';
import path from 'path';
import { execFileSync } from 'child_process';
import { createDebugLogger } from './shared/debug-logger';
import { buildContainer } from './container';
import { registerHandlers } from './handlers';

/**
 * macOS では Finder/Applications 起動時にシェルの PATH が継承されない（launchd 起動のため）。
 * ユーザーのログインシェルをログインモードで実行し PATH を取得して補完する。
 * `fix-path` パッケージと同等の処理を Node.js 組み込みの `child_process` で実装。
 */
function fixMacOSPath(): void {
  try {
    const shell = process.env.SHELL ?? '/bin/zsh';
    const result = execFileSync(shell, ['-l', '-c', 'printf "%s" "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (result) {
      process.env.PATH = result;
    }
  } catch {
    // PATH 取得失敗時は無視して起動を続ける
  }
}

if (process.platform === 'darwin') {
  fixMacOSPath();
}

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
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(import.meta.dirname, '../renderer/index.html'));
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
