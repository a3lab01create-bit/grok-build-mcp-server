import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import {
  Job,
  cancelJob,
  elapsedSeconds,
  getJob,
  removeJob,
  startJob,
  waitForJob,
} from '../utils/jobManager.js';
import { JOBS } from '../constants.js';

const JOB_ID_DESC =
  'The job_id returned by grok or web-search when the answer was not ready yet. REQUIRED.';
const WAIT_DESC = `Seconds to wait for the job to finish before returning (0-${JOBS.MAX_WAIT_SECONDS}, default ${JOBS.DEFAULT_WAIT_SECONDS}).`;

const UNKNOWN_JOB =
  'Unknown job_id. Jobs are kept for 30 minutes after they finish and are lost when the MCP server restarts.';

function syncWaitMs(): number {
  const raw = process.env.GROK_SYNC_WAIT_SECONDS;
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  const secs = Number.isFinite(n) && n >= 0 ? n : JOBS.SYNC_WAIT_SECONDS;
  return secs === 0 ? Infinity : secs * 1000;
}

function stillRunning(job: Job): string {
  return [
    `Grok is still working on this (${elapsedSeconds(job)}s elapsed). The call returned early so it is not cut off by client tool-call timeouts.`,
    `Call grok-result with job_id "${job.id}" to get the answer; repeat while it reports the job as still running.`,
  ].join('\n');
}

/** Render a job's state, or throw if it failed so the call is marked isError. */
function formatJob(job: Job): string {
  const secs = elapsedSeconds(job);
  switch (job.status) {
    case 'running':
      return stillRunning(job);
    case 'completed':
      return `Job ${job.id} completed in ${secs}s.\n\n${job.result}`;
    case 'cancelled':
      throw new Error(`Job ${job.id} was cancelled after ${secs}s.`);
    case 'failed':
      throw new Error(`Job ${job.id} failed after ${secs}s: ${job.error}`);
  }
}

/**
 * Run `work` as a background job and wait for it up to GROK_SYNC_WAIT_SECONDS.
 * Returns the answer if it finishes in time, otherwise a job_id to collect
 * with grok-result. If the client cancels while we wait, the job is killed —
 * nobody holds its job_id yet.
 */
export async function runOrDetach(
  label: string,
  work: (signal: AbortSignal) => Promise<string>,
  signal?: AbortSignal
): Promise<string> {
  const job = startJob(label, work);
  await waitForJob(job, syncWaitMs(), signal);

  if (job.status === 'running') {
    if (signal?.aborted) {
      cancelJob(job);
      throw new Error('Cancelled by client');
    }
    return stillRunning(job);
  }

  removeJob(job);
  if (job.status === 'completed') return job.result as string;
  throw new Error(job.error);
}

function requireJob(id: string): Job {
  const job = getJob(id);
  if (!job) throw new Error(UNKNOWN_JOB);
  return job;
}

const resultArgsSchema = z.object({
  job_id: z.string().min(1).describe(JOB_ID_DESC),
  wait_seconds: z
    .number()
    .min(0)
    .max(JOBS.MAX_WAIT_SECONDS)
    .default(JOBS.DEFAULT_WAIT_SECONDS)
    .describe(WAIT_DESC),
});

export const grokResultTool: UnifiedTool = {
  name: 'grok-result',
  description:
    'Get the answer of a grok / web-search call that returned a job_id because it was still running. Waits up to wait_seconds; if still running, call again with the same job_id.',
  zodSchema: resultArgsSchema,
  annotations: {
    title: 'Get Grok Job Result',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string', description: JOB_ID_DESC },
      wait_seconds: {
        type: 'number',
        minimum: 0,
        maximum: JOBS.MAX_WAIT_SECONDS,
        default: JOBS.DEFAULT_WAIT_SECONDS,
        description: WAIT_DESC,
      },
    },
    required: ['job_id'],
  },
  execute: async (args, _onProgress, signal) => {
    const job = requireJob(args.job_id as string);
    const waitMs = (args.wait_seconds as number) * 1000;
    return formatJob(await waitForJob(job, waitMs, signal));
  },
};

const cancelArgsSchema = z.object({
  job_id: z.string().min(1).describe(JOB_ID_DESC),
});

export const grokCancelTool: UnifiedTool = {
  name: 'grok-cancel',
  description:
    'Cancel a still-running grok / web-search job and stop its grok process.',
  zodSchema: cancelArgsSchema,
  annotations: {
    title: 'Cancel Grok Job',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string', description: JOB_ID_DESC },
    },
    required: ['job_id'],
  },
  execute: async (args) => {
    const job = requireJob(args.job_id as string);
    if (job.status !== 'running') {
      return `Job ${job.id} already ${job.status}.`;
    }
    cancelJob(job);
    await waitForJob(job, 5000);
    return `Job ${job.id} ${job.status === 'running' ? 'is being cancelled' : job.status}.`;
  },
};
