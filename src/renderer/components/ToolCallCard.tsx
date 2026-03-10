import React, { useState } from "react";
import type { Message } from "../../shared/types.js";

interface Props {
  message: Extract<Message, { type: "tool_call" }>;
}

export function ToolCallCard({ message }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    message.status === "running"
      ? "⏳"
      : message.status === "done"
      ? "✓"
      : "✗";

  const statusClass = `tool-status-${message.status}`;

  return (
    <div className={`tool-call-card ${statusClass}`}>
      <div
        className="tool-call-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="tool-call-icon">{statusIcon}</span>
        <span className="tool-call-name">{message.name}</span>
        <span className="tool-call-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="tool-call-details">
          {message.rawInput !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-label">Input</div>
              <pre className="tool-call-code">
                {typeof message.rawInput === "string"
                  ? message.rawInput
                  : JSON.stringify(message.rawInput, null, 2)}
              </pre>
            </div>
          )}
          {message.rawOutput !== undefined && (
            <div className="tool-call-section">
              <div className="tool-call-label">Output</div>
              <pre className="tool-call-code">
                {typeof message.rawOutput === "string"
                  ? message.rawOutput
                  : JSON.stringify(message.rawOutput, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
