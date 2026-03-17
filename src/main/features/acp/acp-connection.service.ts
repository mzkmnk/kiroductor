import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { createDebugLogger } from '../../shared/debug-logger';
import type { ConnectionRepository, AcpStatus } from './connection.repository';
import type { NotificationService } from '../../shared/interfaces/notification.service';
import type { KiroductorClientHandler } from './client-handler';

const log = createDebugLogger('ACP');

/** `KiroductorClientHandler` のファクトリ関数型。 */
export type ClientHandlerFactory = (
  agent: ConstructorParameters<typeof ClientSideConnection>[0] extends (agent: infer A) => unknown
    ? A
    : never,
) => KiroductorClientHandler;

/** `child_process.spawn` と互換性のある最小インターフェース。テスト用に注入可能。 */
export type SpawnFn = typeof spawn;

/**
 * kiro-cli プロセスの起動・終了と ACP 接続のライフサイクルを管理するサービス。
 *
 * `start()` で `kiro-cli acp` を子プロセスとして起動し、`ClientSideConnection` を初期化する。
 * `stop()` でプロセスを終了させ、リポジトリ状態をクリアする。
 */
export class AcpConnectionService {
  /**
   * @param connectionRepo - ACP 接続状態を管理するリポジトリ（依存注入）
   * @param notificationService - レンダラーへの通知を担うサービス（依存注入）
   * @param clientHandlerFactory - {@link KiroductorClientHandler} を生成するファクトリ（依存注入）
   * @param spawnFn - 子プロセスを起動する関数（テスト時にモック差し替え可能）
   */
  constructor(
    private readonly connectionRepo: ConnectionRepository,
    private readonly notificationService: NotificationService,
    private readonly clientHandlerFactory: ClientHandlerFactory,
    private readonly spawnFn: SpawnFn = spawn,
  ) {}

  /**
   * `kiro-cli acp` を子プロセスとして起動し、ACP 接続を初期化する。
   *
   * 1. `kiro-cli acp` を spawn する
   * 2. stdout/stdin から `ClientSideConnection` を生成する
   * 3. `initialize()` を呼んで接続を確立する
   * 4. Repository に connection と process を保存し、status を `'connected'` にする
   *
   * @throws プロセス起動や初期化に失敗した場合にエラーを投げる
   */
  async start(): Promise<void> {
    log.info('start: kiro-cli acp を起動します');
    this.connectionRepo.setStatus('connecting');

    const proc = this.spawnFn('kiro-cli', ['acp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    log.info(`プロセス起動 pid=${String(proc.pid)}`);

    // stderr をバッファに蓄積する
    proc.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) {
          log.info(`stderr: ${line}`);
          this.connectionRepo.appendStderr(line);
        }
      }
    });

    // プロセスが予期せず終了した場合のハンドリング（stop() による正常終了は除外）
    proc.on('exit', (code) => {
      log.info(`プロセス終了 code=${String(code)}`);
      const current = this.connectionRepo.getStatus();
      if (current !== 'disconnected' && code !== 0) {
        this.connectionRepo.setStatus('error');
        this.notificationService.sendToRenderer('acp:status-change', {
          status: 'error',
          reason: `kiro-cli exited with code ${String(code)}`,
        });
      }
    });

    proc.on('error', (err) => {
      log.error(`プロセスエラー: ${err.message}`);
      this.connectionRepo.setStatus('error');
      this.notificationService.sendToRenderer('acp:status-change', {
        status: 'error',
        reason: err.message,
      });
    });

    if (!proc.stdout || !proc.stdin) {
      throw new Error('kiro-cli process stdout/stdin is not available');
    }
    const readStream = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
    const writeStream = Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>;
    const stream = ndJsonStream(writeStream, readStream);

    const connection = new ClientSideConnection(
      (agent) => this.clientHandlerFactory(agent),
      stream,
    );

    log.info('initialize 開始');
    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'kiroductor', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    log.info('initialize 完了 → 接続確立');

    this.connectionRepo.setConnection(connection);
    this.connectionRepo.setProcess(proc);
    this.connectionRepo.setStatus('connected');

    this.notificationService.sendToRenderer('acp:status-change', { status: 'connected' });
  }

  /**
   * 現在の ACP 接続ステータスを返す。
   *
   * @returns 現在の {@link AcpStatus}
   */
  getStatus(): AcpStatus {
    return this.connectionRepo.getStatus();
  }

  /**
   * kiro-cli 子プロセスを終了させ、Repository の状態をクリアする。
   *
   * プロセスが存在しない場合は何もしない。
   */
  async stop(): Promise<void> {
    log.info('stop: kiro-cli を終了します');
    const proc = this.connectionRepo.getProcess();
    if (proc) {
      proc.kill();
    }
    this.connectionRepo.clear();
    this.notificationService.sendToRenderer('acp:status-change', { status: 'disconnected' });
    log.info('stop: 完了');
  }
}
