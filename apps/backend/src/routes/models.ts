import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OllamaLocalClient } from '@my-ai-ide/models';

export async function modelRoutes(fastify: FastifyInstance) {
  // List available models
  fastify.get('/models/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const baseUrl = (request.query as { baseUrl?: string })?.baseUrl || 'http://localhost:11434';
      const client = new OllamaLocalClient({ provider: 'ollama-local', baseUrl });
      const models = await client.listModels();
      return { models };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Health check
  fastify.get('/models/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const baseUrl = (request.query as { baseUrl?: string })?.baseUrl || 'http://localhost:11434';
      const client = new OllamaLocalClient({ provider: 'ollama-local', baseUrl });
      const isHealthy = await client.healthCheck();
      return { healthy: isHealthy };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

