import React, { useCallback } from "react";
import { useSession } from "./hooks/useSession.js";
import { SessionBar } from "./components/SessionBar.js";
import { ChatView } from "./components/ChatView.js";
import { PromptInput } from "./components/PromptInput.js";

export function App() {
  const {
    messages,
    promptStatus,
    connectionStatus,
    sessionId,
    connect,
    disconnect,
    createSession,
    sendPrompt,
    cancelPrompt,
  } = useSession();

  const handleConnect = useCallback(async () => {
    try {
      await connect();
    } catch (err) {
      console.error("Failed to connect:", err);
    }
  }, [connect]);

  const handleNewSession = useCallback(async () => {
    try {
      // Use current working directory; in a full app this would be a directory picker
      await createSession(process.cwd?.() || "/");
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }, [createSession]);

  const handleConnectAndSession = useCallback(async () => {
    try {
      await connect();
      // Small delay to allow connection to establish before creating session
      await createSession(process.cwd?.() || "/");
    } catch (err) {
      console.error("Failed to connect and create session:", err);
    }
  }, [connect, createSession]);

  const handleSend = useCallback(
    async (text: string) => {
      try {
        await sendPrompt(text);
      } catch (err) {
        console.error("Prompt error:", err);
      }
    },
    [sendPrompt]
  );

  const isReady = connectionStatus === "connected" && sessionId !== null;

  return (
    <div className="app">
      <SessionBar
        connectionStatus={connectionStatus}
        promptStatus={promptStatus}
        sessionId={sessionId}
        onConnect={handleConnectAndSession}
        onDisconnect={disconnect}
        onNewSession={handleNewSession}
      />
      <ChatView messages={messages} />
      <PromptInput
        onSubmit={handleSend}
        onCancel={cancelPrompt}
        disabled={!isReady || promptStatus === "streaming"}
        isStreaming={promptStatus === "streaming"}
      />
    </div>
  );
}
