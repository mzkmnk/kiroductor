# Stitch UI デザインプロンプト

Stitch（Google の自然言語 UI デザインツール）に入力するためのプロンプト。

---

## プロンプト

Design a desktop application UI for "Kiroductor", an AI coding agent client (similar to Cursor or Windsurf). The app connects to kiro-cli via ACP (Agent Client Protocol) and allows users to manage multiple parallel coding sessions.

### Overall Layout

- **Dark theme** (zinc-950 background, zinc-900 cards, white/gray text)
- **Monospace font** throughout (JetBrains Mono / Fira Code style)
- **Desktop app chrome**: no browser address bar, minimal titlebar (macOS style with traffic light buttons)
- **Two-panel layout**: collapsible left sidebar (280px) + main chat area

### Left Sidebar — Session Manager

- **Header area** at the top:
  - App name "Kiroductor" in small muted text
  - A "New Session" button: rounded pill shape with a "+" icon, primary accent color (blue-500), full width
- **Session list** below the header:
  - Each session is a card/row showing:
    - Session title (auto-generated, e.g., "Fix auth middleware", truncated with ellipsis)
    - Repository name in smaller muted text below the title (e.g., "mzkmnk/kiroductor")
    - Relative timestamp in muted text on the right side (e.g., "2m ago", "1h ago")
    - A small colored status dot: green for active/connected, blue for idle, gray for disconnected
  - The currently active session has a subtle highlighted background (zinc-800) and a left border accent (blue-500, 2px)
  - Sessions are sorted by most recent activity
  - Hovering a session shows a subtle background change
- **Sidebar footer**:
  - A gear icon button for settings (muted, small)
- **Collapse behavior**: sidebar can be collapsed to just icons (session dots + new button icon)

### Main Chat Area

- **Top bar** (SessionBar):
  - Shows the active session's title on the left
  - Repository path (org/repo) as a breadcrumb in muted text
  - Connection status badge on the right: "Connected" in green, or "Disconnected" in red, using a small rounded badge with a dot
  - A stop button (square icon) visible only when the agent is processing

- **Chat messages area** (scrollable, takes remaining vertical space):
  - **User messages**: right-aligned bubbles with subtle blue tint background (blue-500/10), rounded-2xl, max-width 75%
  - **Agent messages**: left-aligned bubbles with card background (zinc-900), border (zinc-800), rounded-2xl, max-width 75%. Monospace text.
  - **Tool call cards**: left-aligned, full-width (up to 75%), collapsible cards showing:
    - A chevron icon (right, rotates 90° when expanded)
    - Status icon: spinning loader (blue) for in-progress, check circle (emerald) for completed, alert circle (red) for failed
    - Tool name in medium weight text
    - When expanded: shows "Input" section and "Output" section in a code-like format with muted labels
  - **Streaming cursor**: agent messages show a blinking block cursor (▌) at the end while streaming

- **Bottom input area** (PromptInput):
  - A rounded-2xl textarea (3 rows default, auto-grows) with subtle border
  - A circular send button (arrow-up icon) positioned at bottom-right inside the textarea area
  - The send button uses primary color (blue-500) when text is present, muted/disabled when empty
  - Placeholder text: "Type a message… (Enter to send, Shift+Enter for newline)"

### New Session Dialog

When clicking "New Session", show a modal or slide-over panel:

- A text field for selecting/entering the repository to work on
- A dropdown showing previously cloned repositories (grouped by org)
- Option to clone a new repository (URL input)
- A "Start Session" primary button

### Visual Style Notes

- Border radius: 2xl (16px) for cards and bubbles, full for buttons
- Borders: very subtle (zinc-800 or white/10% opacity)
- Shadows: minimal, mostly relying on borders and background contrast
- Spacing: generous padding (16px cards, 12px between messages)
- Transitions: smooth 150ms for hover states, collapsible animations
- No emojis in the UI
- Clean, minimal aesthetic similar to Claude desktop app or Linear

### Color Tokens (Dark Theme)

- Background: zinc-950 (#09090b)
- Card: zinc-900 (#18181b)
- Card hover: zinc-800 (#27272a)
- Border: white/10% opacity
- Text primary: zinc-50 (#fafafa)
- Text muted: zinc-400 (#a1a1aa)
- Primary/accent: blue-500 (#3b82f6)
- Success: emerald-400 (#34d399)
- Error: red-400 (#f87171)
- Warning: amber-400 (#fbbf24)

### States to Design

1. **Empty state**: No sessions yet — centered message "Create a new session to start coding with AI" with the New Session button
2. **Single active session**: Sidebar with one highlighted session, chat area with a few messages including tool calls
3. **Multiple sessions**: 3-5 sessions in sidebar, one active with conversation, others showing different statuses
4. **Agent processing**: Streaming message with cursor, tool call in progress (spinning), send button disabled
5. **Session loading**: A session being restored with a loading indicator in the chat area ("Restoring session...")
