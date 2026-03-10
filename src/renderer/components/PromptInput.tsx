import React, { useState, useRef, useCallback } from "react";

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
  isStreaming: boolean;
}

export function PromptInput({
  onSubmit,
  onCancel,
  disabled,
  isStreaming,
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
  }, [text, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && isStreaming) {
        onCancel();
      }
    },
    [handleSubmit, isStreaming, onCancel]
  );

  return (
    <div className="prompt-input">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled ? "Waiting for agent..." : "Type a message... (Enter to send)"
        }
        disabled={disabled}
        rows={3}
      />
      <div className="prompt-actions">
        {isStreaming ? (
          <button className="btn btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button
            className="btn btn-send"
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
