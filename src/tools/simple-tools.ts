import { z } from 'zod';
import { UnifiedTool } from './registry.js';

export const pingTool: UnifiedTool = {
  name: 'ping',
  description: 'Health check — echoes back an optional message.',
  zodSchema: z.object({ message: z.string().optional() }),
  annotations: {
    title: 'Ping',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Optional message to echo back.' },
    },
  },
  execute: async (args) => {
    const message = args.message as string | undefined;
    return message ? `pong: ${message}` : 'pong';
  },
};

export const helpTool: UnifiedTool = {
  name: 'help',
  description: 'List the tools this server exposes and how to use them.',
  zodSchema: z.object({}),
  annotations: {
    title: 'Help',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: { type: 'object', properties: {} },
  execute: async () => {
    return [
      'Grok Build MCP Server — available tools:',
      '',
      '• grok       — Query Grok (xAI). Args: prompt (required), model, effort.',
      '• web-search — Web search incl. X/Twitter, Grok-synthesized. Args: query (required), summarize.',
      '• ping       — Health check. Args: message (optional).',
      '• help       — This message.',
      '',
      'Auth: uses your local grok login. Override the binary with GROK_CLI_PATH.',
    ].join('\n');
  },
};
