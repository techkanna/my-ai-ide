import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getProjectRoot } from '../utils/projectRoot';

const execAsync = promisify(exec);

export async function dockerRoutes(fastify: FastifyInstance) {
  const projectRoot = getProjectRoot();

  // List Docker containers
  fastify.get('/docker/containers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { all } = request.query as { all?: string };
      const { stdout } = await execAsync(`docker ps ${all === 'true' ? '-a' : ''} --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}"`);
      
      const containers = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, name, status, ports, image] = line.split('|');
          return { id, name, status, ports, image };
        });

      return { containers };
    } catch (error) {
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : String(error),
        containers: []
      });
    }
  });

  // Get container logs
  fastify.get('/docker/containers/:name/logs', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { tail = '100' } = request.query as { tail?: string };
      const { stdout, stderr } = await execAsync(`docker logs --tail ${tail} ${name}`);
      return { logs: stdout, errors: stderr };
    } catch (error) {
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Stop container
  fastify.post('/docker/containers/:name/stop', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { stdout, stderr } = await execAsync(`docker stop ${name}`);
      return { success: true, stdout, stderr };
    } catch (error) {
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Start container
  fastify.post('/docker/containers/:name/start', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { stdout, stderr } = await execAsync(`docker start ${name}`);
      return { success: true, stdout, stderr };
    } catch (error) {
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Remove container
  fastify.delete('/docker/containers/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { stdout, stderr } = await execAsync(`docker rm -f ${name}`);
      return { success: true, stdout, stderr };
    } catch (error) {
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Build Docker image for a project
  fastify.post('/docker/build', async (request: FastifyRequest<{ Body: { path?: string; imageName?: string } }>, reply: FastifyReply) => {
    try {
      const { path: projectPath, imageName } = request.body;
      const resolvedPath = projectPath ? path.resolve(projectRoot, projectPath) : projectRoot;
      const image = imageName || path.basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]/g, '-');

      const { stdout, stderr } = await execAsync(`docker build -t ${image} .`, {
        cwd: resolvedPath,
      });

      return { success: true, imageName: image, stdout, stderr };
    } catch (error: any) {
      return reply.code(500).send({ 
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      });
    }
  });

  // Run docker-compose
  fastify.post('/docker/compose', async (request: FastifyRequest<{ Body: { path?: string; action: 'up' | 'down' | 'restart' } }>, reply: FastifyReply) => {
    try {
      const { path: projectPath, action = 'up' } = request.body;
      const resolvedPath = projectPath ? path.resolve(projectRoot, projectPath) : projectRoot;

      let command = '';
      if (action === 'up') {
        command = 'docker-compose up -d';
      } else if (action === 'down') {
        command = 'docker-compose down';
      } else if (action === 'restart') {
        command = 'docker-compose restart';
      } else {
        return reply.code(400).send({ error: 'Invalid action. Use: up, down, or restart' });
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: resolvedPath,
      });

      return { success: true, action, stdout, stderr };
    } catch (error: any) {
      return reply.code(500).send({ 
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      });
    }
  });
}

