/**
 * Logger — writes ONLY to stderr. stdout is reserved for the MCP JSON-RPC
 * channel, so anything on stdout would corrupt the protocol.
 */

import { LOG_PREFIX } from '../constants.js';

export class Logger {
  private static format(message: string): string {
    return `${LOG_PREFIX} ${message}\n`;
  }

  static log(message: string, ...args: unknown[]): void {
    console.warn(this.format(message), ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(this.format(message), ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(this.format(message), ...args);
  }

  static debug(message: string, ...args: unknown[]): void {
    if (process.env.AGY_MCP_DEBUG) {
      console.warn(this.format(message), ...args);
    }
  }

  static toolInvocation(toolName: string, args: unknown): void {
    this.debug(`Tool '${toolName}' invoked: ${JSON.stringify(args)}`);
  }

  static commandExecution(command: string, args: string[], startTime: number): void {
    this.debug(
      `[${startTime}] exec: ${command} ${args.map((a) => `"${a}"`).join(' ')}`
    );
  }

  static commandComplete(
    startTime: number,
    exitCode: number | null,
    outputLength?: number
  ): void {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.debug(
      `[${elapsed}s] exit ${exitCode}${outputLength !== undefined ? `, ${outputLength} chars` : ''}`
    );
  }
}
