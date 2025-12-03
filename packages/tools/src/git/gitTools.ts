import type { ToolDefinition } from '@my-ai-ide/agent-core';
import simpleGit, { type SimpleGit } from 'simple-git';

export function createMCPGitTools(cwd: string): ToolDefinition[] {
  const git: SimpleGit = simpleGit(cwd);

  return [
    {
      name: 'git.status',
      description: 'Get the status of the git repository',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const status = await git.status();
        return {
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          files: status.files.map((f) => ({
            path: f.path,
            index: f.index,
            working_dir: f.working_dir,
          })),
        };
      },
    },
    {
      name: 'git.commit',
      description: 'Commit changes to the repository',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Commit message',
          },
          all: {
            type: 'boolean',
            description: 'Stage all changes before committing',
          },
        },
        required: ['message'],
      },
      execute: async (args) => {
        const message = args.message as string;
        const all = (args.all as boolean) || false;

        if (all) {
          await git.add('.');
        }

        const commit = await git.commit(message);
        return {
          success: true,
          commit: commit.commit,
        };
      },
    },
    {
      name: 'git.diff',
      description: 'Get the diff of changes',
      schema: {
        type: 'object',
        properties: {
          staged: {
            type: 'boolean',
            description: 'Show staged changes (default: false)',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const staged = (args.staged as boolean) || false;
        const diff = staged ? await git.diff(['--cached']) : await git.diff();
        return { diff };
      },
    },
    {
      name: 'git.branch',
      description: 'List, create, or switch branches',
      schema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'create', 'switch', 'delete'],
            description: 'Action to perform',
          },
          name: {
            type: 'string',
            description: 'Branch name (required for create/switch/delete)',
          },
        },
        required: ['action'],
      },
      execute: async (args) => {
        const action = args.action as string;
        const name = args.name as string;

        switch (action) {
          case 'list':
            const branches = await git.branchLocal();
            return {
              current: branches.current,
              branches: branches.all,
            };

          case 'create':
            if (!name) throw new Error('Branch name is required');
            await git.checkoutLocalBranch(name);
            return { success: true, branch: name };

          case 'switch':
            if (!name) throw new Error('Branch name is required');
            await git.checkout(name);
            return { success: true, branch: name };

          case 'delete':
            if (!name) throw new Error('Branch name is required');
            await git.deleteLocalBranch(name);
            return { success: true, branch: name };

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      },
    },
  ];
}

