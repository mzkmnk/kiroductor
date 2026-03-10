import React, { useRef, useEffect } from "react";
import type { Message } from "../../shared/types.js";
import { MessageBubble } from "./MessageBubble.js";
import { ToolCallCard } from "./ToolCallCard.js";

interface Props {
  messages: Message[];
}

export function ChatView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Detect manual scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 50;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new content unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="chat-view" ref={containerRef}>
      {messages.length === 0 && (
        <div className="chat-empty">
          <p>No messages yet. Send a prompt to get started.</p>
        </div>
      )}
      {messages.map((msg, i) => {
        if (msg.type === "tool_call") {
          return <ToolCallCard key={i} message={msg} />;
        }
        return <MessageBubble key={i} message={msg} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
