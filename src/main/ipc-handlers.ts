import { ipcMain } from "electron";
import { AcpManager } from "./acp/acp-manager.js";
import { AcpSession } from "./acp/acp-session.js";
import { IPC_CHANNELS } from "../shared/types.js";
import type { SessionUpdateEvent } from "../shared/types.js";

let currentSession: AcpSession | null = null;

export function registerIpcHandlers(acpManager: AcpManager): void {
  // ACP lifecycle
  ipcMain.handle(IPC_CHANNELS.ACP_START, async () => {
    await acpManager.start();
  });

  ipcMain.handle(IPC_CHANNELS.ACP_STOP, async () => {
    await acpManager.stop();
    currentSession = null;
  });

  ipcMain.handle(IPC_CHANNELS.ACP_STATUS, () => {
    return acpManager.getStatus();
  });

  // Session management
  ipcMain.handle(IPC_CHANNELS.SESSION_NEW, async (_event, cwd: string) => {
    const connection = acpManager.getConnection();
    if (!connection) {
      throw new Error("ACP not connected");
    }
    currentSession = new AcpSession(connection);
    const sessionId = await currentSession.create(cwd);
    return { sessionId };
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_PROMPT, async (_event, text: string) => {
    if (!currentSession) {
      throw new Error("No active session");
    }
    const result = await currentSession.sendPrompt(text);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CANCEL, async () => {
    if (currentSession) {
      await currentSession.cancel();
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_MESSAGES, () => {
    if (!currentSession) {
      return [];
    }
    return currentSession.getMessages();
  });

  // Listen for session updates forwarded from client-handler and accumulate in session
  ipcMain.on("internal:session-update", (_event, data: SessionUpdateEvent) => {
    if (currentSession) {
      currentSession.handleUpdate(
        data.update as Parameters<AcpSession["handleUpdate"]>[0]
      );
    }
  });
}

export function getCurrentSession(): AcpSession | null {
  return currentSession;
}
