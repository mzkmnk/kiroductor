import type { ChildProcess } from 'child_process';
import type { ClientSideConnection } from '@agentclientprotocol/sdk';

export type AcpStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class ConnectionRepository {
  private connection: ClientSideConnection | null = null;
  private process: ChildProcess | null = null;
  private status: AcpStatus = 'disconnected';
  private stderrBuffer: string[] = [];

  getConnection(): ClientSideConnection | null {
    return this.connection;
  }

  setConnection(conn: ClientSideConnection | null): void {
    this.connection = conn;
  }

  getProcess(): ChildProcess | null {
    return this.process;
  }

  setProcess(proc: ChildProcess | null): void {
    this.process = proc;
  }

  getStatus(): AcpStatus {
    return this.status;
  }

  setStatus(status: AcpStatus): void {
    this.status = status;
  }

  appendStderr(line: string): void {
    this.stderrBuffer.push(line);
  }

  getStderrLogs(): string[] {
    return [...this.stderrBuffer];
  }

  clear(): void {
    this.connection = null;
    this.process = null;
    this.status = 'disconnected';
    this.stderrBuffer = [];
  }
}
