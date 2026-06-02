import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGrokCLI } from '../utils/grokExecutor.js';

const QUERY_DESC =
  'Search query for web search. REQUIRED. Natural language or keywords. Grok searches the web (including X / Twitter) and synthesizes results.';
const SUMMARIZE_DESC =
  'Return a synthesized summary (default true) vs raw results.';

const searchArgsSchema = z.object({
  query: z.string().min(1).describe(QUERY_DESC),
  summarize: z.boolean().default(true).describe(SUMMARIZE_DESC),
});

export const searchTool: UnifiedTool = {
  name: 'web-search',
  description:
    'Search the web (including X / Twitter) via Grok and synthesize results.',
  zodSchema: searchArgsSchema,
  annotations: {
    title: 'Web Search (Grok)',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: QUERY_DESC },
      summarize: { type: 'boolean', default: true, description: SUMMARIZE_DESC },
    },
    required: ['query'],
  },
  prompt: { description: 'Search the web (incl. X) for real-time info via Grok.' },
  execute: async (args, onProgress) => {
    const query = (args.query as string)?.trim();
    if (!query) {
      throw new Error('Please provide a search query');
    }
    const searchPrompt =
      args.summarize !== false
        ? `Search the web for: "${query}". Provide a comprehensive summary of the findings with key facts, dates, and sources.`
        : `Search the web for: "${query}". Return the raw search results with sources.`;

    const result = await executeGrokCLI(searchPrompt, {}, onProgress);
    return `Search results for "${query}":\n\n${result}`;
  },
};
