#!/usr/bin/env node

/**
 * Grok Build MCP Server - Entry Point
 *
 * MCP server that wraps the xAI Grok Build CLI (`grok`) so any MCP client can
 * query Grok through the local grok install's headless mode.
 */

import { GrokMcpServer } from './server.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const SERVER_CONFIG = {
  name: 'grok-build-mcp-server',
  version: pkg.version as string,
};

async function main(): Promise<void> {
  try {
    const server = new GrokMcpServer(SERVER_CONFIG);
    await server.start();
  } catch (error) {
    console.error('[GROK] Failed to start server:', error);
    process.exit(1);
  }
}

main();
