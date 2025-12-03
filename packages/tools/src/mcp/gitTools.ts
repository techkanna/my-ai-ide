import type { ToolDefinition } from '@my-ai-ide/agent-core';
import { createMCPGitTools } from '../git/gitTools';

export function createMCPGitToolsWrapper(cwd: string): ToolDefinition[] {
  return createMCPGitTools(cwd);
}

