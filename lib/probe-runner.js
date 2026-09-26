import { InfraError, serviceRequest } from './supabase.js';
import { recordCost } from './cost-ledger.js';
import { providerSecret } from './provider-secrets.js';
import { classifyAnswer, OPENAI_MODEL, PERPLEXITY_MODEL, providerCostMicrousd, citationUrl } from './launch-domain.js';

const CLASSIFIER_VERSION = 'mentionloom-rules-1.0';

function providerError(message = 'The analysis provider is temporarily unavailable.') {
  return new Error(message);
}

function cleanCitations(values = []) {
  const unique = new Map();
  for (const item of values || []) {
    const url = citationUrl(item?.url || item?.link || item);
    if (!url || unique.has(url)) continue;
    let hostname = '';
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    unique.set(url, {
      url,
      title: String(item?.title || '').slice(0, 300) || null,
      domain: hostname || null,
      excerpt: String(item?.snippet || item?.text || '').slice(0, 1000) || null,
      metadata: {},
    });
  }
  return [...unique.values()].slice(0, 20);
}

function normalizeOpenAi(data) {
  const parts = (data?.output || []).flatMap((item) => item?.content || []);
  const answer = typeof data?.output_text === 'string'
    ? data.output_text
    : parts.filter((part) => part.type === 'output_text').map((part) => part.text || '').join('\n');
  const annotations = parts.flatMap((part) => part.annotations || [])
    .filter((annotation) => annotation.type === 'url_citation')
    .map((annotation) => ({ url: annotation.url, title: annotation.title }));
  const searchCalls = (data?.output || []).filter((item) => item?.type === 'web_search_call').length;
  if (!answer.trim()) throw providerError('OpenAI returned an empty analysis.');
  return {
    answer,
    citations: cleanCitations(annotations),
    model: data.model || OPENAI_MODEL,
    requestId: data.id || null,
    inputTokens: Number(data?.usage?.input_tokens) || 0,
    cachedInputTokens: Number(data?.usage?.input_tokens_details?.cached_tokens) || 0,
    cacheWriteTokens: Number(data?.usage?.input_tokens_details?.cache_creation_input_tokens) || 0,
    outputTokens: Number(data?.usage?.output_tokens) || 0,
    searchCalls,
    raw: data,
  };
}

function normalizePerplexity(data) {
  const outputs = data?.output || [];
  const answer = typeof data?.output_text === 'string'
    ? data.output_text
    : outputs.filter((item) => item?.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((part) => part?.type === 'output_text')
      .map((part) => part.text || '')
      .join('\n');
  if (!answer.trim()) throw providerError('Perplexity returned an empty analysis.');
  const searchResults = outputs.flatMap((item) => item?.results || item?.search_results || []);
  const annotations = outputs.flatMap((item) => item?.content || [])
    .flatMap((part) => part.annotations || [])
    .filter((annotation) => ['citation','url_citation'].includes(annotation.type));
  const citations = cleanCitations([
    ...annotations,
    ...searchResults,
  ]);
  const usage = data?.usage || {};
  const exactCost = Number(usage?.cost?.total_cost);
  const toolUsage = usage?.tool_calls_details || {};
  return {
    answer,
    citations,
    model: data.model || PERPLEXITY_MODEL,
    requestId: data.id || null,
    inputTokens: Number(usage.input_tokens) || 0,
    cachedInputTokens: Number(usage.input_tokens_details?.cached_tokens) || 0,
    cacheWriteTokens: Number(usage.input_tokens_details?.cache_creation_input_tokens) || 0,
    outputTokens: Number(usage.output_tokens) || 0,
    searchCalls: Math.max(1, Number(toolUsage?.search_web?.invocation) || Number(toolUsage?.web_search?.invocation) || 0),
    exactCostMicrousd: Number.isFinite(exactCost) ? Math.round(exactCost * 1_000_000) : null,
    raw: { id: data.id || null, model: data.model || PERPLEXITY_MODEL, output: outputs, usage },
  };
}

async function providerFetch(provider, body) {
  const key = providerSecret(provider);
  if (!key) throw new InfraError(503, `${provider === 'openai' ? 'OpenAI' : 'Perplexity'} is not configured yet.`);
  const endpoint = provider === 'openai'
    ? 'https://api.openai.com/v1/responses'
    : 'https://api.perplexity.ai/v1/agent';
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35_000),
    });
  } catch {
    throw providerError();
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    console.error(`${provider} probe request failed:`, response.status);
    if (response.status === 429 || response.status >= 500) throw providerError();
    throw providerError(`${provider === 'openai' ? 'OpenAI' : 'Perplexity'} could not answer this question.`);
  }
  return provider === 'openai' ? normalizeOpenAi(data) : normalizePerplexity(data);
}

