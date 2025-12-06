# My-AI-IDE Complete Development Plan

## Phase 1: Foundation (Monorepo & Basic Structure)

### 1.1 Monorepo Setup

- Initialize pnpm workspace with turbo
- Create monorepo structure:
  - `apps/frontend/` - Next.js application
  - `apps/backend/` - Fastify server
  - `packages/agent-core/` - Agent loop engine
  - `packages/tools/` - Tool implementations (FS, browser, git)
  - `packages/models/` - Model provider abstractions
  - `packages/shared/` - Shared TypeScript types and schemas
- Configure turbo.json with build pipeline
- Setup TypeScript configs for each package
- Add root package.json with workspace dependencies

### 1.2 Backend Skeleton (Fastify)

- Create `apps/backend/src/server.ts` - Main Fastify server
- Implement routes:
  - `POST /chat/stream` - Streaming chat endpoint
  - `POST /agent/run` - Agent execution endpoint
  - `POST /mcp` - MCP JSON-RPC endpoint
- Setup CORS and WebSocket support for streaming
- Create `apps/backend/src/routes/` directory structure
- Add basic error handling and logging

### 1.3 Frontend Skeleton (Next.js)

- Setup Next.js 14+ with App Router
- Create `apps/frontend/app/page.tsx` - Main IDE layout
- Implement split layout components:
  - File tree sidebar (left)
  - Monaco Editor (center)
  - Chat panel (right)
- Install and configure Monaco Editor
- Setup basic state management (React Context or Zustand)

## Phase 2: Filesystem IDE

### 2.1 Backend File System API

- Create `packages/tools/src/fs/` module with:
  - `listFiles(root: string)` - Recursive directory listing
  - `readFile(path: string)` - File content reader
  - `writeFile(path: string, content: string)` - File writer
  - `deleteFile(path: string)` - File deleter
  - `createDirectory(path: string)` - Directory creator
- Add `apps/backend/src/routes/fs.ts` with REST endpoints:
  - `GET /fs/tree` - Get file tree
  - `GET /fs/file/:path` - Read file
  - `POST /fs/file/:path` - Write file
  - `DELETE /fs/file/:path` - Delete file
- Add path validation and security checks

### 2.2 Frontend File Tree & Editor

- Create `apps/frontend/components/FileTree.tsx` - Recursive tree component
- Implement file tree state management
- Create `apps/frontend/components/Editor.tsx` - Monaco wrapper
- Integrate file tree with editor:
  - Click file → load content into editor
  - Editor changes → auto-save to backend
  - File tree updates on create/delete

## Phase 3: Model Integration

### 3.1 Model Provider Layer

- Create `packages/models/src/types.ts` - ModelClient interface
- Implement `packages/models/src/ollamaCloud.ts`:
  - OllamaCloudClient class
  - `streamChat(messages: Message[]): AsyncGenerator<string>`
  - API key configuration
- Implement `packages/models/src/ollamaLocal.ts`:
  - OllamaLocalClient class
  - Local HTTP client to Ollama instance
  - Model selection support
- Create model factory/registry pattern

### 3.2 Streaming Chat Endpoint

- Enhance `apps/backend/src/routes/chat.ts`:
  - Accept model selection
  - Stream tokens via Server-Sent Events (SSE)
  - Handle errors gracefully
- Connect to model provider layer

## Phase 4: Agent 1.0

### 4.1 Agent Loop Core

- Create `packages/agent-core/src/agentLoop.ts`:
  - Main agent execution function
  - Tool call detection (structured output parsing)
  - Tool execution router
  - Multi-step loop with state management
  - Final answer detection
- Implement `packages/agent-core/src/types.ts`:
  - AgentState, ToolCall, ToolResult types
- Add `packages/agent-core/src/toolRouter.ts` - Routes tool calls to implementations

### 4.2 Internal Tools (Pre-MCP)

- Create `packages/tools/src/registry.ts` - Tool registry
- Implement tools:
  - `read_file` - Wrapper around FS readFile
  - `write_file` - Wrapper around FS writeFile
  - `list_files` - Wrapper around FS listFiles
  - `run_command` - Execute shell commands (child_process)
  - `search` - Code search (grep/ripgrep)
  - `index_repo` - Basic code indexing
- Each tool exports: name, description, schema, execute function

### 4.3 Chat Panel Integration

- Create `apps/frontend/components/ChatPanel.tsx`:
  - Message input
  - Message history display
  - Streaming response rendering
- Connect to `/agent/run` endpoint
- Display tool call logs (collapsible)
- Show agent reasoning steps

## Phase 5: MCP Upgrade

### 5.1 MCP Server Implementation

- Create `apps/backend/src/mcp/server.ts`:
  - JSON-RPC 2.0 handler
  - Request/response parsing
  - Error handling
- Implement MCP protocol methods:
  - `initialize` - Handshake
  - `tools/list` - List available tools
  - `tools/call` - Execute tool
  - `notifications/progress` - Progress updates
