import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getProjectRoot } from '../utils/projectRoot';
import path from 'path';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

interface TerminalRequest {
  command: string;
  cwd?: string;
}

// Store active terminal sessions
const terminalSessions = new Map<string, {
  process: ReturnType<typeof spawn>;
  cwd: string;
}>();

export async function terminalRoutes(fastify: FastifyInstance) {
  // WebSocket terminal for interactive shell
  fastify.get('/terminal/ws', { websocket: true }, (connection, req) => {
    const projectRoot = getProjectRoot();
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get initial working directory from query parameter
    const initialCwdParam = (req.query as { cwd?: string })?.cwd;
    let initialCwd = projectRoot;
    
    if (initialCwdParam) {
      try {
        const resolvedCwd = path.resolve(projectRoot, initialCwdParam);
        const normalizedProjectRoot = path.resolve(projectRoot);
        const normalizedCwd = path.resolve(resolvedCwd);
        
        // Security check: ensure initial CWD is within project root
        if (normalizedCwd.startsWith(normalizedProjectRoot)) {
          initialCwd = normalizedCwd;
        }
      } catch (error) {
        console.warn('Invalid initial CWD, using project root:', error);
      }
    }
    
    // Determine shell based on platform
    const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
    // Use -i for interactive mode (required for input), but we'll suppress job control errors
    const shellArgs = process.platform === 'win32' ? [] : ['-i'];
    
    // Default terminal dimensions (will be updated on resize)
    let terminalCols = 80;
    let terminalRows = 24;
    let currentCwd = initialCwd;
    
    // Spawn shell process with proper terminal emulation
    const shellProcess = spawn(shell, shellArgs, {
      cwd: initialCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        SHELL: shell,
        HOME: process.env.HOME || projectRoot,
        USER: process.env.USER || 'user',
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        COLUMNS: String(terminalCols),
        LINES: String(terminalRows),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false, // Don't use shell wrapper for better control
    });

    // Store session
    terminalSessions.set(sessionId, {
      process: shellProcess,
      cwd: initialCwd,
    });

    // Function to update and notify CWD changes
    const updateCwd = (newCwd: string) => {
      const normalizedProjectRoot = path.resolve(projectRoot);
      const normalizedCwd = path.resolve(newCwd);
      
      // Security check: ensure CWD is within project root
      if (normalizedCwd.startsWith(normalizedProjectRoot)) {
        currentCwd = normalizedCwd;
        const session = terminalSessions.get(sessionId);
        if (session) {
          session.cwd = currentCwd;
        }
        
        // Notify client of CWD change
        try {
          connection.socket.send(JSON.stringify({
            type: 'cwd',
            cwd: currentCwd,
          }));
        } catch (error) {
          console.error('Error sending CWD update:', error);
        }
      }
    };

    // Send initial connection message
    connection.socket.send(JSON.stringify({
      type: 'connected',
      sessionId,
      cwd: initialCwd,
    }));

    // Set terminal dimensions immediately so shell knows the width
    // This must be done before any output to ensure prompt formatting is correct
    if (shellProcess.stdin && !shellProcess.stdin.destroyed) {
      try {
        // Change to initial directory if different from project root
        if (initialCwd !== projectRoot) {
          shellProcess.stdin.write(`cd "${initialCwd}"\n`);
        }
        
        // Export COLUMNS and LINES so the shell knows the terminal size
        shellProcess.stdin.write(`export COLUMNS=${terminalCols} LINES=${terminalRows}\n`);
        
        // Disable job control to avoid "initialize_job_control" errors
        // For bash, disable job control and suppress the error
        if (shell.includes('bash')) {
          shellProcess.stdin.write('set +m 2>/dev/null || true\n');
        }
        
        // Set up a hook to track CWD changes (bash/zsh)
        if (shell.includes('bash') || shell.includes('zsh')) {
          // Add a function to the prompt that sends pwd
          // This is a simple approach - in production, you might use PROMPT_COMMAND or precmd
          shellProcess.stdin.write('export PS1="$PS1"\n'); // Keep existing prompt
        }
      } catch (error) {
        console.error('Error setting up shell:', error);
      }
    }

    // Handle data from shell stdout
    shellProcess.stdout?.on('data', (data: Buffer) => {
      try {
        const output = data.toString();
        // Filter out job control error messages
        if (!output.includes('initialize_job_control') && !output.includes('no job control')) {
          connection.socket.send(JSON.stringify({
            type: 'output',
            data: output,
          }));
          
          // Try to detect pwd output to track CWD changes
          // This is a simple approach - in production, you might want to hook into the shell prompt
          const pwdMatch = output.match(/^(\/[^\n\r]+)$/m);
          if (pwdMatch) {
            const detectedCwd = pwdMatch[1].trim();
            if (detectedCwd && detectedCwd !== currentCwd) {
              updateCwd(detectedCwd);
            }
          }
        }
      } catch (error) {
        console.error('Error sending stdout:', error);
      }
    });

    // Handle data from shell stderr
    shellProcess.stderr?.on('data', (data: Buffer) => {
      try {
        const output = data.toString();
        // Filter out job control error messages from stderr
        if (!output.includes('initialize_job_control') && !output.includes('no job control')) {
          connection.socket.send(JSON.stringify({
            type: 'output',
            data: output,
          }));
        }
      } catch (error) {
        console.error('Error sending stderr:', error);
      }
    });

    // Handle shell process exit
    shellProcess.on('exit', (code, signal) => {
      try {
        connection.socket.send(JSON.stringify({
          type: 'exit',
          code: code || 0,
          signal: signal || null,
        }));
        terminalSessions.delete(sessionId);
      } catch (error) {
        console.error('Error sending exit:', error);
      }
    });

    // Handle errors
    shellProcess.on('error', (error) => {
      try {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      } catch (err) {
        console.error('Error sending error:', err);
      }
    });

    // Handle incoming messages from client
    connection.socket.on('message', (message: Buffer | string) => {
      try {
        const messageStr = typeof message === 'string' ? message : message.toString();
        const data = JSON.parse(messageStr);
        
        if (data.type === 'input') {
          // Send input to shell stdin
          const session = terminalSessions.get(sessionId);
          if (session && session.process.stdin && !session.process.stdin.destroyed) {
            try {
              session.process.stdin.write(data.data);
              
              // Track cd commands to update CWD
              // This is a simple heuristic - in a production system, you might want to
              // use a more sophisticated approach like hooking into the shell's prompt
              const inputStr = data.data.toString();
              if (inputStr.includes('cd ') && (inputStr.includes('\n') || inputStr.includes('\r'))) {
                // Extract cd command and directory
                const cdMatch = inputStr.match(/cd\s+([^\n\r]+)/);
                if (cdMatch) {
                  const targetDir = cdMatch[1].trim();
                  // Wait a bit for the command to execute, then check CWD
                  setTimeout(() => {
                    // Use pwd command to get actual CWD (more reliable)
                    // We'll handle this in the output parsing instead
                  }, 100);
                }
              }
            } catch (error) {
              console.error('Error writing to stdin:', error);
            }
          }
        } else if (data.type === 'cwd') {
          // Client requesting to set initial CWD
          if (data.cwd) {
            updateCwd(data.cwd);
          }
        } else if (data.type === 'resize') {
          // Handle terminal resize
          // Update terminal dimensions and set COLUMNS/LINES environment
          terminalCols = data.cols || 80;
          terminalRows = data.rows || 24;
          
          // Update environment variables for the shell process
          // Note: This won't affect the running shell, but we can export it
          // The shell will pick it up on the next command
          if (shellProcess.stdin && !shellProcess.stdin.destroyed) {
            try {
              // Send export command to update COLUMNS and LINES
              shellProcess.stdin.write(`export COLUMNS=${terminalCols} LINES=${terminalRows}\n`);
            } catch (error) {
              console.error('Error updating terminal size:', error);
            }
          }
          
          connection.socket.send(JSON.stringify({
            type: 'resized',
            cols: terminalCols,
            rows: terminalRows,
          }));
        } else if (data.type === 'close') {
          // Client requested to close
          const session = terminalSessions.get(sessionId);
          if (session) {
            try {
              session.process.kill('SIGTERM');
            } catch (error) {
              console.error('Error killing process:', error);
            }
            terminalSessions.delete(sessionId);
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
        try {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          }));
        } catch (sendError) {
          console.error('Error sending error message:', sendError);
        }
      }
    });

    // Handle connection close
    connection.socket.on('close', () => {
      const session = terminalSessions.get(sessionId);
      if (session) {
        try {
          if (!session.process.killed) {
            session.process.kill('SIGTERM');
          }
        } catch (error) {
          console.error('Error killing process on close:', error);
        }
        terminalSessions.delete(sessionId);
      }
    });

    // Handle connection error
    connection.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      const session = terminalSessions.get(sessionId);
      if (session) {
        try {
          if (!session.process.killed) {
            session.process.kill('SIGTERM');
          }
        } catch (killError) {
          console.error('Error killing process on error:', killError);
        }
        terminalSessions.delete(sessionId);
      }
    });
  });

  // Legacy POST endpoint for simple command execution (kept for compatibility)
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
