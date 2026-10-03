/**
 * Grok Build MCP Server implementation (stdio transport).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from './utils/logger.js';
import { PROTOCOL } from './constants.js';
import { ServerConfig, ToolArguments } from './types.js';
import { handleError } from './errors.js';
import { cancelAllJobs } from './utils/jobManager.js';
import {
  getToolDefinitions,
  getPromptDefinitions,
  executeTool,
  toolExists,
  getPromptMessage,
} from './tools/index.js';

type ProgressToken = string | number;

/** Keepalive state for one in-flight tool call. */
interface ProgressState {
  operationName: string;
  progressToken?: ProgressToken;
  latestOutput: string;
  interval?: NodeJS.Timeout;
}

export class GrokMcpServer {
  private readonly server: Server;
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      { name: config.name, version: config.version },
      { capabilities: { tools: {}, prompts: {}, logging: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: getToolDefinitions() as unknown as Tool[] };
    });

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra) => {
        const toolName = request.params.name;

        if (!toolExists(toolName)) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        const progressToken = (
          request.params as { _meta?: { progressToken?: ProgressToken } }
        )._meta?.progressToken;
        const progress = this.startProgressUpdates(toolName, progressToken);

        try {
          const args: ToolArguments =
            (request.params.arguments as ToolArguments) || {};
          Logger.toolInvocation(toolName, request.params.arguments);

          // extra.signal aborts when the client cancels or times out the
          // request; tools use it to stop the grok process instead of
          // leaving it running in the background.
          const result = await executeTool(
            toolName,
            args,
            (newOutput) => {
              progress.latestOutput = newOutput;
            },
            extra.signal
          );

          this.stopProgressUpdates(progress, true);
          return { content: [{ type: 'text', text: result }], isError: false };
        } catch (error) {
          this.stopProgressUpdates(progress, false);
          Logger.error(`Error in tool '${toolName}':`, error);
          return {
            content: [{ type: 'text', text: handleError(error, toolName) }],
            isError: true,
          };
        }
      }
    );

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: getPromptDefinitions() as unknown as Prompt[] };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const args = request.params.arguments || {};
      const promptMessage = getPromptMessage(promptName, args);

      if (!promptMessage) {
        throw new Error(`Unknown prompt: ${promptName}`);
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text: promptMessage },
          },
        ],
      };
    });
  }

  private async sendProgressNotification(
    progressToken: ProgressToken | undefined,
    progress: number,
    total?: number,
    message?: string
  ): Promise<void> {
    if (!progressToken) return;
    try {
      const params: Record<string, unknown> = { progressToken, progress };
      if (total !== undefined) params.total = total;
      if (message) params.message = message;
      await this.server.notification({
        method: PROTOCOL.NOTIFICATIONS.PROGRESS,
        params,
      });
    } catch (error) {
      Logger.error('Failed to send progress notification:', error);
    }
  }

  private startProgressUpdates(
    operationName: string,
    progressToken?: ProgressToken
  ): ProgressState {
    const state: ProgressState = {
      operationName,
      progressToken,
      latestOutput: '',
    };
    if (!progressToken) return state;

    let progress = 0;
    this.sendProgressNotification(
      progressToken,
      0,
      undefined,
      `Starting ${operationName}`
    );

    state.interval = setInterval(async () => {
      progress += 1;
      const preview = state.latestOutput.slice(-150).trim();
      const message = preview
        ? `Grok is working on ${operationName}...\nOutput: ...${preview}`
        : `Grok is working on ${operationName}...`;
      await this.sendProgressNotification(
        progressToken,
        progress,
        undefined,
        message
      );
    }, PROTOCOL.KEEPALIVE_INTERVAL);

    return state;
  }

  private stopProgressUpdates(
    state: ProgressState,
    success: boolean = true
  ): void {
    if (state.interval) clearInterval(state.interval);

    if (state.progressToken) {
      this.sendProgressNotification(
        state.progressToken,
        100,
        100,
        success
          ? `${state.operationName} completed successfully`
          : `${state.operationName} failed`
      );
    }
  }

  async start(): Promise<void> {
    Logger.debug(`Starting ${this.config.name} v${this.config.version}`);
    const transport = new StdioServerTransport();
    // Background jobs outlive the request that started them; make sure their
    // grok processes do not outlive the server (children are not killed with
    // their parent on Windows).
    this.server.onclose = () => {
      cancelAllJobs();
      process.exit(0);
    };
    process.stdin.on('end', () => this.server.close());
    await this.server.connect(transport);
    Logger.debug(`${this.config.name} listening on stdio`);
  }
}