- Add streaming support for long-running tools

### 5.2 Convert Tools to MCP Format

- Create `packages/tools/src/mcp/` directory
- Convert each tool to MCP tool definition:
  - JSON Schema for parameters
  - Tool metadata (name, description)
  - MCP-compliant execute function
- Organize by category:
  - `fsTools.ts` - File system tools
  - `browserTools.ts` - Browser automation (stub for Phase 6)
  - `testTools.ts` - Testing tools (stub for Phase 9)

## Phase 6: Browser Automation

### 6.1 Playwright Integration

- Add Playwright dependency to `packages/tools`
- Create `packages/tools/src/browser/playwrightClient.ts`:
  - Browser instance management
  - Page navigation
  - Element interaction
- Implement MCP browser tools:
  - `browser.open(url)` - Navigate to URL
  - `browser.click(selector)` - Click element
  - `browser.type(selector, text)` - Type text
  - `browser.evaluate(script)` - Run JavaScript
  - `browser.screenshot()` - Capture screenshot
  - `browser.console_logs()` - Get console messages
  - `browser.network_requests()` - Monitor network

### 6.2 Dev Server Runner

- Create `packages/tools/src/server/devServer.ts`:
  - Process management (child_process)
  - Port detection
  - Log streaming
  - Process cleanup
- Implement MCP tools:
  - `server.start(command, cwd)` - Start dev server
  - `server.stop(pid)` - Stop server
  - `server.logs(pid)` - Stream logs
- Add port conflict detection

## Phase 7: Autonomous Development Loop

### 7.1 Autonomous Loop Engine

- Create `packages/agent-core/src/autonomousLoop.ts`:
  - Orchestrates: edit → build → test → screenshot → analyze
  - Error recovery logic
  - Iteration limits
  - Success criteria detection
- Integrate with:
  - FS tools for code edits
  - Server tools for dev server
  - Browser tools for UI validation
  - Agent loop for reasoning

### 7.2 Vision Feedback (Optional)

- Create `packages/tools/src/vision/screenshotEncoder.ts`:
  - Convert screenshots to base64
  - Image format optimization
- Enhance model context:
  - Include screenshot in agent messages
  - Vision-capable model detection
  - UI validation prompts

## Phase 8: Local GPU Support

### 8.1 Local Ollama Integration

- Enhance `packages/models/src/ollamaLocal.ts`:
  - Connection to local Ollama instance
  - Model discovery (list available models)
  - Model switching
- Add health check endpoint

### 8.2 Model Selection UI

- Create `apps/frontend/components/ModelSelector.tsx`:
  - Dropdown for model selection
  - Provider selection (Cloud vs Local)
  - Model status indicator
- Store selection in localStorage
- Update backend model client on change

## Phase 9: Polish & Advanced Features

### 9.1 Git Integration

- Create `packages/tools/src/git/gitTools.ts`:
  - `git.status()` - Check status
  - `git.commit(message)` - Commit changes
  - `git.diff()` - Show diff
  - `git.branch()` - Branch operations
- Add to MCP tool registry

### 9.2 Test Runner Integration

- Create `packages/tools/src/test/testRunner.ts`:
  - Detect test framework (Jest, Vitest, etc.)
  - Run tests programmatically
  - Parse test results
  - MCP tool: `test.run(pattern)`

### 9.3 Code Search & Embeddings

- Add vector search capability:
  - Code embedding generation
  - Semantic search index
  - Similarity search
- Integrate with agent for context retrieval

### 9.4 Multi-Agent Support

- Extend agent-core for multiple agents
- Agent coordination patterns
- Shared state management

## Technical Decisions

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: Fastify with TypeScript
- **Frontend**: Next.js 14+ (App Router)
- **Editor**: Monaco Editor
- **Browser**: Playwright
- **Models**: Ollama (Cloud + Local)
- **Streaming**: Server-Sent Events (SSE)
- **State**: React Context or Zustand
- **Build**: Turborepo pipeline

## File Structure Overview

```
my-ai-ide/
├── apps/
│   ├── frontend/          # Next.js app
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   └── backend/           # Fastify server
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/
│       │   └── mcp/
│       └── package.json
├── packages/
│   ├── agent-core/        # Agent loop engine
│   │   ├── src/
│   │   │   ├── agentLoop.ts
│   │   │   ├── autonomousLoop.ts
│   │   │   └── toolRouter.ts
│   │   └── package.json
│   ├── tools/             # Tool implementations
│   │   ├── src/
│   │   │   ├── fs/
│   │   │   ├── browser/
│   │   │   ├── git/
│   │   │   ├── server/
│   │   │   └── mcp/
│   │   └── package.json
│   ├── models/            # Model providers
│   │   ├── src/
│   │   │   ├── ollamaCloud.ts
│   │   │   ├── ollamaLocal.ts
│   │   │   └── types.ts
│   │   └── package.json
│   └── shared/            # Shared types
│       ├── src/
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```