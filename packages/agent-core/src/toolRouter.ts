import type { ToolResult } from '@my-ai-ide/shared';
import type { ToolDefinition } from './types';

export class ToolRouter {
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

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }

    try {
      const result = await tool.execute(args);
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
}

