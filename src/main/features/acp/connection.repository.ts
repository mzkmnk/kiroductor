import type { ChildProcess } from 'child_process';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';

/** ACP 接続の状態を表す型 */
export type AcpStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * ACP 接続に関するインメモリ状態を管理するリポジトリ。
 *
 * `ClientSideConnection`、子プロセス、接続ステータス、stderr ログを保持する。
 * 副作用を持たず、状態の読み書きのみを担う。
 */
export class ConnectionRepository {
  private connection: ClientSideConnection | null = null;
  private process: ChildProcess | null = null;
  private status: AcpStatus = 'disconnected';
  private stderrBuffer: string[] = [];

  /**
   * 現在保持している ACP クライアント接続を返す。
   *
   * @returns 接続インスタンス。未設定の場合は `null`。
   */
  getConnection(): ClientSideConnection | null {
    return this.connection;
  }

  /**
   * ACP クライアント接続を設定する。
   *
   * @param conn - 保持する接続インスタンス。クリアする場合は `null`。
   */
  setConnection(conn: ClientSideConnection | null): void {
    this.connection = conn;
  }

  /**
   * 現在保持している kiro-cli 子プロセスを返す。
   *
   * @returns 子プロセスインスタンス。未設定の場合は `null`。
   */
  getProcess(): ChildProcess | null {
    return this.process;
  }

  /**
   * kiro-cli 子プロセスを設定する。
   *
   * @param proc - 保持する子プロセスインスタンス。クリアする場合は `null`。
   */
  setProcess(proc: ChildProcess | null): void {
    this.process = proc;
  }

  /**
   * 現在の接続ステータスを返す。
   *
   * @returns 現在の {@link AcpStatus}。
   */
  getStatus(): AcpStatus {
    return this.status;
  }

  /**
   * 接続ステータスを更新する。
   *
   * @param status - 設定する {@link AcpStatus}。
   */
  setStatus(status: AcpStatus): void {
    this.status = status;
  }

  /**
   * stderr の1行をバッファに追記する。
   *
   * @param line - 追記するログ行。
   */
  appendStderr(line: string): void {
    this.stderrBuffer.push(line);
  }

  /**
   * 蓄積された stderr ログのコピーを返す。
   *
   * @returns ログ行の配列（元のバッファのコピー）。
   */
  getStderrLogs(): string[] {
    return [...this.stderrBuffer];
  }

  /**
   * すべての内部状態を初期値にリセットする。
   *
   * 接続・プロセス・ステータス・stderr バッファをクリアする。
   */
  clear(): void {
    this.connection = null;
    this.process = null;
    this.status = 'disconnected';
    this.stderrBuffer = [];
  }
}
