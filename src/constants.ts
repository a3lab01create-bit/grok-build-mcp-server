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
    DISALLOWED_TOOLS: '--disallowed-tools',
  },
  OUTPUT_JSON: 'json',
} as const;

// Defaults, each overridable via the environment variable named in the comment.
export const DEFAULTS = {
  // GROK_TIMEOUT_MS — hard limit for one grok process (0 disables)
  TIMEOUT_MS: 10 * 60 * 1000,
  // GROK_DISALLOWED_TOOLS — grok's `workflow` tool starts research in the
  // background and reports back later, which a one-shot `grok -p` never
  // receives: the call either returns only an "in progress" note or the
  // process lingers until the workflow ends. Without it grok researches
  // inline and exits with the full answer.
  DISALLOWED_TOOLS: 'workflow',
} as const;

// Background jobs behind grok / web-search, collected with grok-result.
export const JOBS = {
  // Many MCP clients (e.g. the Claude desktop app) cancel any tool call at
  // ~60s regardless of progress notifications, so every wait stays below that.
  // GROK_SYNC_WAIT_SECONDS — how long grok / web-search wait before handing
  // back a job_id (0 waits until grok finishes, the pre-job behaviour)
  SYNC_WAIT_SECONDS: 45,
  DEFAULT_WAIT_SECONDS: 45,
  MAX_WAIT_SECONDS: 50,
  // Finished jobs are dropped after this long
  RETENTION_MS: 30 * 60 * 1000,
} as const;
