import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listFiles, readFile, writeFile, deleteFile } from '@my-ai-ide/tools';
import path from 'path';
import { getProjectRoot, setProjectRoot } from '../utils/projectRoot';

interface FSParams {
  '*': string;
}

export async function fsRoutes(fastify: FastifyInstance) {

  // Get file tree
  fastify.get('/fs/tree', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const tree = await listFiles(projectRoot);
      return { tree, root: projectRoot };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Read file
  fastify.get('/fs/file/*', async (request: FastifyRequest<{ Params: FSParams }>, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const filePath = request.params['*'];
      
      // Handle both absolute and relative paths
      let resolvedPath: string;
      if (path.isAbsolute(filePath)) {
        // If absolute path, use it directly but verify it's within project root
        resolvedPath = path.normalize(filePath);
      } else {
        // If relative path, resolve from project root
        resolvedPath = path.resolve(projectRoot, filePath);
      }

      // Security check: ensure path is within project root
      const normalizedProjectRoot = path.resolve(projectRoot);
      const normalizedResolvedPath = path.resolve(resolvedPath);
      if (!normalizedResolvedPath.startsWith(normalizedProjectRoot)) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const content = await readFile(normalizedResolvedPath);
      return { content };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Write file
  fastify.post('/fs/file/*', async (request: FastifyRequest<{ Params: FSParams; Body: { content: string } }>, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const filePath = request.params['*'];
      const { content } = request.body;

      // Handle both absolute and relative paths
      let resolvedPath: string;
      if (path.isAbsolute(filePath)) {
        resolvedPath = path.normalize(filePath);
      } else {
        resolvedPath = path.resolve(projectRoot, filePath);
      }

      // Security check
      const normalizedProjectRoot = path.resolve(projectRoot);
      const normalizedResolvedPath = path.resolve(resolvedPath);
      if (!normalizedResolvedPath.startsWith(normalizedProjectRoot)) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await writeFile(resolvedPath, content);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete file
  fastify.delete('/fs/file/*', async (request: FastifyRequest<{ Params: FSParams }>, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const filePath = request.params['*'];
      const resolvedPath = path.resolve(projectRoot, filePath);

      // Security check
      if (!resolvedPath.startsWith(path.resolve(projectRoot))) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await deleteFile(resolvedPath);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get current project root
  fastify.get('/fs/root', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      return { root: projectRoot };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Set project root
  fastify.post('/fs/root', async (request: FastifyRequest<{ Body: { root: string } }>, reply: FastifyReply) => {
    try {
      const { root } = request.body;
      if (!root) {
        return reply.code(400).send({ error: 'Root path is required' });
      }
      
      setProjectRoot(root);
      return { success: true, root: getProjectRoot() };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

