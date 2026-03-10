import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/types.js";
import type { AcpStatus, Message, PromptResult, SessionUpdateEvent } from "../shared/types.js";

const api = {
  acp: {
    start: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ACP_START),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ACP_STOP),
    getStatus: (): Promise<AcpStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACP_STATUS),
    onStatusChange: (callback: (status: AcpStatus) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: AcpStatus) =>
        callback(status);
      ipcRenderer.on(IPC_CHANNELS.ACP_STATUS_CHANGE, handler);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.ACP_STATUS_CHANGE, handler);
    },
  },
  session: {
    create: (cwd: string): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_NEW, cwd),
    prompt: (text: string): Promise<PromptResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_PROMPT, text),
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CANCEL),
    getMessages: (): Promise<Message[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_MESSAGES),
    onUpdate: (
      callback: (update: SessionUpdateEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: SessionUpdateEvent
      ) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.SESSION_UPDATE, handler);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.SESSION_UPDATE, handler);
    },
  },
};

contextBridge.exposeInMainWorld("kiroductor", api);

export type KiroductorAPI = typeof api;
