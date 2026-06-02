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
import {
  getToolDefinitions,
  getPromptDefinitions,
  executeTool,
  toolExists,
  getPromptMessage,
} from './tools/index.js';

export class GrokMcpServer {
  private readonly server: Server;
  private readonly config: ServerConfig;
  private isProcessing = false;
  private currentOperationName = '';
  private latestOutput = '';

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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;

      if (!toolExists(toolName)) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const progressToken = (
        request.params as { _meta?: { progressToken?: string | number } }
      )._meta?.progressToken;
      const progressData = this.startProgressUpdates(toolName, progressToken);

      try {
        const args: ToolArguments =
          (request.params.arguments as ToolArguments) || {};
        Logger.toolInvocation(toolName, request.params.arguments);

        const result = await executeTool(toolName, args, (newOutput) => {
          this.latestOutput = newOutput;
        });

        this.stopProgressUpdates(progressData, true);
        return { content: [{ type: 'text', text: result }], isError: false };
      } catch (error) {
        this.stopProgressUpdates(progressData, false);
        Logger.error(`Error in tool '${toolName}':`, error);
        return {
          content: [{ type: 'text', text: handleError(error, toolName) }],
          isError: true,
        };
      }
    });

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
    progressToken: string | number | undefined,
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
    progressToken?: string | number
  ): { interval: NodeJS.Timeout; progressToken?: string | number } {
    this.isProcessing = true;
    this.currentOperationName = operationName;
    this.latestOutput = '';

    let progress = 0;

    if (progressToken) {
      this.sendProgressNotification(
        progressToken,
        0,
        undefined,
        `Starting ${operationName}`
      );
    }

    const interval = setInterval(async () => {
      if (this.isProcessing && progressToken) {
        progress += 1;
        const preview = this.latestOutput.slice(-150).trim();
        const message = preview
          ? `Grok is working on ${operationName}...\nOutput: ...${preview}`
          : `Grok is working on ${operationName}...`;
        await this.sendProgressNotification(
          progressToken,
          progress,
          undefined,
          message
        );
      } else if (!this.isProcessing) {
        clearInterval(interval);
      }
    }, PROTOCOL.KEEPALIVE_INTERVAL);

    return { interval, progressToken };
  }

  private stopProgressUpdates(
    progressData: { interval: NodeJS.Timeout; progressToken?: string | number },
    success: boolean = true
  ): void {
    const operationName = this.currentOperationName;
    this.isProcessing = false;
    this.currentOperationName = '';
    clearInterval(progressData.interval);

    if (progressData.progressToken) {
      this.sendProgressNotification(
        progressData.progressToken,
        100,
        100,
        success
          ? `${operationName} completed successfully`
          : `${operationName} failed`
      );
    }
  }

  async start(): Promise<void> {
    Logger.debug(`Starting ${this.config.name} v${this.config.version}`);
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    Logger.debug(`${this.config.name} listening on stdio`);
  }
}
