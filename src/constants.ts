/**
 * Constants for the Grok Build MCP Server
 */

export { ToolArguments } from './types.js';

// Logging prefix (stderr only — stdout is the MCP JSON-RPC channel)
export const LOG_PREFIX = '[GROK]';

export const ERROR_MESSAGES = {
  NO_PROMPT_PROVIDED:
    "Please provide a prompt. Use @path to include files (e.g. '@src/app.ts explain the auth flow') or just ask a question.",
  CLI_NOT_FOUND:
    "Grok CLI ('grok') not found on PATH. Install Grok Build (https://x.ai) or set the GROK_CLI_PATH environment variable to its absolute path.",
} as const;

export const STATUS_MESSAGES = {
  GROK_RESPONSE: 'Grok response:',
} as const;

export const PROTOCOL = {
  NOTIFICATIONS: {
    PROGRESS: 'notifications/progress',
  },
  KEEPALIVE_INTERVAL: 25000,
} as const;

// CLI constants — grok headless one-shot interface
export const CLI = {
  COMMANDS: {
    GROK: 'grok',
  },
  FLAGS: {
    PRINT: '-p',
    OUTPUT_FORMAT: '--output-format',
    MODEL: '-m',
    EFFORT: '--effort',
  },
  OUTPUT_JSON: 'json',
} as const;