async function askOpenAi(question, context) {
  return providerFetch('openai', {
    model: OPENAI_MODEL,
    store: false,
    max_output_tokens: 1400,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    input: [{
      role: 'user',
      content: [{ type: 'input_text', text: [
        'Answer this as a neutral assistant helping a buyer. Search the public web and include useful citations.',
        `Region: ${context.region}. Language: ${context.language}.`,
        'Do not assume any brand is preferred. Compare relevant alternatives when useful.',
        `Buyer question: ${question}`,
      ].join('\n') }],
    }],
  });
}

async function askPerplexity(question, context) {
  return providerFetch('perplexity', {
    model: PERPLEXITY_MODEL,
    max_output_tokens: 1400,
    input: question,
    instructions: `Answer as a neutral assistant helping a buyer. Use current web research and cite useful sources. Do not assume a brand is preferred. Region: ${context.region}. Language: ${context.language}.`,
  });
}

async function loadProbe(probeId) {
  const rows = await serviceRequest(
    `/rest/v1/probes?select=id,workspace_id,probe_run_id,question_version_id,provider,model,region,language,status&id=eq.${encodeURIComponent(probeId)}&limit=1`,
  );
  return rows?.[0] || null;
}

async function persistProbeResult(probe, output, company) {
  const previousRows = await serviceRequest(
    `/rest/v1/answers?select=id,probe_id,raw_text,raw_json,input_tokens,output_tokens,search_calls&probe_id=eq.${encodeURIComponent(probe.id)}&limit=1`,
  );
  const previous = previousRows?.[0] || null;
  const existingRaw = previous?.raw_json || {};
  const answerOutput = output || (previous ? {
    answer: previous.raw_text,
    raw: existingRaw.providerResponse || {},
    citations: existingRaw.citations || [],
    model: existingRaw.model || probe.model,
    requestId: existingRaw.requestId || null,
    cachedInputTokens: Number(existingRaw.cachedInputTokens) || 0,
    cacheWriteTokens: Number(existingRaw.cacheWriteTokens) || 0,
    inputTokens: Number(previous.input_tokens) || 0,
    outputTokens: Number(previous.output_tokens) || 0,
    searchCalls: Number(previous.search_calls) || 0,
  } : null);
  if (!answerOutput) throw new Error('Probe response is missing.');

  await recordCost({
    workspaceId: probe.workspace_id,
    probeRunId: probe.probe_run_id,
    probeId: probe.id,
    provider: probe.provider,
    model: answerOutput.model || probe.model,
    inputTokens: answerOutput.inputTokens,
    outputTokens: answerOutput.outputTokens,
    searchCalls: answerOutput.searchCalls,
    amountMicrousd: answerOutput.exactCostMicrousd ?? providerCostMicrousd({
      provider: probe.provider,
      inputTokens: answerOutput.inputTokens,
      cachedInputTokens: answerOutput.cachedInputTokens,
      cacheWriteTokens: answerOutput.cacheWriteTokens,
      outputTokens: answerOutput.outputTokens,
      searchCalls: answerOutput.searchCalls,
    }),
    source: 'actual',
    externalId: answerOutput.requestId || `probe-${probe.id}`,
    metadata: { providerRequestId: answerOutput.requestId, pricingRevision: '2026-09-26', cachedInputTokens: answerOutput.cachedInputTokens || 0, cacheWriteTokens: answerOutput.cacheWriteTokens || 0, ...(answerOutput.exactCostMicrousd === null || answerOutput.exactCostMicrousd === undefined ? {} : { providerBilledUsd: answerOutput.exactCostMicrousd / 1_000_000 }) },
  });

  const rawJson = {
    provider: probe.provider,
    model: answerOutput.model || probe.model,
    requestId: answerOutput.requestId || null,
    cachedInputTokens: answerOutput.cachedInputTokens || 0,
    cacheWriteTokens: answerOutput.cacheWriteTokens || 0,
    citations: answerOutput.citations || [],
    providerResponse: answerOutput.raw || {},
  };
  const answerRows = await serviceRequest('/rest/v1/answers?on_conflict=probe_id', {
    method: 'POST',
    body: {
      workspace_id: probe.workspace_id,
      probe_id: probe.id,
      raw_text: answerOutput.answer,
      raw_json: rawJson,
      input_tokens: answerOutput.inputTokens,
      output_tokens: answerOutput.outputTokens,
      search_calls: answerOutput.searchCalls,
    },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  const answer = answerRows?.[0] || (await serviceRequest(
    `/rest/v1/answers?select=id,probe_id&probe_id=eq.${encodeURIComponent(probe.id)}&limit=1`,
  ))?.[0];
  if (!answer?.id) throw new Error('Analysis answer could not be stored.');

  await serviceRequest(`/rest/v1/citations?answer_id=eq.${encodeURIComponent(answer.id)}`, {
    method: 'DELETE', prefer: 'return=minimal',
  });
  const citations = answerOutput.citations || [];
  if (citations.length) {
    await serviceRequest('/rest/v1/citations', {
      method: 'POST',
      body: citations.map((citation, index) => ({
        workspace_id: probe.workspace_id,
        answer_id: answer.id,
        ordinal: index + 1,
        url: citation.url,
        title: citation.title,
        domain: citation.domain,
        excerpt: citation.excerpt,
        metadata: citation.metadata || {},
      })),
      prefer: 'return=minimal',
    });
  }

  const competitorNames = (company?.profile?.competitors || []).map((item) => item.name).filter(Boolean);
  const classification = classifyAnswer(answerOutput.answer, company?.name || '', competitorNames);
  await serviceRequest('/rest/v1/classifications?on_conflict=answer_id%2Cclassifier_version', {
    method: 'POST',
    body: {
      workspace_id: probe.workspace_id,
      answer_id: answer.id,
      classifier_version: CLASSIFIER_VERSION,
      brand_state: classification.brandState,
      competitor_states: classification.competitorStates,
      confidence: classification.confidence,
      metadata: classification.evidence,
    },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  await serviceRequest(`/rest/v1/probes?id=eq.${encodeURIComponent(probe.id)}`, {
    method: 'PATCH',
    body: { status: 'completed', model: answerOutput.model || probe.model, provider_request_id: answerOutput.requestId || null, completed_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  return { answerId: answer.id, classification: classification.brandState, citations: citations.length };
}

export async function executeProbeJob(job) {
  const probeId = job?.payload?.probeId;
  if (!probeId) throw new Error('Probe job is missing its probe id.');
  const probe = await loadProbe(probeId);
  if (!probe) throw new Error('Probe could not be found.');
  if (probe.status === 'completed') return { alreadyCompleted: true };
  const startedAt = new Date().toISOString();
  await serviceRequest(`/rest/v1/probes?id=eq.${encodeURIComponent(probe.id)}`, {
    method: 'PATCH', body: { status: 'running', started_at: startedAt }, prefer: 'return=minimal',
  });
  const versions = await serviceRequest(
    `/rest/v1/question_versions?select=id,question_id,text&id=eq.${encodeURIComponent(probe.question_version_id)}&limit=1`,
  );
  const question = versions?.[0];
  if (!question?.text) throw new Error('Probe question is missing.');
  const companyRows = await serviceRequest(
    `/rest/v1/companies?select=id,name,profile&workspace_id=eq.${encodeURIComponent(probe.workspace_id)}&order=created_at.asc&limit=1`,
  );
  const company = companyRows?.[0];
  if (!company) throw new Error('Company profile is missing.');

  const previous = await serviceRequest(
    `/rest/v1/answers?select=id,probe_id,raw_text,raw_json,input_tokens,output_tokens,search_calls&probe_id=eq.${encodeURIComponent(probe.id)}&limit=1`,
  );
  if (previous?.[0]) return persistProbeResult(probe, null, company);

  const context = { region: probe.region || company.profile?.markets?.[0] || 'United States', language: probe.language || company.profile?.languages?.[0] || 'English' };
  const output = probe.provider === 'openai'
    ? await askOpenAi(question.text, context)
    : probe.provider === 'perplexity'
      ? await askPerplexity(question.text, context)
      : (() => { throw new Error('Unsupported probe provider.'); })();
  return persistProbeResult(probe, output, company);
}

export async function failProbe(probeId, error) {
  if (!probeId) return;
  await serviceRequest(`/rest/v1/probes?id=eq.${encodeURIComponent(probeId)}`, {
    method: 'PATCH',
    body: { status: 'failed', completed_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  await updateRunStatus((await loadProbe(probeId))?.probe_run_id);
}

export async function updateRunStatus(runId) {
  if (!runId) return;
  const [probes, runRows] = await Promise.all([
    serviceRequest(`/rest/v1/probes?select=status&probe_run_id=eq.${encodeURIComponent(runId)}`),
    serviceRequest(`/rest/v1/probe_runs?select=started_at&id=eq.${encodeURIComponent(runId)}&limit=1`),
  ]);
  const rows = probes || [];
  const done = rows.every((probe) => ['completed','failed'].includes(probe.status));
  const completedCount = rows.filter((probe) => probe.status === 'completed').length;
  const failedCount = rows.filter((probe) => probe.status === 'failed').length;
  const status = !done ? 'running' : completedCount === 0 ? 'failed' : failedCount ? 'partial' : 'completed';
  await serviceRequest(`/rest/v1/probe_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    body: {
      status,
      started_at: runRows?.[0]?.started_at || new Date().toISOString(),
      ...(done ? { completed_at: new Date().toISOString() } : {}),
    },
    prefer: 'return=minimal',
  });
}
