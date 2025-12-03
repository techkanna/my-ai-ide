import type { ToolDefinition } from '@my-ai-ide/agent-core';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

interface TestFramework {
  name: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'unknown';
  command: string;
  testPattern?: string;
}

async function detectTestFramework(cwd: string): Promise<TestFramework> {
  // Check package.json
  try {
    const packageJson = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
    const scripts = packageJson.scripts || {};
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.jest || scripts.test?.includes('jest')) {
      return { name: 'jest', command: 'npm test' };
    }
    if (deps.vitest || scripts.test?.includes('vitest')) {
      return { name: 'vitest', command: 'npm test' };
    }
    if (deps.mocha || scripts.test?.includes('mocha')) {
      return { name: 'mocha', command: 'npm test' };
    }
  } catch {
    // Ignore
  }

  // Check for Python
  try {
    const hasPytest = await execAsync('which pytest', { cwd }).then(() => true).catch(() => false);
    if (hasPytest) {
      return { name: 'pytest', command: 'pytest' };
    }
  } catch {
    // Ignore
  }

  return { name: 'unknown', command: 'npm test' };
}

export function createMCPTestTools(cwd: string): ToolDefinition[] {
  return [
    {
      name: 'test.run',
      description: 'Run tests using the detected test framework',
      schema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Test pattern to run (framework-specific)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const framework = await detectTestFramework(cwd);
        const pattern = args.pattern as string | undefined;

        let command = framework.command;
        if (pattern) {
          switch (framework.name) {
            case 'jest':
              command += ` --testNamePattern="${pattern}"`;
              break;
            case 'vitest':
              command += ` -t "${pattern}"`;
              break;
            case 'mocha':
              command += ` --grep "${pattern}"`;
              break;
            case 'pytest':
              command += ` -k "${pattern}"`;
              break;
          }
        }

        try {
          const { stdout, stderr } = await execAsync(command, { cwd });
          return {
            success: true,
            framework: framework.name,
            stdout,
            stderr,
          };
        } catch (error: any) {
          return {
            success: false,
            framework: framework.name,
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr,
          };
        }
      },
    },
    {
      name: 'test.detect',
      description: 'Detect the test framework in use',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const framework = await detectTestFramework(cwd);
        return framework;
      },
    },
  ];
}

