# My AI IDE

A web-based IDE powered by AI agents, similar to Cursor/Windsurf, with browser automation, MCP server support, and autonomous development loops.

## Features

- **Web-based IDE** with Monaco Editor
- **AI Agent** with tool execution capabilities
- **MCP Server** for tool integration
- **Browser Automation** via Playwright
- **File System** operations
- **Git Integration**
- **Test Runner** support
- **Model Support** for Ollama (Cloud & Local)

## Architecture

```
my-ai-ide/
├── apps/
│   ├── frontend/     # Next.js web IDE
│   └── backend/      # Fastify server
├── packages/
│   ├── agent-core/   # Agent loop engine
│   ├── tools/        # Tool implementations
│   ├── models/       # Model providers
│   └── shared/       # Shared types
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Ollama (for local models) or Ollama Cloud API key

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Configuration

1. **Backend** runs on `http://localhost:3001`
2. **Frontend** runs on `http://localhost:3000`

### Model Configuration

Use the Model Selector in the UI to configure:
- **Ollama Local**: Connect to local Ollama instance (default: `http://localhost:11434`)
- **Ollama Cloud**: Use Ollama Cloud API (requires API key)

## Development

### Monorepo Structure

This project uses pnpm workspaces and Turborepo for build orchestration.

### Available Scripts

- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm clean` - Clean all build artifacts

## API Endpoints

### Backend (`/api`)

- `POST /chat/stream` - Stream chat responses
- `POST /agent/run` - Run agent with tools
- `POST /mcp` - MCP JSON-RPC endpoint
- `GET /fs/tree` - Get file tree
- `GET /fs/file/:path` - Read file
- `POST /fs/file/:path` - Write file
- `DELETE /fs/file/:path` - Delete file
- `GET /models/list` - List available models
- `GET /models/health` - Check model connection

## Tools

The agent has access to various tools:

### File System
- `read_file` - Read file contents
- `write_file` - Write file contents
- `list_files` - List directory contents
- `delete_file` - Delete file/directory
- `create_directory` - Create directory

### Browser
- `browser.open` - Open URL
- `browser.click` - Click element
- `browser.type` - Type text
- `browser.evaluate` - Run JavaScript
- `browser.screenshot` - Take screenshot
- `browser.console_logs` - Get console logs
- `browser.network_requests` - Monitor network

### Development Server
- `server.start` - Start dev server
- `server.stop` - Stop dev server
- `server.logs` - Get server logs
- `server.list` - List running servers

### Git
- `git.status` - Get git status
- `git.commit` - Commit changes
- `git.diff` - Get diff
- `git.branch` - Branch operations

### Testing
- `test.run` - Run tests
- `test.detect` - Detect test framework

## License

MIT



<!-- Create a React portfolio website with Docker containerization -->