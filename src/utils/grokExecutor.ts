import { executeCommand } from './commandExecutor.js';
import { CLI } from '../constants.js';

export interface GrokOptions {
  model?: string;
  effort?: string;
}

/**
 * Resolve the grok binary. Defaults to `grok` on PATH; override with
 * GROK_CLI_PATH for non-standard installs (e.g. ~/.grok/bin/grok not on PATH).
 */
function grokCommand(): string {
  return process.env.GROK_CLI_PATH || CLI.COMMANDS.GROK;
}

/**
 * Extract the response text from grok's `--output-format json` payload.
 * Falls back gracefully to the raw output if it is not the expected shape.
 */
function extractText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Primary: a single JSON object { text, stopReason, ... }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.text === 'string') return parsed.text;
  } catch {
    // Secondary: streaming-json — scan lines from the end for the final {text}
    const lines = trimmed.split('\n').filter((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const p = JSON.parse(lines[i]);
        if (p && typeof p.text === 'string') return p.text;
      } catch {
        /* not JSON, keep scanning */
      }
    }
  }
  return trimmed;
}

/**
 * Run a single-turn grok prompt headlessly and return the response text.
 * Uses `grok -p "<prompt>" --output-format json` for robust parsing.
 */
export async function executeGrokCLI(
  prompt: string,
  opts: GrokOptions = {},
  onProgress?: (newOutput: string) => void
): Promise<string> {
  const args: string[] = [];

  if (opts.model) {
    args.push(CLI.FLAGS.MODEL, opts.model);
  }
  if (opts.effort) {
    args.push(CLI.FLAGS.EFFORT, opts.effort);
  }
  args.push(CLI.FLAGS.OUTPUT_FORMAT, CLI.OUTPUT_JSON);

  // -p must come last; its value is the prompt.
  args.push(CLI.FLAGS.PRINT, prompt);

  const raw = await executeCommand(grokCommand(), args, onProgress);
  return extractText(raw);
}
