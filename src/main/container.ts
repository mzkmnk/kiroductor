import fs from 'fs';
import { spawn } from 'child_process';
import type { BrowserWindow } from 'electron';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { ConnectionRepository } from './features/acp-connection/connection.repository';
import { SessionRepository } from './features/session/session.repository';
import { MessageRepository } from './features/session/message.repository';
import { ConfigRepository } from './features/config/config.repository';
import { ElectronNotificationService } from './shared/notification.service';
import {
  AcpConnectionService,
  type ClientHandlerFactory,
} from './features/acp-connection/acp-connection.service';
import { SessionService } from './features/session/session.service';
import { PromptService } from './features/session/prompt.service';
import { RepoService } from './features/repo/repo.service';
import { SettingsService } from './features/config/settings.service';
import { KiroductorClientHandler } from './features/acp-client/client-handler';
import { ReadTextFileMethod } from './features/acp-client/methods/read-text-file.method';
import { WriteTextFileMethod } from './features/acp-client/methods/write-text-file.method';
import { RequestPermissionMethod } from './features/acp-client/methods/request-permission.method';
import { SessionUpdateMethod } from './features/acp-client/methods/session-update.method';
import { AcpHandler } from './features/acp-connection/acp.handler';
import { SessionHandler } from './features/session/session.handler';
import { RepoHandler } from './features/repo/repo.handler';

/** {@link buildContainer} の戻り値。IPCハンドラ登録と自動初期化に必要なオブジェクト。 */
export interface AppContainer {
  /** ACP接続管理ハンドラ。 */
  acpHandler: AcpHandler;
  /** セッション管理ハンドラ。 */
  sessionHandler: SessionHandler;
  /** リポジトリ操作・設定管理ハンドラ。 */
  repoHandler: RepoHandler;
  /** ACP接続のライフサイクルを管理するサービス。自動初期化に使用する。 */
  acpConnectionService: Pick<AcpConnectionService, 'start' | 'stop'>;
  /** セッションのライフサイクルを管理するサービス。自動初期化に使用する。 */
  sessionService: Pick<SessionService, 'create' | 'restoreSessions'>;
}

/**
 * アプリケーション全体の依存関係を組み立てる Composition Root。
 *
 * `getMainWindow` をコールバックで受け取ることで、
 * ウィンドウ生成前にコンテナを構築しつつ、通知送信時にレイジーに参照できる。
 *
 * @param getMainWindow - 現在の `BrowserWindow` インスタンスを返すゲッター
 * @returns IPCハンドラ登録に必要な {@link AppContainer}
 */
export function buildContainer(getMainWindow: () => BrowserWindow | null): AppContainer {
  // Repositories
  const connectionRepo = new ConnectionRepository();
  const sessionRepo = new SessionRepository();
  const messageRepo = new MessageRepository();

  const fsAdapter = {
    readFile: (filePath: string, encoding: BufferEncoding): Promise<string> =>
      fs.promises.readFile(filePath, encoding),
    writeFile: (filePath: string, content: string, encoding: BufferEncoding): Promise<void> =>
      fs.promises.writeFile(filePath, content, encoding),
    mkdir: (dirPath: string, opts?: { recursive?: boolean }): Promise<string | undefined> =>
      fs.promises.mkdir(dirPath, opts),
    access: (targetPath: string): Promise<void> => fs.promises.access(targetPath),
    readdir: (dirPath: string): Promise<string[]> => fs.promises.readdir(dirPath),
    stat: (targetPath: string) => fs.promises.stat(targetPath),
  };

  const configRepo = new ConfigRepository(fsAdapter);

  // Services
  const notificationService = new ElectronNotificationService(getMainWindow);
  const repoService = new RepoService(configRepo, fsAdapter, spawn);

  const readTextFileMethod = new ReadTextFileMethod(fsAdapter);
  const writeTextFileMethod = new WriteTextFileMethod(fsAdapter);
  const requestPermissionMethod = new RequestPermissionMethod(notificationService);
  const sessionUpdateMethod = new SessionUpdateMethod(
    messageRepo,
    notificationService,
    sessionRepo,
  );

  const clientHandlerFactory: ClientHandlerFactory = () =>
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
  const connectionProxy: Pick<
    ClientSideConnection,
    | 'newSession'
    | 'cancel'
    | 'prompt'
    | 'loadSession'
    | 'unstable_setSessionModel'
    | 'setSessionMode'
    | 'unstable_closeSession'
  > = {
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
    loadSession: (params) => {
      const conn = connectionRepo.getConnection();
      if (!conn) throw new Error('ACP not connected');
      return conn.loadSession(params);
    },
    unstable_setSessionModel: (params) => {
      const conn = connectionRepo.getConnection();
      if (!conn) throw new Error('ACP not connected');
      return conn.unstable_setSessionModel(params);
    },
    setSessionMode: (params) => {
      const conn = connectionRepo.getConnection();
      if (!conn) throw new Error('ACP not connected');
      return conn.setSessionMode(params);
    },
    unstable_closeSession: (params) => {
      const conn = connectionRepo.getConnection();
      if (!conn) throw new Error('ACP not connected');
      return conn.unstable_closeSession(params);
    },
  };

  const sessionService = new SessionService(
    sessionRepo,
    messageRepo,
    connectionProxy,
    notificationService,
    configRepo,
  );
  const promptService = new PromptService(messageRepo, connectionProxy);

  // Handlers
  const acpHandler = new AcpHandler(acpConnectionService);
  const sessionHandler = new SessionHandler(sessionService, promptService, notificationService);
  const settingsService = new SettingsService(configRepo);
  const repoHandler = new RepoHandler(repoService, settingsService);

  return { acpHandler, sessionHandler, repoHandler, acpConnectionService, sessionService };
}
