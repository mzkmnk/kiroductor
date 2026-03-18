# Kiroductor

**A modern desktop client for AI-powered coding with [kiro-cli](https://github.com/mzkmnk/kiro-cli)**

Kiroductor brings the power of AI coding agents to your desktop. Chat with an AI assistant that can read, write, and refactor your code — all through a clean, intuitive interface built on the [Agent Client Protocol (ACP)](https://github.com/nicepkg/agent-client-protocol).

[English](./README.md) | [日本語](./README.ja.md)

<!-- TODO: Add screenshot -->
<!-- ![Kiroductor Screenshot](docs/assets/screenshot.png) -->

## Features

### Multi-Session Conversations

Run multiple AI sessions in parallel, each with its own conversation history. Switch between sessions seamlessly — your scroll position and context are preserved.

### Git Worktree Integration

Work on multiple branches simultaneously without conflicts. Kiroductor manages Git worktrees under the hood, letting the AI agent make changes on isolated branches while you keep working on your main branch.

### Real-Time Streaming Responses

Watch the AI think and respond in real time. Streaming responses with syntax-highlighted code blocks and Markdown rendering make conversations feel natural and fast.

### Split Diff Viewer

Review every change the AI makes before committing. The built-in split diff viewer shows insertions, deletions, and modifications across all affected files — so you stay in control.

### Tool Call Transparency

See exactly what the AI agent is doing. Every file read, write, and tool execution is displayed as an expandable card, giving you full visibility into the agent's actions.

### Model Selection

Choose from available AI models and switch between them mid-conversation. Pick the right model for the task — whether you need speed or depth.

## Getting Started

### Prerequisites

- [kiro-cli](https://github.com/mzkmnk/kiro-cli) installed and authenticated (`kiro-cli login`)
- Node.js 20+
- pnpm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/mzkmnk/kiroductor.git
cd kiroductor

# Install dependencies
pnpm install

# Start the app in development mode
pnpm start
```

### Building

```bash
# Build the application
pnpm build

# Package for your platform
pnpm make
```

## How It Works

Kiroductor acts as a client for kiro-cli via the **Agent Client Protocol (ACP)** — a JSON-RPC 2.0 based protocol over stdio. When you start a session, Kiroductor spawns a kiro-cli subprocess and communicates with it through structured messages.

```
You  →  Kiroductor (Electron)  →  kiro-cli (ACP)  →  AI Model
```

The AI agent can:

- Read and write files in your repository
- Execute commands and tools
- Create and manage Git branches
- Respond with rich Markdown including code blocks

All actions require your approval, keeping you in the driver's seat.

## Tech Stack

| Component         | Technology                  |
| ----------------- | --------------------------- |
| Desktop Framework | Electron                    |
| UI                | React + TypeScript          |
| Styling           | Tailwind CSS + shadcn/ui    |
| Build Tool        | electron-vite (Vite)        |
| Protocol          | Agent Client Protocol (ACP) |
| Packaging         | electron-builder            |

## Contributing

Contributions are welcome! Please see the development setup above to get started.

```bash
pnpm test          # Run unit tests
pnpm lint          # Run ESLint
pnpm format:check  # Check formatting
pnpm typecheck     # Type checking
```

## License

[MIT](LICENSE)
