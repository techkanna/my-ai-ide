import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ToolRegistry } from './toolRegistry';

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class MCPServer {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params = {} } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {
                  listChanged: true,
                },
              },
              serverInfo: {
                name: 'my-ai-ide-mcp',
                version: '0.1.0',
              },
            },
          };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: this.toolRegistry.listTools(),
            },
          };

        case 'tools/call':
          const toolName = params.name as string;
          const toolArgs = (params.arguments as Record<string, unknown>) || {};
          const result = await this.toolRegistry.callTool(toolName, toolArgs);
          return {
            jsonrpc: '2.0',
            id,
            result,
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found',
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

