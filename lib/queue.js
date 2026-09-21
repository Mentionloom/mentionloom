import { serviceRequest, rpc } from './supabase.js';

export async function enqueueJob({
  workspaceId = null,
  kind,
  payload = {},
  dedupeKey = null,
  maxAttempts = 5,
  availableAt = new Date().toISOString(),
}) {
  const body = {
    workspace_id: workspaceId,
    kind,
    payload,
    dedupe_key: dedupeKey,
    max_attempts: maxAttempts,
    available_at: availableAt,
  };

  const suffix = dedupeKey ? '?on_conflict=dedupe_key' : '';
  const result = await serviceRequest(`/rest/v1/jobs${suffix}`, {
    method: 'POST',
    body,
    prefer: dedupeKey
      ? 'resolution=ignore-duplicates,return=representation'
      : 'return=representation',
  });

  if (Array.isArray(result) && result[0]) return result[0];
  if (!dedupeKey) return null;

  const existing = await serviceRequest(
    `/rest/v1/jobs?select=*&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&limit=1`,
  );
  return existing?.[0] || null;
}

export async function claimJobs(workerId, limit = 8) {
  const result = await rpc('claim_jobs', {
    p_worker_id: workerId,
    p_limit: Math.min(Math.max(Number(limit) || 1, 1), 20),
  });
  return Array.isArray(result) ? result : [];
}

export async function completeJob(job, result = {}) {
  return serviceRequest(
    `/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}&locked_by=eq.${encodeURIComponent(job.locked_by)}`,
    {
      method: 'PATCH',
      body: {
        status: 'completed',
        result,
        locked_at: null,
        locked_by: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      prefer: 'return=minimal',
    },
  );
}

export async function failOrRetryJob(job, error) {
  const terminal = Number(job.attempts) >= Number(job.max_attempts);
  const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, Number(job.attempts) - 1));
  const availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  return serviceRequest(
    `/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}&locked_by=eq.${encodeURIComponent(job.locked_by)}`,
    {
      method: 'PATCH',
      body: {
        status: terminal ? 'failed' : 'queued',
        last_error: String(error?.message || error || 'Job failed').slice(0, 1000),
        available_at: terminal ? job.available_at : availableAt,
        locked_at: null,
        locked_by: null,
        completed_at: terminal ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      prefer: 'return=minimal',
    },
  );
}
