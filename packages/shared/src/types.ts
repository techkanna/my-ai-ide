// Common types shared across packages

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

