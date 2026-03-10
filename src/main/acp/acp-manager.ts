import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import type { BrowserWindow } from "electron";
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Agent,
} from "@agentclientprotocol/sdk";
import { KiroductorClientHandler } from "./client-handler.js";
import type { AcpStatus } from "../../shared/types.js";
import { IPC_CHANNELS } from "../../shared/types.js";

export class AcpManager {
  private process: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  private clientHandler: KiroductorClientHandler | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: AcpStatus = "disconnected";
  private stderrBuffer: string[] = [];

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    if (this.clientHandler) {
      this.clientHandler.setMainWindow(window);
    }
  }

  getStatus(): AcpStatus {
    return this.status;
  }

  getConnection(): ClientSideConnection | null {
    return this.connection;
  }

  getStderrLogs(): string[] {
    return this.stderrBuffer;
  }

  isRunning(): boolean {
    return this.process !== null && this.status === "connected";
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error("ACP process is already running");
    }

    this.setStatus("connecting");

    try {
      const proc = spawn("kiro-cli", ["acp"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.process = proc;

      // Collect stderr for debugging
      if (proc.stderr) {
        proc.stderr.on("data", (data: Buffer) => {
          const line = data.toString();
          this.stderrBuffer.push(line);
          // Cap at 1000 lines
          if (this.stderrBuffer.length > 1000) {
            this.stderrBuffer.shift();
          }
        });
      }

      proc.on("exit", (code, signal) => {
        console.log(`kiro-cli acp exited: code=${code}, signal=${signal}`);
        this.cleanup();
        this.setStatus("disconnected");
      });

      proc.on("error", (err) => {
        console.error("kiro-cli acp process error:", err);
        this.cleanup();
        this.setStatus("error");
      });

      // Convert Node streams to Web streams for ACP SDK
      const readStream = Readable.toWeb(
        proc.stdout!
      ) as ReadableStream<Uint8Array>;
      const writeStream = Writable.toWeb(
        proc.stdin!
      ) as WritableStream<Uint8Array>;
      const stream = ndJsonStream(writeStream, readStream);

      this.connection = new ClientSideConnection(
        (agent: Agent) => {
          this.clientHandler = new KiroductorClientHandler(
            agent,
            this.mainWindow
          );
          return this.clientHandler;
        },
        stream
      );

      // Initialize the connection
      await this.connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientInfo: { name: "kiroductor", version: "0.1.0" },
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
        },
      });

      this.setStatus("connected");

      // Watch for connection close
      this.connection.closed.then(() => {
        console.log("ACP connection closed");
        this.cleanup();
        this.setStatus("disconnected");
      });
    } catch (err) {
      console.error("Failed to start ACP:", err);
      this.cleanup();
      this.setStatus("error");
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.cleanup();
      this.setStatus("disconnected");
    }
  }

  private cleanup(): void {
    this.process = null;
    this.connection = null;
    this.clientHandler = null;
  }

  private setStatus(status: AcpStatus): void {
    this.status = status;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.ACP_STATUS_CHANGE, status);
    }
  }
}
