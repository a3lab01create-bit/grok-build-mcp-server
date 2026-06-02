import { spawn } from 'child_process';
import { Logger } from './logger.js';
import { ERROR_MESSAGES } from '../constants.js';

interface NodeError extends Error {
  code?: string;
}

/**
 * Spawn a CLI command and resolve with its trimmed stdout.
 *
 * `env: process.env` is intentional and load-bearing: it forwards HOME (and the
 * rest of the environment) to the child so the agy CLI can resolve its OAuth
 * credentials in ~/.gemini even when this server is itself spawned via npx.
 */
export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
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

    child.on('error', (error: NodeError) => {
      if (isResolved) return;
      isResolved = true;
      if (error.code === 'ENOENT') {
        reject(new Error(ERROR_MESSAGES.CLI_NOT_FOUND));
      } else {
        reject(new Error(`Failed to spawn '${command}': ${error.message}`));
      }
    });

    child.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      if (code === 0) {
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
