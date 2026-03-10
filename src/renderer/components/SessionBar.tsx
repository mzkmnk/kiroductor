import React from "react";
import type { AcpStatus, PromptStatus } from "../../shared/types.js";

interface Props {
  connectionStatus: AcpStatus;
  promptStatus: PromptStatus;
  sessionId: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onNewSession: () => void;
}

export function SessionBar({
  connectionStatus,
  promptStatus,
  sessionId,
  onConnect,
  onDisconnect,
  onNewSession,
}: Props) {
  const statusDot =
    connectionStatus === "connected"
      ? "status-dot connected"
      : connectionStatus === "connecting"
      ? "status-dot connecting"
      : connectionStatus === "error"
      ? "status-dot error"
      : "status-dot disconnected";

  return (
    <div className="session-bar">
      <div className="session-bar-left">
        <span className={statusDot} />
        <span className="session-bar-status">
          {connectionStatus === "connected"
            ? sessionId
              ? `Session: ${sessionId.slice(0, 8)}...`
              : "Connected (no session)"
            : connectionStatus}
        </span>
      </div>
      <div className="session-bar-right">
        {connectionStatus === "disconnected" || connectionStatus === "error" ? (
          <button className="btn btn-sm" onClick={onConnect}>
            Connect
          </button>
        ) : connectionStatus === "connected" ? (
          <>
            {!sessionId && (
              <button className="btn btn-sm" onClick={onNewSession}>
                New Session
              </button>
            )}
            <button className="btn btn-sm btn-danger" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <span>Connecting...</span>
        )}
        {promptStatus === "streaming" && (
          <span className="streaming-indicator">Agent working...</span>
        )}
      </div>
    </div>
  );
}
