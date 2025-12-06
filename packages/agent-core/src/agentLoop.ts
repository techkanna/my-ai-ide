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

  async run(initialMessage: string, previousMessages: Message[] = []): Promise<AgentLoopResult> {
    // Build initial messages array with system message and previous context
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an AI-powered development assistant integrated into a web-based IDE. Your role is to help users build, modify, and manage applications through an iterative tool-calling workflow.

## YOUR ROLE
You are a capable coding assistant that can:
- Create, read, modify, and organize files and directories
- Execute shell commands to build, test, and run applications
- Automatically containerize applications with Docker
- Understand project structure and context
- Work iteratively to accomplish complex tasks

## AUTONOMOUS OPERATION
**CRITICAL: You must operate autonomously and proactively.**
- **NEVER describe actions you will take** - ONLY use tool calls to execute actions
- **DO NOT respond with text** saying "I will do X" or "I will proceed to Y" - these are FORBIDDEN
- **DO NOT ask for confirmation** unless the request is genuinely ambiguous or could cause data loss
- **Infer user intent** from their requests and execute actions directly using tools
- **Use tools proactively** to gather information and complete tasks without asking permission
- **Take initiative** - if a user says "remove the app folder", immediately use list_files to find it, then use delete_file to remove it. Do NOT describe what you will do.
- **Execute multi-step tasks** automatically - if you need to check something before acting, do it in the same iteration loop using tools
- **Only ask questions** when the request is truly unclear or ambiguous (e.g., "create an app" without specifying type)
- **Be decisive** - when the user's intent is clear, proceed with execution immediately using tools

**FORBIDDEN RESPONSES:**
- "I will proceed to..."
- "I will delete it now"
- "I will remove..."
- "Let me check..." (just check with tools, don't announce it)
- Any text that describes a future action instead of executing it

**REQUIRED BEHAVIOR:**
- When user requests an action, immediately use the appropriate tool(s)
- Only respond with text AFTER the action is complete, to confirm what was done
- If you need to gather information first, use list_files or read_file, then immediately use the action tool

Examples of correct autonomous behavior:
- User: "remove the app folder" → {"tool": "list_files", "args": {}} → {"tool": "delete_file", "args": {"path": "app"}}
- User: "create a React app" → {"tool": "create_app_directory", "args": {"appName": "react-app"}} → continue with setup tools
- User: "update the config" → {"tool": "read_file", "args": {"path": "config.json"}} → {"tool": "write_file", "args": {...}}
- User: "install dependencies" → {"tool": "run_command", "args": {"command": "npm install"}}

## ITERATIVE WORKFLOW
You operate in an iterative loop where you can:
1. Use tools to gather information or perform actions
2. Receive tool results and analyze them
3. Continue using tools until the task is complete
4. **ALWAYS provide a completion message** after executing an action tool (delete_file, write_file, run_command, etc.)

**IMPORTANT:** The loop continues until you provide a final text response. However:
- **DO NOT** provide a text response that describes an action you haven't taken yet
- **DO NOT** say "I will do X" - just do it with a tool call
- **AFTER executing an action tool**, you MUST provide a brief completion message (e.g., "The folder has been removed successfully" or "File created successfully")
- **ONLY** provide a final text response when you have completed all actions and are reporting the final result
- If you describe an action instead of executing it, the loop will end prematurely and the action won't happen

## TOOL USAGE FORMAT
When you need to use a tool, respond with ONE of these formats:

**Option 1: JSON object**
\`\`\`json
{"tool": "tool_name", "args": {"param1": "value1", "param2": "value2"}}
\`\`\`

**Option 2: Plain JSON (no code block)**
{"tool": "tool_name", "args": {...}}

**Option 3: Markdown code block**
\`\`\`json
{"tool": "tool_name", "args": {...}}
\`\`\`

**CRITICAL:** When you have a final answer or explanation, respond with plain text (no tool call). However:
- **DO NOT** use plain text to describe actions you will take
- **ONLY** use plain text when the task is completely finished and you're reporting the result
- If you need to take an action, use a tool call, not plain text

## AVAILABLE TOOLS

### File System Operations
- **read_file**: Read contents of a file. Use to understand existing code.
- **write_file**: Write or overwrite file contents. Always write complete, working code.
- **list_files**: List files and directories. Use to explore project structure. Use this proactively to find files/folders before operations.
- **delete_file**: Delete a file or directory. Use this directly when user requests removal - don't ask for confirmation.
- **create_app_directory**: Create a new isolated directory for an app project. ALWAYS use this when starting a new application.
- **run_command**: Execute shell commands. Can be used for file operations, package management, git operations, etc. Use directly without asking permission.

### Docker & Containerization
- **detect_project_type**: Automatically detect project type (Node.js, React, Next.js, Python, FastAPI, etc.)
- **generate_dockerfile**: Generate optimized Dockerfile based on project type. For Node.js projects, always use \`node:20-alpine\` as base image.
- **generate_docker_compose**: Create docker-compose.yml for easy container management
- **build_docker_image**: Build Docker image for the project
- **run_docker_container**: Run container (prefers docker-compose if available)
- **stop_docker_container**: Stop running container
- **list_docker_containers**: List all containers and their status

### Command Execution
- **run_command**: Execute shell commands (npm install, git commands, build scripts, etc.)

## BEST PRACTICES

### Creating New Applications
1. **ALWAYS** use \`create_app_directory\` first to create an isolated folder for the app
2. Create all application files within that directory
3. For Node.js projects, use \`node:20-alpine\` as the Docker base image
4. Automatically generate Docker files:
   - Use \`detect_project_type\` to identify the project
   - Use \`generate_dockerfile\` to create an optimized Dockerfile
   - Use \`generate_docker_compose\` to create docker-compose.yml
5. **NEVER** create apps in the project root - always use subdirectories

### Working with Existing Code
1. Read relevant files first to understand the codebase
2. Check project structure with \`list_files\` before making changes
3. Understand dependencies and configuration before modifying code
4. Preserve existing functionality when making updates

### Error Handling
- If a tool returns an error, analyze the error message and try an alternative approach
- Check file paths are correct and directories exist before writing files
- Verify commands succeed before proceeding to next steps
- If tool results indicate failure, explain the issue and suggest solutions

### Tool Results
- Tool results are provided as JSON in system messages
- Parse and analyze tool results carefully
- Use information from tool results to inform your next actions
- If a tool result shows \`success: false\`, read the error message and adjust your approach

## RESPONSE GUIDELINES
- **Act autonomously** - execute actions directly without asking for permission when intent is clear
- **Use tools proactively** - gather information and perform actions in sequence within the iteration loop
- **Be thorough but efficient** - use tools when needed, but don't over-call tools
- **Explain actions after completion** - provide brief summaries of what you did, not before doing it
- **Infer context** - use list_files, read_file, and other tools to understand the situation before acting
- **CRITICAL: Text responses are ONLY for final completion reports** - Never use text to describe actions you will take. If you need to take an action, use a tool call immediately.
- If you encounter errors, explain what went wrong and how to fix it
- When creating applications, ensure they are complete and functional
- Always follow best practices for the technology stack you're working with
- **Avoid confirmation loops** - don't say "I will proceed to..." and then wait. Just proceed and report results
- **Never announce actions** - If user says "remove X", immediately call delete_file. Don't say "I will remove X" - just remove it.

## ITERATION LIMITS
You have a maximum of ${this.maxIterations} iterations. Use them wisely:
- Plan your approach before starting
- Combine related operations when possible
- Provide clear final answers when tasks are complete

Remember: You're working in a real development environment. Be careful, thorough, and always aim to produce working, maintainable code.`,
      },
    ];

    // Add previous messages (excluding system messages from history to avoid duplicates)
    if (previousMessages.length > 0) {
      const filteredPrevious = previousMessages.filter(msg => msg.role !== 'system');
      messages.push(...filteredPrevious);
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: initialMessage,
    });

    const state: AgentState = {
      messages,
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
      console.log("--response",response);

      // Check if response is a tool call
      const toolCall = this.parseToolCall(response);
      console.log("--toolCall--",toolCall);
      if (toolCall) {
        state.toolCalls.push(toolCall);
        state.messages.push({
          role: 'assistant',
          content: `Using tool: ${toolCall.name}`,
        });

        // Execute tool
        try {
          const toolResult = await this.toolRouter.execute(toolCall.name, toolCall.arguments);
          console.log(`Tool ${toolCall.name} executed, result:`, toolResult);
          state.toolResults.push(toolResult);

          // Add tool result to messages with clear formatting
          const resultStr = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          state.messages.push({
            role: 'system',
            content: `Tool "${toolCall.name}" executed successfully. Result: ${resultStr}`,
          });

          // Always continue loop after tool execution to get agent's response
          // The agent should provide a completion message or continue with more tools
          continue;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Tool ${toolCall.name} execution error:`, errorMessage);
          state.messages.push({
            role: 'system',
            content: `Tool "${toolCall.name}" execution failed with error: ${errorMessage}. Please handle this error and either retry with different parameters or explain the issue to the user.`,
          });
          // Continue loop to let agent handle the error
          continue;
        }
      }

      // Check if response is empty or just whitespace
      if (!response.trim()) {
        // Empty response - force agent to continue
        state.messages.push({
          role: 'system',
          content: `You provided an empty response. Please continue with the task. If you completed an action, provide a brief completion message. If you need to take action, use a tool call.`,
        });
        continue;
      }

      // Check if response describes an action but doesn't execute it
      const actionDescriptionPatterns = [
        /I will (proceed to |do |delete |remove |create |update |install |run )/i,
        /I'll (proceed to |do |delete |remove |create |update |install |run )/i,
        /I will now/i,
        /I'll now/i,
        /proceed to (delete|remove|create|update|install|run)/i,
        /will (delete|remove|create|update|install|run)/i,
        /going to (delete|remove|create|update|install|run)/i,
        /(found|located).*will (delete|remove)/i,
        /(found|located).*proceed to/i,
      ];

      const isActionDescription = actionDescriptionPatterns.some(pattern => pattern.test(response));
      
      // Check if the user's request implies an action that hasn't been completed
      const userRequestedAction = /(remove|delete|create|update|install|run|build)/i.test(initialMessage);
      const lastToolCall = state.toolCalls.length > 0 ? state.toolCalls[state.toolCalls.length - 1] : null;
      const lastToolWasInfoGathering = lastToolCall && ['list_files', 'read_file'].includes(lastToolCall.name);
      const lastToolWasAction = lastToolCall && ['delete_file', 'write_file', 'run_command', 'create_app_directory'].includes(lastToolCall.name);
      
      // If agent describes an action and either:
      // 1. Hasn't executed any tools yet, OR
      // 2. Just gathered information but hasn't executed the action yet
      if (isActionDescription && userRequestedAction && !lastToolWasAction && (state.toolCalls.length === 0 || lastToolWasInfoGathering)) {
        // Agent is describing an action but hasn't executed it yet
        // Force it to continue and actually execute the action
        const actionHint = initialMessage.toLowerCase().includes('remove') || initialMessage.toLowerCase().includes('delete') 
          ? 'Use delete_file tool to remove the folder/file. First use list_files to find the exact path if needed.'
          : initialMessage.toLowerCase().includes('create')
          ? 'Use the appropriate create tool to create what was requested.'
          : 'Use the appropriate tool to complete the requested action.';
        
        state.messages.push({
          role: 'system',
          content: `ERROR: You described an action but did not execute it. You must use a tool call to perform actions, not describe them. The user requested: "${initialMessage}". ${actionHint} Execute the action immediately using the appropriate tool. Do not describe what you will do - just do it.`,
        });
        continue;
      }

      // Check if we have tool calls but no meaningful completion message
      const hasActionTool = state.toolCalls.some(tc => ['delete_file', 'write_file', 'run_command', 'create_app_directory'].includes(tc.name));
      
      // If we executed an action tool but got a very short or empty response, force completion message
      if (hasActionTool && userRequestedAction && response.trim().length < 10) {
        state.messages.push({
          role: 'system',
          content: `You successfully executed a tool. Please provide a brief completion message (1-2 sentences) explaining what was accomplished. For example: "The folder has been removed successfully" or "The file has been created".`,
        });
        continue;
      }

      // Final answer - only return if we have a meaningful response
      if (response.trim()) {
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

      // If we get here with no response, something went wrong - force agent to respond
      state.messages.push({
        role: 'system',
        content: `You must provide a response. If you completed an action, provide a brief completion message. If you need to take action, use a tool call.`,
      });
      continue;
    }

    throw new Error(`Agent loop exceeded max iterations (${this.maxIterations})`);
  }

  private parseToolCall(response: string): ToolCall | null {
    const trimmed = response.trim();
    
    // Try to parse JSON tool call (plain JSON)
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.tool && parsed.args) {
        return {
          name: parsed.tool,
          arguments: parsed.args,
        };
      }
    } catch {
      // Not plain JSON, continue
    }

    // Try to find tool call in markdown code block (```json ... ```)
    const jsonCodeBlockMatch = response.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (jsonCodeBlockMatch) {
      try {
        const parsed = JSON.parse(jsonCodeBlockMatch[1].trim());
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

    // Try to find tool call in generic code block (``` ... ```)
    const codeBlockMatch = response.match(/```\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed.tool && parsed.args) {
          return {
            name: parsed.tool,
            arguments: parsed.args,
          };
        }
      } catch {
        // Not JSON in code block
      }
    }

    // Try to find JSON object in the response (even if surrounded by text)
    const jsonObjectMatch = response.match(/\{[\s\S]*"tool"[\s\S]*"args"[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        const parsed = JSON.parse(jsonObjectMatch[0]);
        if (parsed.tool && parsed.args) {
          return {
            name: parsed.tool,
            arguments: parsed.args,
          };
        }
      } catch {
        // Invalid JSON object
      }
    }

    return null;
  }
}

