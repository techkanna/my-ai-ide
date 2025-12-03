import type { ToolDefinition } from '@my-ai-ide/agent-core';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;

  constructor(tools: ToolDefinition[] = []) {
    this.tools = new Map();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  listTools(): MCPTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.schema,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }

    return await tool.execute(args);
  }
}

