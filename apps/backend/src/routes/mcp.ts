import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MCPServer } from '../mcp/server';
import { ToolRegistry } from '../mcp/toolRegistry';
import { createBasicTools } from '@my-ai-ide/tools';
import path from 'path';

export async function mcpRoutes(fastify: FastifyInstance) {
  const projectRoot = process.cwd();
  const tools = createBasicTools(projectRoot);
  const toolRegistry = new ToolRegistry(tools);
  const mcpServer = new MCPServer(toolRegistry);

  fastify.post('/mcp', async (request: FastifyRequest<{ Body: { id?: string | number | null; [key: string]: unknown } }>, reply: FastifyReply) => {
    try {
      const mcpRequest = request.body as any;
      const response = await mcpServer.handleRequest(mcpRequest);
      return reply.send(response);
    } catch (error) {
      return reply.code(500).send({
        jsonrpc: '2.0',
        id: request.body?.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
}

