import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OllamaCloudClient, OllamaLocalClient } from '@my-ai-ide/models';
import type { Message } from '@my-ai-ide/shared';

interface ChatRequest {
  messages: Message[];
  model?: string;
  provider?: 'ollama-cloud' | 'ollama-local';
  apiKey?: string;
}

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post('/chat/stream', async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
    const { messages, model, provider = 'ollama-local', apiKey } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({ error: 'Messages array is required' });
    }

    try {
      // Create model client
      const modelClient = provider === 'ollama-cloud'
        ? new OllamaCloudClient({ provider, model, apiKey })
        : new OllamaLocalClient({ provider, model });

      // Set up SSE
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.writeHead(200);

      // Stream response
      try {
        for await (const chunk of modelClient.streamChat(messages)) {
          reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
        reply.raw.write('data: [DONE]\n\n');
      } catch (streamError) {
        reply.raw.write(`data: ${JSON.stringify({ error: String(streamError) })}\n\n`);
      } finally {
        reply.raw.end();
      }
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

