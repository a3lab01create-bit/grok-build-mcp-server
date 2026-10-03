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
      '• grok        — Query Grok (xAI). Args: prompt (required), model, effort.',
      '• web-search  — Web search incl. X/Twitter, Grok-synthesized. Args: query (required), summarize.',
      '• grok-result — Collect an answer that was still running, waiting up to 50s per call. Args: job_id (required), wait_seconds.',
      '• grok-cancel — Cancel a still-running job. Args: job_id (required).',
      '• ping        — Health check. Args: message (optional).',
      '• help        — This message.',
      '',
      'grok and web-search return a job_id instead of an answer when Grok takes longer than ~45s, so no call is cut off by client timeouts (e.g. the Claude desktop app cancels at ~60s).',
      'Auth: uses your local grok login. Override the binary with GROK_CLI_PATH.',
    ].join('\n');
  },
};
