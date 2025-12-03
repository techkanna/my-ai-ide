import type { ToolDefinition } from '@my-ai-ide/agent-core';

// Test tools stub - will be implemented in Phase 9
export function createMCPTestTools(): ToolDefinition[] {
  return [
    {
      name: 'test.run',
      description: 'Run tests (stub - will be implemented in Phase 9)',
      schema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Test pattern to run',
          },
        },
        required: [],
      },
      execute: async () => {
        throw new Error('Test tools not yet implemented');
      },
    },
  ];
}

