import { serviceRequest, InfraError } from './supabase.js';

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
  const amount = Number(amountMicrousd);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new InfraError(400, 'Cost amount must be a non-negative number of micro-USD.');
  }
  if (!['actual', 'estimated'].includes(source)) {
    throw new InfraError(400, 'Cost source must be actual or estimated.');
  }

  const body = {
    workspace_id: workspaceId,
    probe_run_id: probeRunId,
    probe_id: probeId,
    provider,
    model,
    input_tokens: Math.max(0, Number(inputTokens) || 0),
    output_tokens: Math.max(0, Number(outputTokens) || 0),
    search_calls: Math.max(0, Number(searchCalls) || 0),
    runtime_ms: Math.max(0, Number(runtimeMs) || 0),
    amount_microusd: Math.round(amount),
    source,
    external_id: externalId,
    metadata,
    occurred_at: occurredAt,
  };
  if (externalId && provider) {
    const existing = await serviceRequest(
      `/rest/v1/cost_ledger?select=*&provider=eq.${encodeURIComponent(provider)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`,
    );
    if (existing?.[0]?.id) return existing[0];
  }
  try {
    const result = await serviceRequest('/rest/v1/cost_ledger', {
      method: 'POST', body, prefer: 'return=representation',
    });
    return result?.[0] || null;
  } catch (error) {
    if (!externalId || !provider || !(error instanceof InfraError) || error.status !== 409) throw error;
    const duplicate = await serviceRequest(
      `/rest/v1/cost_ledger?select=*&provider=eq.${encodeURIComponent(provider)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`,
    );
    if (duplicate?.[0]?.id) return duplicate[0];
    throw error;
  }
}

export async function monthlyCost(workspaceId, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    throw new InfraError(400, 'Month must use YYYY-MM.');
  }
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new InfraError(400, 'Invalid month.');
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
