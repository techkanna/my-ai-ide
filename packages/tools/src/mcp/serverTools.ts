import type { ToolDefinition } from '@my-ai-ide/agent-core';
import { DevServerManager } from '../server/devServer';

// Global dev server manager instance
let devServerManager: DevServerManager | null = null;

function getDevServerManager(): DevServerManager {
  if (!devServerManager) {
    devServerManager = new DevServerManager();
  }
  return devServerManager;
}

export function createMCPServerTools(): ToolDefinition[] {
  return [
    {
      name: 'server.start',
      description: 'Start a development server',
      schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to start the server (e.g., "npm run dev")',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (defaults to project root)',
          },
        },
        required: ['command'],
      },
      execute: async (args) => {
        const command = args.command as string;
        const cwd = (args.cwd as string) || process.cwd();
        const manager = getDevServerManager();
        const result = await manager.start(command, cwd);
        return result;
      },
    },
    {
      name: 'server.stop',
      description: 'Stop a development server',
      schema: {
        type: 'object',
        properties: {
          pid: {
            type: 'number',
            description: 'Process ID of the server to stop',
          },
        },
        required: ['pid'],
      },
      execute: async (args) => {
        const pid = args.pid as number;
        const manager = getDevServerManager();
        await manager.stop(pid);
        return { success: true };
      },
    },
    {
      name: 'server.logs',
      description: 'Get logs from a development server',
      schema: {
        type: 'object',
        properties: {
          pid: {
            type: 'number',
            description: 'Process ID of the server',
          },
        },
        required: ['pid'],
      },
      execute: async (args) => {
        const pid = args.pid as number;
        const manager = getDevServerManager();
        const logs = manager.getLogs(pid);
        return { logs };
      },
    },
    {
      name: 'server.list',
      description: 'List all running development servers',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const manager = getDevServerManager();
        const servers = manager.list();
        return { servers };
      },
    },
  ];
}

