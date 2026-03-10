import * as fs from "node:fs/promises";
import type { BrowserWindow } from "electron";
import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";
import { IPC_CHANNELS } from "../../shared/types.js";

/**
 * ACP Client implementation that handles agent-to-client requests.
 * Forwards streaming updates to the renderer process via IPC.
 */
export class KiroductorClientHandler implements Client {
  private agent: Agent;
  private mainWindow: BrowserWindow | null;

  constructor(agent: Agent, mainWindow: BrowserWindow | null) {
    this.agent = agent;
    this.mainWindow = mainWindow;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    this.sendToRenderer(IPC_CHANNELS.SESSION_UPDATE, {
      sessionId: params.sessionId,
      update: params.update,
    });
  }

  async requestPermission(
    params: RequestPermissionRequest
  ): Promise<RequestPermissionResponse> {
    // MVP: auto-approve all permission requests by selecting the first option
    const firstOption = params.options[0];
    if (firstOption) {
      this.sendToRenderer(IPC_CHANNELS.SESSION_UPDATE, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk" as const,
          content: {
            type: "text" as const,
            text: `[Permission auto-approved: ${firstOption.name}]\n`,
          },
        },
      });
      return { outcome: { outcome: "selected", optionId: firstOption.optionId } };
    }
    return { outcome: { outcome: "cancelled" } };
  }

  async readTextFile(
    params: ReadTextFileRequest
  ): Promise<ReadTextFileResponse> {
    const content = await fs.readFile(params.path, "utf-8");
    return { content };
  }

  async writeTextFile(
    params: WriteTextFileRequest
  ): Promise<WriteTextFileResponse> {
    await fs.writeFile(params.path, params.content, "utf-8");
    return {};
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
