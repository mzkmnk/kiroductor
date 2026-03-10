import type { ClientSideConnection, StopReason } from "@agentclientprotocol/sdk";
import type { Message, PromptResult } from "../../shared/types.js";

export class AcpSession {
  private sessionId: string | null = null;
  private connection: ClientSideConnection;
  private messages: Message[] = [];

  constructor(connection: ClientSideConnection) {
    this.connection = connection;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  async create(cwd: string): Promise<string> {
    const response = await this.connection.newSession({
      cwd,
      mcpServers: [],
    });
    this.sessionId = response.sessionId;
    this.messages = [];
    return response.sessionId;
  }

  async sendPrompt(text: string): Promise<PromptResult> {
    if (!this.sessionId) {
      throw new Error("No active session");
    }

    // Add user message to history
    this.messages.push({
      type: "user",
      text,
      timestamp: Date.now(),
    });

    // Start a new agent message entry
    this.messages.push({
      type: "agent",
      chunks: [],
      complete: false,
      timestamp: Date.now(),
    });

    // Send prompt - this blocks until the agent finishes the turn
    const result = await this.connection.prompt({
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    });

    // Mark the last agent message as complete
    const lastAgent = [...this.messages]
      .reverse()
      .find((m) => m.type === "agent");
    if (lastAgent && lastAgent.type === "agent") {
      lastAgent.complete = true;
    }

    return { stopReason: result.stopReason };
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    await this.connection.cancel({ sessionId: this.sessionId });
  }

  /**
   * Called by IPC handlers to accumulate streaming updates into message history.
   */
  handleUpdate(update: {
    sessionUpdate: string;
    content?: { type: string; text?: string };
    toolCallId?: string;
    name?: string;
    status?: string;
    rawInput?: unknown;
    rawOutput?: unknown;
    [key: string]: unknown;
  }): void {
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
      case "agent_thought_chunk": {
        const text =
          update.content?.type === "text" ? (update.content.text ?? "") : "";
        const lastAgent = [...this.messages]
          .reverse()
          .find((m) => m.type === "agent");
        if (lastAgent && lastAgent.type === "agent" && !lastAgent.complete) {
          lastAgent.chunks.push(text);
        }
        break;
      }
      case "tool_call": {
        this.messages.push({
          type: "tool_call",
          toolCallId: (update.toolCallId as string) ?? "",
          name: (update.name as string) ?? "unknown",
          status: "running",
          rawInput: update.rawInput,
          timestamp: Date.now(),
        });
        break;
      }
      case "tool_call_update": {
        const toolMsg = [...this.messages]
          .reverse()
          .find(
            (m) =>
              m.type === "tool_call" &&
              m.toolCallId === (update.toolCallId as string)
          );
        if (toolMsg && toolMsg.type === "tool_call") {
          if (update.status === "completed" || update.status === "error") {
            toolMsg.status = update.status === "error" ? "error" : "done";
          }
          if (update.rawOutput !== undefined) {
            toolMsg.rawOutput = update.rawOutput;
          }
          if (update.content !== undefined) {
            toolMsg.content = update.content as unknown as unknown[];
          }
        }
        break;
      }
    }
  }
}
