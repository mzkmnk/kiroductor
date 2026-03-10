import React from "react";
import type { Message } from "../../shared/types.js";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  if (message.type === "user") {
    return (
      <div className="message message-user">
        <div className="message-content">{message.text}</div>
      </div>
    );
  }

  if (message.type === "agent") {
    const text = message.chunks.join("");
    return (
      <div className="message message-agent">
        <div className="message-content">
          {text || (message.complete ? "" : "...")}
          {!message.complete && <span className="cursor">|</span>}
        </div>
      </div>
    );
  }

  return null;
}
