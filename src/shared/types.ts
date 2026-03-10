import type {
  SessionNotification,
  StopReason,
} from "@agentclientprotocol/sdk";

// ACP connection status
export type AcpStatus = "disconnected" | "connecting" | "connected" | "error";

// Prompt status
export type PromptStatus = "idle" | "streaming" | "error";

// Message types for the chat view
export type Message =
  | { type: "user"; text: string; timestamp: number }
  | {
      type: "agent";
      chunks: string[];
      complete: boolean;
      timestamp: number;
    }
  | {
      type: "tool_call";
      toolCallId: string;
      name: string;
      status: "running" | "done" | "error";
      rawInput?: unknown;
      rawOutput?: unknown;
      content?: unknown[];
      timestamp: number;
    };

// Session update forwarded from main to renderer
export type SessionUpdateEvent = {
  sessionId: string;
  update: SessionNotification["update"];
};

// IPC channel names
export const IPC_CHANNELS = {
  // Request/response (renderer -> main)
  ACP_START: "acp:start",
  ACP_STOP: "acp:stop",
  ACP_STATUS: "acp:status",
  SESSION_NEW: "session:new",
  SESSION_PROMPT: "session:prompt",
  SESSION_CANCEL: "session:cancel",
  SESSION_MESSAGES: "session:messages",

  // Push notifications (main -> renderer)
  SESSION_UPDATE: "session:update",
  ACP_STATUS_CHANGE: "acp:status-change",
} as const;

// Prompt result
export interface PromptResult {
  stopReason: StopReason;
}
