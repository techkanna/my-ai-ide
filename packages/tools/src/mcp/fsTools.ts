import type { ToolDefinition } from '@my-ai-ide/agent-core';
import * as fs from '../fs';

export function createMCPFSTools(projectRoot: string): ToolDefinition[] {
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
      execute: async (args) => {
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
      execute: async (args) => {
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
      execute: async (args) => {
        const path = (args.path as string) || projectRoot;
        return await fs.listFiles(path);
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file or directory',
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
      execute: async (args) => {
        const path = args.path as string;
        await fs.deleteFile(path);
        return { success: true };
      },
    },
    {
      name: 'create_directory',
      description: 'Create a directory',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory to create',
          },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const path = args.path as string;
        await fs.createDirectory(path);
        return { success: true };
      },
    },
  ];
}

