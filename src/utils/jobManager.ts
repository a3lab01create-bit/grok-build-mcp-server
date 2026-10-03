/**
 * In-memory registry of background grok runs.
 *
 * Lets a client start a long Grok query and collect it with short polling
 * calls, so no single MCP request has to outlive a client-side tool timeout.
 * Jobs live only as long as this server process.
 */

import { randomUUID } from 'crypto';
import { JOBS } from '../constants.js';
import { Logger } from './logger.js';

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  label: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  result?: string;
  error?: string;
  controller: AbortController;
  done: Promise<void>;
}

const jobs = new Map<string, Job>();

function prune(now = Date.now()): void {
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOBS.RETENTION_MS) {
      jobs.delete(id);
    }
  }
}

export function startJob(
  label: string,
  run: (signal: AbortSignal) => Promise<string>
): Job {
  prune();
  const controller = new AbortController();
  const job = {
    id: randomUUID(),
    label,
    status: 'running',
    startedAt: Date.now(),
    controller,
  } as Job;

  job.done = run(controller.signal).then(
    (result) => {
      job.status = 'completed';
      job.result = result;
    },
    (error: unknown) => {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed';
      job.error = error instanceof Error ? error.message : String(error);
    }
  ).finally(() => {
    job.finishedAt = Date.now();
    Logger.debug(`Job ${job.id} ${job.status}`);
  });

  jobs.set(job.id, job);
  Logger.debug(`Job ${job.id} started: ${label}`);
  return job;
}

export function getJob(id: string): Job | undefined {
  prune();
  return jobs.get(id);
}

/**
 * Wait until the job finishes, `ms` elapses, or `signal` aborts — whichever
 * comes first. `ms` may be Infinity. Never cancels the job itself.
 */
export async function waitForJob(
  job: Job,
  ms: number,
  signal?: AbortSignal
): Promise<Job> {
  if (job.status !== 'running' || ms <= 0) return job;
  let timer: NodeJS.Timeout | undefined;
  let onAbort: (() => void) | undefined;
  await Promise.race([
    job.done,
    new Promise<void>((resolve) => {
      // setTimeout fires immediately for delays beyond 2^31-1 ms
      if (Number.isFinite(ms)) timer = setTimeout(resolve, ms);
      onAbort = resolve;
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (onAbort) signal?.removeEventListener('abort', onAbort);
  return job;
}

export function removeJob(job: Job): void {
  jobs.delete(job.id);
}

export function cancelJob(job: Job): void {
  if (job.status === 'running') {
    job.controller.abort();
  }
}

/** Stop every running grok process, e.g. when the server shuts down. */
export function cancelAllJobs(): void {
  for (const job of jobs.values()) cancelJob(job);
}

export function elapsedSeconds(job: Job): number {
  return Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000);
}
