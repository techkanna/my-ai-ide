import type { ToolDefinition } from '@my-ai-ide/agent-core';
import * as fs from './fs';
import { createDockerTools } from './docker/dockerTools';
import { join, resolve } from 'path';

export function createBasicTools(projectRoot: string): ToolDefinition[] {
  return [
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
        },
        required: ['path'],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        return await fs.readFile(path);
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        const content = args.content as string;
        await fs.writeFile(path, content);
        return { success: true };
      },
    },
    {
      name: 'list_files',
      description: 'List files and directories in a path',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to list (defaults to project root)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        return await fs.listFiles(path);
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file or directory (recursively for directories)',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file or directory to delete',
          },
        },
        required: ['path'],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        await fs.deleteFile(path);
        return { success: true, message: `Deleted: ${path}` };
      },
    },
    {
      name: 'run_command',
      description: 'Execute a shell command',
      schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (defaults to project root)',
          },
        },
        required: ['command'],
      },
      execute: async (args: Record<string, unknown>) => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const command = args.command as string;
        const cwd = (args.cwd as string) || projectRoot;
        const { stdout, stderr } = await execAsync(command, { cwd });
        return { stdout, stderr };
      },
    },
    {
      name: 'create_app_directory',
      description: 'Create a new directory for an app project. Use this when starting a new app to ensure it\'s in a fresh, isolated folder.',
      schema: {
        type: 'object',
        properties: {
          appName: {
            type: 'string',
            description: 'Name of the app directory to create',
          },
          path: {
            type: 'string',
            description: 'Parent directory path (defaults to project root)',
          },
        },
        required: ['appName'],
      },
      execute: async (args: Record<string, unknown>) => {
        const appName = args.appName as string;
        const parentPath = (args.path as string) || projectRoot;
        const appPath = join(resolve(parentPath), appName);
        
        // Create directory if it doesn't exist
        await fs.createDirectory(appPath);
        
        return { 
          success: true, 
          appPath,
          message: `Created app directory: ${appPath}`
        };
      },
    },
    // Add Docker tools
    ...createDockerTools(projectRoot),
  ];
}

