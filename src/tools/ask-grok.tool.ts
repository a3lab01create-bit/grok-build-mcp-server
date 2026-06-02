import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGrokCLI } from '../utils/grokExecutor.js';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../constants.js';

const PROMPT_DESC =
  "The question or task for Grok. REQUIRED. Use @ prefix to include files (e.g. '@src/app.ts explain the auth flow'). Grok is especially strong at web research, direct critique / red-teaming, and code + analysis.";
const MODEL_DESC =
  'Grok model id to use (optional). Omit to use the CLI default.';
const EFFORT_DESC =
  'Reasoning effort level (optional): low | medium | high | xhigh | max.';

const askGrokArgsSchema = z.object({
  prompt: z.string().min(1).describe(PROMPT_DESC),
  model: z.string().optional().describe(MODEL_DESC),
  effort: z
    .enum(['low', 'medium', 'high', 'xhigh', 'max'])
    .optional()
    .describe(EFFORT_DESC),
});

export const askGrokTool: UnifiedTool = {
  name: 'grok',
  description:
    'Query xAI Grok (the Grok Build CLI) — strong at web research, direct critique / red-teaming, and code + analysis. Use @path to include files in the prompt.',
  zodSchema: askGrokArgsSchema,
  annotations: {
    title: 'Query Grok (xAI)',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: PROMPT_DESC },
      model: { type: 'string', description: MODEL_DESC },
      effort: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'xhigh', 'max'],
        description: EFFORT_DESC,
      },
    },
    required: ['prompt'],
  },
  prompt: { description: 'Query Grok AI with optional model and effort level.' },
  execute: async (args, onProgress) => {
    const prompt = (args.prompt as string)?.trim();
    if (!prompt) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }
    const result = await executeGrokCLI(
      prompt,
      {
        model: args.model as string | undefined,
        effort: args.effort as string | undefined,
      },
      onProgress
    );
    return `${STATUS_MESSAGES.GROK_RESPONSE}\n${result}`;
  },
};
