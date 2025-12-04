import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listFiles, readFile, writeFile, deleteFile, createDirectory, renameFile } from '@my-ai-ide/tools';
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
      console.info(`Getting file tree for project root: ${projectRoot}`);
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

  // Create file or directory
  fastify.post('/fs/create', async (request: FastifyRequest<{ Body: { path: string; type: 'file' | 'directory'; content?: string } }>, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const { path: filePath, type, content = '' } = request.body;

      if (!filePath) {
        return reply.code(400).send({ error: 'Path is required' });
      }

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

      if (type === 'directory') {
        await createDirectory(resolvedPath);
      } else {
        await writeFile(resolvedPath, content);
      }

      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Rename file or directory
  fastify.put('/fs/file/*', async (request: FastifyRequest<{ Params: FSParams; Body: { newPath: string } }>, reply: FastifyReply) => {
    try {
      const projectRoot = getProjectRoot();
      const oldPath = request.params['*'];
      const { newPath } = request.body;

      if (!newPath) {
        return reply.code(400).send({ error: 'New path is required' });
      }

      // Handle both absolute and relative paths for old path
      let resolvedOldPath: string;
      if (path.isAbsolute(oldPath)) {
        resolvedOldPath = path.normalize(oldPath);
      } else {
        resolvedOldPath = path.resolve(projectRoot, oldPath);
      }

      // Handle both absolute and relative paths for new path
      let resolvedNewPath: string;
      if (path.isAbsolute(newPath)) {
        resolvedNewPath = path.normalize(newPath);
      } else {
        resolvedNewPath = path.resolve(projectRoot, newPath);
      }

      // Security check for both paths
      const normalizedProjectRoot = path.resolve(projectRoot);
      const normalizedOldPath = path.resolve(resolvedOldPath);
      const normalizedNewPath = path.resolve(resolvedNewPath);
      
      if (!normalizedOldPath.startsWith(normalizedProjectRoot) || !normalizedNewPath.startsWith(normalizedProjectRoot)) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await renameFile(resolvedOldPath, resolvedNewPath);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

