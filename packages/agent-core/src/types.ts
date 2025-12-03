import type { Message, ToolCall, ToolResult } from '@my-ai-ide/shared';

export interface AgentState {
  messages: Message[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  iteration: number;
  maxIterations: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentConfig {
  maxIterations?: number;
  tools: ToolDefinition[];
}

