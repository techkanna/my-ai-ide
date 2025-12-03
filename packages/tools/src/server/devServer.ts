import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface DevServerProcess {
  pid: number;
  command: string;
  cwd: string;
  process: ChildProcess;
  logs: string[];
}

export class DevServerManager extends EventEmitter {
  private servers: Map<number, DevServerProcess> = new Map();

  async start(command: string, cwd: string): Promise<{ pid: number; port?: number }> {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const server: DevServerProcess = {
      pid: process.pid!,
      command,
      cwd,
      process,
      logs: [],
    };

    // Capture stdout
    process.stdout?.on('data', (data: Buffer) => {
      const log = data.toString();
      server.logs.push(log);
      this.emit('log', { pid: server.pid, log });
    });

    // Capture stderr
    process.stderr?.on('data', (data: Buffer) => {
      const log = data.toString();
      server.logs.push(log);
      this.emit('log', { pid: server.pid, log });
    });

    // Detect port from logs
    let port: number | undefined;
    const portListener = (log: string) => {
      const portMatch = log.match(/localhost:(\d+)/) || log.match(/:\/\/.*:(\d+)/);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
        process.stdout?.removeListener('data', portListener);
      }
    };
    process.stdout?.on('data', portListener);

    this.servers.set(server.pid, server);

    return { pid: server.pid, port };
  }

  async stop(pid: number): Promise<void> {
    const server = this.servers.get(pid);
    if (!server) {
      throw new Error(`Server with PID ${pid} not found`);
    }

    server.process.kill();
    this.servers.delete(pid);
  }

  getLogs(pid: number): string[] {
    const server = this.servers.get(pid);
    if (!server) {
      throw new Error(`Server with PID ${pid} not found`);
    }
    return server.logs;
  }

  list(): Array<{ pid: number; command: string; cwd: string }> {
    return Array.from(this.servers.values()).map((s) => ({
      pid: s.pid,
      command: s.command,
      cwd: s.cwd,
    }));
  }
}

