import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OllamaCloudClient, OllamaLocalClient, OpenAIClient } from '@my-ai-ide/models';
import { AgentLoop } from '@my-ai-ide/agent-core';
import { createBasicTools } from '@my-ai-ide/tools';
import { getProjectRoot } from '../utils/projectRoot';
import type { Message } from '@my-ai-ide/shared';

interface AgentRequest {
  message: string;
  messages?: Message[]; // Optional previous message history
  model?: string;
  provider?: 'ollama-cloud' | 'ollama-local' | 'openai';
  apiKey?: string;
  projectRoot?: string;
}

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.post('/agent/run', async (request: FastifyRequest<{ Body: AgentRequest }>, reply: FastifyReply) => {
    const {
      message,
      messages: previousMessages = [],
      model,
      provider = 'ollama-local',
      apiKey,
      projectRoot,
    } = request.body;
    console.log("request.body", JSON.stringify({ message, model, provider, hasApiKey: !!apiKey, messagesCount: previousMessages.length }));
    // Use provided projectRoot or get configured project root
    const root = projectRoot || getProjectRoot();

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    try {
      // Set up SSE for streaming with proper CORS headers
      const origin = request.headers.origin || '*';
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.raw.writeHead(200);

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Create model client
      let modelClient;
      if (provider === 'ollama-cloud') {
        modelClient = new OllamaCloudClient({ provider, model, apiKey });
      } else if (provider === 'openai') {
        modelClient = new OpenAIClient({ provider, model, apiKey });
      } else {
        modelClient = new OllamaLocalClient({ provider, model });
      }

      // Create tools
      const tools = createBasicTools(root);

      // Create agent loop
      const agent = new AgentLoop(modelClient, {
        tools,
        maxIterations: 10,
      });

      // Run agent (for now, we'll stream the final result)
      // TODO: Stream intermediate steps in Phase 4
      try {
        const result = await agent.run(message, previousMessages);
        reply.raw.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
      } finally {
        reply.raw.end();
      }
    } catch (error) {
      // If we haven't started streaming yet, send a normal error response
      if (!reply.raw.headersSent) {
        return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
      }
      // Otherwise, send error via SSE
      const errorMessage = error instanceof Error ? error.message : String(error);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: `Setup error: ${errorMessage}` })}\n\n`);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  });
}

