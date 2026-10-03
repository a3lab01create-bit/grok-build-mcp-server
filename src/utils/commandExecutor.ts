import { spawn } from 'child_process';
import { Logger } from './logger.js';
import { ERROR_MESSAGES } from '../constants.js';

export interface ExecuteOptions {
  /** Kill the child when this signal aborts (client cancel, job cancel). */
  signal?: AbortSignal;
  /** Kill the child after this many ms. 0 or undefined disables the limit. */
  timeoutMs?: number;
}

/**
 * Spawn a CLI command and resolve with its trimmed stdout.
 *
 * `env: process.env` is intentional and load-bearing: it forwards HOME (and the
 * rest of the environment) to the child so the grok CLI can resolve its
 * credentials even when this server is itself spawned via npx.
 */
export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  options: ExecuteOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { signal, timeoutMs } = options;
    if (signal?.aborted) {
      reject(new Error('Cancelled before start'));
      return;
    }

    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    const child = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;
    let lastReportedLength = 0;
    let killReason: string | undefined;

    const kill = (reason: string) => {
      if (isResolved || killReason) return;
      killReason = reason;
      Logger.debug(`Killing '${command}': ${reason}`);
      child.kill();
    };

    const onAbort = () => kill('cancelled');
    signal?.addEventListener('abort', onAbort, { once: true });

    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(
            () => kill(`timed out after ${Math.round(timeoutMs / 1000)}s`),
            timeoutMs
          )
        : undefined;

    const finish = () => {
      isResolved = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (onProgress && stdout.length > lastReportedLength) {
        onProgress(stdout.substring(lastReportedLength));
        lastReportedLength = stdout.length;
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (isResolved) return;
      finish();
      if (error.code === 'ENOENT') {
        reject(new Error(ERROR_MESSAGES.CLI_NOT_FOUND));
      } else {
        reject(new Error(`Failed to spawn '${command}': ${error.message}`));
      }
    });

    child.on('close', (code) => {
      if (isResolved) return;
      finish();
      if (killReason) {
        Logger.commandComplete(startTime, code);
        reject(new Error(`Grok CLI ${killReason}`));
      } else if (code === 0) {
        Logger.commandComplete(startTime, code, stdout.length);
        resolve(stdout.trim());
      } else {
        Logger.commandComplete(startTime, code);
        const message = stderr.trim() || stdout.trim() || 'Unknown error';
        reject(new Error(`Command failed (exit ${code}): ${message}`));
      }
    });
  });
}
