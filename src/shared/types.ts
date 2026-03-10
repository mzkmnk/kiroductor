// メインプロセスとレンダラープロセス間で共有する型定義

export type AcpStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type Message =
  | { type: 'user'; text: string; timestamp: number }
  | { type: 'agent'; chunks: string[]; complete: boolean; timestamp: number }
  | {
      type: 'tool_call';
      toolCallId: string;
      name: string;
      rawInput?: unknown;
      rawOutput?: unknown;
      status: 'running' | 'done' | 'error';
      timestamp: number;
    };

export type SessionUpdate =
  | { event: 'message_update'; messages: Message[] }
  | { event: 'status_change'; status: AcpStatus };
