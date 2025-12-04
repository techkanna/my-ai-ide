import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getProjectRoot } from '../utils/projectRoot';
import path from 'path';

const execAsync = promisify(exec);

interface TerminalRequest {
  command: string;
  cwd?: string;
}

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.post('/terminal/execute', async (request: FastifyRequest<{ Body: TerminalRequest }>, reply: FastifyReply) => {
    const { command, cwd } = request.body;

    if (!command || typeof command !== 'string') {
      return reply.code(400).send({ error: 'Command is required' });
    }

    try {
      const projectRoot = getProjectRoot();
      const workingDir = cwd ? path.resolve(projectRoot, cwd) : projectRoot;

      // Security check: ensure working directory is within project root
      const normalizedProjectRoot = path.resolve(projectRoot);
      const normalizedWorkingDir = path.resolve(workingDir);
      if (!normalizedWorkingDir.startsWith(normalizedProjectRoot)) {
        return reply.code(403).send({ error: 'Access denied: working directory must be within project root' });
      }

      // Basic command validation - prevent dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf\s+\/\s*$/,  // rm -rf /
        /mkfs/,                // Format filesystem
        /dd\s+if=/,            // Disk operations
        /:\(\)\s*\{\s*:\s*\|\s*:\s*\&\s*\}/, // Fork bomb
      ];

      const trimmedCommand = command.trim();
      for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmedCommand)) {
          return reply.code(403).send({ error: 'Command not allowed for security reasons' });
        }
      }

      // Execute command
      const { stdout, stderr } = await execAsync(trimmedCommand, {
        cwd: normalizedWorkingDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minute timeout
      });

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        cwd: normalizedWorkingDir,
      };
    } catch (error: any) {
      // execAsync throws an error when command fails, but we still want to return stdout/stderr
      const exitCode = error.code || 1;
      const stdout = error.stdout || '';
      const stderr = error.stderr || error.message || '';

      return {
        success: false,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode,
        cwd: cwd || getProjectRoot(),
      };
    }
  });

  // Get current working directory
  fastify.get('/terminal/cwd', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      return { cwd: projectRoot };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

