import type { Message, ToolCall } from '@my-ai-ide/shared';
import type { ModelClient } from '@my-ai-ide/models';
import type { AgentState, AgentConfig, ToolDefinition } from './types';
import { ToolRouter } from './toolRouter';

export interface AgentLoopResult {
  finalMessage: string;
  toolCalls: ToolCall[];
  iterations: number;
}

export class AgentLoop {
  private model: ModelClient;
  private toolRouter: ToolRouter;
  private maxIterations: number;

  constructor(model: ModelClient, config: AgentConfig) {
    this.model = model;
    this.toolRouter = new ToolRouter(config.tools);
    this.maxIterations = config.maxIterations || 10;
  }

  async run(initialMessage: string): Promise<AgentLoopResult> {
    const state: AgentState = {
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant with access to tools for creating applications.

IMPORTANT RULES FOR CREATING APPS:
1. ALWAYS create apps in a fresh subdirectory using the 'create_app_directory' tool first
2. NEVER create files directly in the project root - always use a subdirectory
3. When creating a new app, follow these steps:
   a) Use create_app_directory with a descriptive app name
   b) Create all app files in that directory
   c) Generate Dockerfile and docker-compose.yml for the app
   d) All Node.js Dockerfiles must use 'node:20-alpine' as the base image

TOOL USAGE:
- When you need to use a tool, respond with a JSON object: {"tool": "tool_name", "args": {...}}
- You can also use markdown code blocks: \`\`\`json\n{"tool": "tool_name", "args": {...}}\n\`\`\`
- When you have a final answer, respond normally with text.

Available tools include: read_file, write_file, list_files, run_command, create_app_directory, detect_project_type, generate_dockerfile, generate_docker_compose, build_docker_image, run_docker_container, and more.`,
        },
        {
          role: 'user',
          content: initialMessage,
        },
      ],
      toolCalls: [],
      toolResults: [],
      iteration: 0,
      maxIterations: this.maxIterations,
    };

    while (state.iteration < this.maxIterations) {
      state.iteration++;

      // Get model response
      let response = '';
      for await (const chunk of this.model.streamChat(state.messages)) {
        response += chunk;
      }

      // Check if response is a tool call
      const toolCall = this.parseToolCall(response);
      if (toolCall) {
        state.toolCalls.push(toolCall);
        state.messages.push({
          role: 'assistant',
          content: `Using tool: ${toolCall.name}`,
        });

        // Execute tool
        const toolResult = await this.toolRouter.execute(toolCall.name, toolCall.arguments);
        state.toolResults.push(toolResult);

        // Add tool result to messages
        state.messages.push({
          role: 'system',
          content: `Tool result: ${JSON.stringify(toolResult)}`,
        });

        continue;
      }

      // Final answer
      state.messages.push({
        role: 'assistant',
        content: response,
      });

      return {
        finalMessage: response,
        toolCalls: state.toolCalls,
        iterations: state.iteration,
      };
    }

    throw new Error(`Agent loop exceeded max iterations (${this.maxIterations})`);
  }

  private parseToolCall(response: string): ToolCall | null {
    // Try to parse JSON tool call
    try {
      const parsed = JSON.parse(response.trim());
      if (parsed.tool && parsed.args) {
        return {
          name: parsed.tool,
          arguments: parsed.args,
        };
      }
    } catch {
      // Not JSON, continue
    }

    // Try to find tool call in markdown code block
    const codeBlockMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (parsed.tool && parsed.args) {
          return {
            name: parsed.tool,
            arguments: parsed.args,
          };
        }
      } catch {
        // Invalid JSON in code block
      }
    }

    return null;
  }
}

