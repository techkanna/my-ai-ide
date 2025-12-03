import type { ModelClient } from '@my-ai-ide/models';
import type { AgentConfig, ToolDefinition } from './types';
import { AgentLoop } from './agentLoop';
import { ToolRouter } from './toolRouter';

export interface AutonomousLoopConfig extends AgentConfig {
  devServerCommand?: string;
  devServerCwd?: string;
  testUrl?: string;
  maxIterations?: number;
  successCriteria?: string;
}

export interface AutonomousLoopResult {
  success: boolean;
  iterations: number;
  finalMessage: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

export class AutonomousLoop {
  private agent: AgentLoop;
  private config: AutonomousLoopConfig;
  private toolRouter: ToolRouter;

  constructor(model: ModelClient, config: AutonomousLoopConfig) {
    this.config = config;
    this.agent = new AgentLoop(model, config);
    this.toolRouter = new ToolRouter(config.tools);
  }

  async run(goal: string): Promise<AutonomousLoopResult> {
    const maxIterations = this.config.maxIterations || 20;
    let iteration = 0;
    let devServerPid: number | null = null;
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    try {
      // Step 1: Start dev server if configured
      if (this.config.devServerCommand) {
        const serverTool = this.toolRouter.get('server.start');
        if (serverTool) {
          const result = await serverTool.execute({
            command: this.config.devServerCommand,
            cwd: this.config.devServerCwd || process.cwd(),
          });
          if (result && typeof result === 'object' && 'pid' in result) {
            devServerPid = result.pid as number;
          }
        }
      }

      // Step 2: Autonomous loop
      while (iteration < maxIterations) {
        iteration++;

        // Build context message
        let contextMessage = goal;
        if (iteration > 1) {
          contextMessage += `\n\nIteration ${iteration}. Continue working towards the goal.`;
        }

        // Run agent
        const agentResult = await this.agent.run(contextMessage);
        toolCalls.push(...agentResult.toolCalls.map((tc) => ({ name: tc.name, args: tc.arguments })));

        // Check if we should take a screenshot and analyze
        if (this.config.testUrl && iteration % 3 === 0) {
          const browserTool = this.toolRouter.get('browser.open');
          const screenshotTool = this.toolRouter.get('browser.screenshot');
          const consoleTool = this.toolRouter.get('browser.console_logs');

          if (browserTool && screenshotTool && consoleTool) {
            // Open browser
            await browserTool.execute({ url: this.config.testUrl });

            // Take screenshot
            const screenshotResult = await screenshotTool.execute({});
            const screenshot = screenshotResult && typeof screenshotResult === 'object' && 'screenshot' in screenshotResult
              ? screenshotResult.screenshot as string
              : null;

            // Get console logs
            const consoleResult = await consoleTool.execute({});
            const logs = consoleResult && typeof consoleResult === 'object' && 'logs' in consoleResult
              ? (consoleResult.logs as Array<{ type: string; text: string }>)
              : [];

            // Analyze with model
            const analysisMessage = `Analyze the current state:\n\nScreenshot: ${screenshot ? 'Available' : 'Not available'}\nConsole logs: ${JSON.stringify(logs)}\n\nDoes the application look correct? Are there any errors?`;
            const analysisResult = await this.agent.run(analysisMessage);

            // Check for success criteria
            if (this.config.successCriteria) {
              const checkResult = await this.agent.run(
                `Check if this criteria is met: "${this.config.successCriteria}"\n\nCurrent state: ${analysisResult.finalMessage}\n\nRespond with "YES" if criteria is met, "NO" otherwise.`
              );

              if (checkResult.finalMessage.toUpperCase().includes('YES')) {
                return {
                  success: true,
                  iterations: iteration,
                  finalMessage: analysisResult.finalMessage,
                  toolCalls,
                };
              }
            }
          }
        }

        // Check if agent says we're done
        if (agentResult.finalMessage.toLowerCase().includes('done') ||
            agentResult.finalMessage.toLowerCase().includes('complete') ||
            agentResult.finalMessage.toLowerCase().includes('finished')) {
          return {
            success: true,
            iterations: iteration,
            finalMessage: agentResult.finalMessage,
            toolCalls,
          };
        }
      }

      return {
        success: false,
        iterations: iteration,
        finalMessage: `Reached maximum iterations (${maxIterations})`,
        toolCalls,
      };
    } finally {
      // Cleanup: Stop dev server
      if (devServerPid !== null) {
        const stopTool = this.toolRouter.get('server.stop');
        if (stopTool) {
          try {
            await stopTool.execute({ pid: devServerPid });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
}

