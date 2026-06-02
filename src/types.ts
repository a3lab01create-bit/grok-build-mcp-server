/**
 * Type definitions for the Grok Build MCP Server
 */

// Tool argument interface (index signature lets zod-parsed args flow through)
export interface ToolArguments {
  prompt?: string;
  query?: string;
  model?: string;
  effort?: string;
  summarize?: boolean | string;
  message?: string;
  [key: string]: string | boolean | number | undefined;
}

export interface ServerConfig {
  name: string;
  version: string;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type ProgressCallback = (newOutput: string) => void;
