import { useReducer, useEffect, useState, useCallback } from "react";
import type {
  Message,
  AcpStatus,
  PromptStatus,
  SessionUpdateEvent,
} from "../../shared/types.js";

type MessageAction =
  | { type: "ADD_USER_MESSAGE"; text: string }
  | { type: "ADD_AGENT_MESSAGE" }
  | { type: "APPEND_CHUNK"; text: string }
  | { type: "COMPLETE_AGENT" }
  | {
      type: "ADD_TOOL_CALL";
      toolCallId: string;
      name: string;
      rawInput?: unknown;
    }
  | {
      type: "UPDATE_TOOL_CALL";
      toolCallId: string;
      status?: string;
      rawOutput?: unknown;
      content?: unknown[];
    }
  | { type: "SET_MESSAGES"; messages: Message[] };

function messageReducer(state: Message[], action: MessageAction): Message[] {
  switch (action.type) {
    case "SET_MESSAGES":
      return action.messages;
    case "ADD_USER_MESSAGE":
      return [
        ...state,
        { type: "user", text: action.text, timestamp: Date.now() },
      ];
    case "ADD_AGENT_MESSAGE":
      return [
        ...state,
        { type: "agent", chunks: [], complete: false, timestamp: Date.now() },
      ];
    case "APPEND_CHUNK": {
      const newState = [...state];
      for (let i = newState.length - 1; i >= 0; i--) {
        const msg = newState[i];
        if (msg.type === "agent" && !msg.complete) {
          newState[i] = {
            ...msg,
            chunks: [...msg.chunks, action.text],
          };
          break;
        }
      }
      return newState;
    }
    case "COMPLETE_AGENT": {
      const newState = [...state];
      for (let i = newState.length - 1; i >= 0; i--) {
        const msg = newState[i];
        if (msg.type === "agent" && !msg.complete) {
          newState[i] = { ...msg, complete: true };
          break;
        }
      }
      return newState;
    }
    case "ADD_TOOL_CALL":
      return [
        ...state,
        {
          type: "tool_call",
          toolCallId: action.toolCallId,
          name: action.name,
          status: "running",
          rawInput: action.rawInput,
          timestamp: Date.now(),
        },
      ];
    case "UPDATE_TOOL_CALL": {
      const newState = [...state];
      for (let i = newState.length - 1; i >= 0; i--) {
        const msg = newState[i];
        if (
          msg.type === "tool_call" &&
          msg.toolCallId === action.toolCallId
        ) {
          newState[i] = {
            ...msg,
            status:
              action.status === "error"
                ? "error"
                : action.status === "completed"
                ? "done"
                : msg.status,
            rawOutput:
              action.rawOutput !== undefined
                ? action.rawOutput
                : msg.rawOutput,
            content:
              action.content !== undefined ? action.content : msg.content,
          };
          break;
        }
      }
      return newState;
    }
    default:
      return state;
  }
}

export function useSession() {
  const [messages, dispatch] = useReducer(messageReducer, []);
  const [promptStatus, setPromptStatus] = useState<PromptStatus>("idle");
  const [connectionStatus, setConnectionStatus] =
    useState<AcpStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Subscribe to ACP status changes
  useEffect(() => {
    const unsub = window.kiroductor.acp.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    // Get initial status
    window.kiroductor.acp.getStatus().then(setConnectionStatus);
    return unsub;
  }, []);

  // Subscribe to session updates
  useEffect(() => {
    const unsub = window.kiroductor.session.onUpdate(
      (event: SessionUpdateEvent) => {
        const update = event.update as {
          sessionUpdate: string;
          content?: { type: string; text?: string };
          toolCallId?: string;
          name?: string;
          status?: string;
          rawInput?: unknown;
          rawOutput?: unknown;
          [key: string]: unknown;
        };

        switch (update.sessionUpdate) {
          case "agent_message_chunk":
          case "agent_thought_chunk": {
            const text =
              update.content?.type === "text"
                ? (update.content.text ?? "")
                : "";
            dispatch({ type: "APPEND_CHUNK", text });
            break;
          }
          case "tool_call":
            dispatch({
              type: "ADD_TOOL_CALL",
              toolCallId: update.toolCallId ?? "",
              name: update.name ?? "unknown",
              rawInput: update.rawInput,
            });
            break;
          case "tool_call_update":
            dispatch({
              type: "UPDATE_TOOL_CALL",
              toolCallId: update.toolCallId ?? "",
              status: update.status,
              rawOutput: update.rawOutput,
              content: update.content as unknown[] | undefined,
            });
            break;
        }
      }
    );
    return unsub;
  }, []);

  const connect = useCallback(async () => {
    await window.kiroductor.acp.start();
  }, []);

  const disconnect = useCallback(async () => {
    await window.kiroductor.acp.stop();
    setSessionId(null);
  }, []);

  const createSession = useCallback(async (cwd: string) => {
    const result = await window.kiroductor.session.create(cwd);
    setSessionId(result.sessionId);
    dispatch({ type: "SET_MESSAGES", messages: [] });
    return result.sessionId;
  }, []);

  const sendPrompt = useCallback(async (text: string) => {
    dispatch({ type: "ADD_USER_MESSAGE", text });
    dispatch({ type: "ADD_AGENT_MESSAGE" });
    setPromptStatus("streaming");
    try {
      await window.kiroductor.session.prompt(text);
      dispatch({ type: "COMPLETE_AGENT" });
      setPromptStatus("idle");
    } catch (err) {
      setPromptStatus("error");
      throw err;
    }
  }, []);

  const cancelPrompt = useCallback(async () => {
    await window.kiroductor.session.cancel();
  }, []);

  return {
    messages,
    promptStatus,
    connectionStatus,
    sessionId,
    connect,
    disconnect,
    createSession,
    sendPrompt,
    cancelPrompt,
  };
}
