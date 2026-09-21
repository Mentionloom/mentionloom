import { randomUUID } from 'node:crypto';
import { claimJobs, completeJob, failOrRetryJob } from '../lib/queue.js';
import { providerConfiguration } from '../lib/provider-secrets.js';

export const config = { maxDuration: 60 };

async function execute(job) {
  switch (job.kind) {
    case 'provider_config_check':
      return { configured: providerConfiguration(), checkedAt: new Date().toISOString() };
    default:
      throw new Error(`No worker handler registered for job kind: ${job.kind}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false });
  }

  const workerId = `vercel:${process.env.VERCEL_REGION || 'unknown'}:${randomUUID()}`;
  const jobs = await claimJobs(workerId, 8);
  const outcomes = [];

  for (const job of jobs) {
    try {
      const result = await execute(job);
      await completeJob(job, result);
      outcomes.push({ id: job.id, status: 'completed' });
    } catch (error) {
      await failOrRetryJob(job, error);
      outcomes.push({ id: job.id, status: Number(job.attempts) >= Number(job.max_attempts) ? 'failed' : 'queued' });
    }
  }

  return res.status(200).json({ ok: true, claimed: jobs.length, outcomes });
}
