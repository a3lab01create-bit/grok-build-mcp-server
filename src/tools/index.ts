// Tool registry index — registers all tools.
import { toolRegistry } from './registry.js';
import { askGrokTool } from './ask-grok.tool.js';
import { searchTool } from './search.tool.js';
import { pingTool, helpTool } from './simple-tools.js';

toolRegistry.push(
  // Core Grok tools
  askGrokTool,
  searchTool,

  // Utility tools
  pingTool,
  helpTool
);

export * from './registry.js';
