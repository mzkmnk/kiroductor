import fs from 'fs';
import { spawn } from 'child_process';
import type { BrowserWindow } from 'electron';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { ConnectionRepository } from './repositories/connection.repository';
import { SessionRepository } from './repositories/session.repository';
import { MessageRepository } from './repositories/message.repository';
import { ConfigRepository } from './repositories/config.repository';
import { ElectronNotificationService } from './services/notification.service';
import { AcpConnectionService, type ClientHandlerFactory } from './services/acp-connection.service';
import { SessionService } from './services/session.service';
import { PromptService } from './services/prompt.service';
import { RepoService } from './services/repo.service';
import { KiroductorClientHandler } from './acp/client-handler';
import { ReadTextFileMethod } from './acp/methods/read-text-file.method';
import { WriteTextFileMethod } from './acp/methods/write-text-file.method';
import { RequestPermissionMethod } from './acp/methods/request-permission.method';
import { SessionUpdateMethod } from './acp/methods/session-update.method';
import { AcpHandler } from './handlers/acp.handler';
import { SessionHandler } from './handlers/session.handler';
import { RepoHandler } from './handlers/repo.handler';

/** {@link buildContainer} の戻り値。IPCハンドラ登録と自動初期化に必要なオブジェクト。 */
export interface AppContainer {
  /** ACP接続管理ハンドラ。 */
  acpHandler: AcpHandler;
  /** セッション管理ハンドラ。 */
  sessionHandler: SessionHandler;
  /** リポジトリ操作・設定管理ハンドラ。 */
  repoHandler: RepoHandler;
  /** ACP接続のライフサイクルを管理するサービス。自動初期化に使用する。 */
  acpConnectionService: Pick<AcpConnectionService, 'start'>;
  /** セッションのライフサイクルを管理するサービス。自動初期化に使用する。 */
  sessionService: Pick<SessionService, 'create'>;
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
  };

  const configRepo = new ConfigRepository(fsAdapter);

  // Services
  const notificationService = new ElectronNotificationService(getMainWindow);
  const repoService = new RepoService(configRepo, fsAdapter, spawn);

  const readTextFileMethod = new ReadTextFileMethod(fsAdapter);
  const writeTextFileMethod = new WriteTextFileMethod(fsAdapter);
  const requestPermissionMethod = new RequestPermissionMethod(notificationService);
  const sessionUpdateMethod = new SessionUpdateMethod(messageRepo, notificationService);

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
    'newSession' | 'cancel' | 'prompt' | 'loadSession'
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
  };

  const sessionService = new SessionService(
    sessionRepo,
    messageRepo,
    connectionProxy,
    notificationService,
  );
  const promptService = new PromptService(sessionRepo, messageRepo, connectionProxy);

  // Handlers
  const acpHandler = new AcpHandler(acpConnectionService, connectionRepo);
  const sessionHandler = new SessionHandler(sessionService, promptService, messageRepo);
  const repoHandler = new RepoHandler(repoService, configRepo);

  return { acpHandler, sessionHandler, repoHandler, acpConnectionService, sessionService };
}
