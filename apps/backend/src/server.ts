// Load environment variables from .env file
import 'dotenv/config';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { chatRoutes } from './routes/chat';
import { agentRoutes } from './routes/agent';
import { fsRoutes } from './routes/fs';
import { mcpRoutes } from './routes/mcp';
import { modelRoutes } from './routes/models';
import { dockerRoutes } from './routes/docker';
import { terminalRoutes } from './routes/terminal';

const server = Fastify({
  logger: true,
});

async function start() {
  try {
    // Register WebSocket support
    await server.register(websocket);

    // Register CORS with proper configuration for SSE
    await server.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Register routes
    await server.register(chatRoutes);
    await server.register(agentRoutes);
    await server.register(fsRoutes);
    await server.register(mcpRoutes);
    await server.register(modelRoutes);
    await server.register(dockerRoutes);
    await server.register(terminalRoutes);

    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

