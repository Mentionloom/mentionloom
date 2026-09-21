import { serviceRequest } from './supabase.js';

export async function recordCost({
  workspaceId,
  probeRunId = null,
  probeId = null,
  provider = null,
  model = null,
  inputTokens = 0,
  outputTokens = 0,
  searchCalls = 0,
  runtimeMs = 0,
  amountMicrousd,
  source = 'actual',
  externalId = null,
  metadata = {},
  occurredAt = new Date().toISOString(),
}) {
  const result = await serviceRequest('/rest/v1/cost_ledger', {
    method: 'POST',
    body: {
      workspace_id: workspaceId,
      probe_run_id: probeRunId,
      probe_id: probeId,
      provider,
      model,
      input_tokens: Math.max(0, Number(inputTokens) || 0),
      output_tokens: Math.max(0, Number(outputTokens) || 0),
      search_calls: Math.max(0, Number(searchCalls) || 0),
      runtime_ms: Math.max(0, Number(runtimeMs) || 0),
      amount_microusd: Math.max(0, Math.round(Number(amountMicrousd) || 0)),
      source,
      external_id: externalId,
      metadata,
      occurred_at: occurredAt,
    },
    prefer: 'return=representation',
  });
  return result?.[0] || null;
}

export async function monthlyCost(workspaceId, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw new Error('Month must use YYYY-MM.');
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid month.');
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const rows = await serviceRequest(
    `/rest/v1/cost_ledger?select=amount_microusd,provider,source&workspace_id=eq.${encodeURIComponent(workspaceId)}&occurred_at=gte.${encodeURIComponent(start.toISOString())}&occurred_at=lt.${encodeURIComponent(end.toISOString())}`,
  );

  const byProvider = {};
  let totalMicrousd = 0;
  for (const row of rows || []) {
    const value = Number(row.amount_microusd) || 0;
    totalMicrousd += value;
    const key = row.provider || 'runtime';
    byProvider[key] = (byProvider[key] || 0) + value;
  }

  return {
    workspaceId,
    month,
    totalMicrousd,
    totalUsd: totalMicrousd / 1_000_000,
    byProviderMicrousd: byProvider,
  };
}
