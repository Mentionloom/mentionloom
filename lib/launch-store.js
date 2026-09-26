import { InfraError, rpc, serviceRequest } from './supabase.js';
import { normalizeProfile, validateQuestionSet, validateWebsiteUrl } from './launch-domain.js';

const first = (rows) => Array.isArray(rows) ? rows[0] || null : rows || null;
const inFilter = (values) => `in.(${values.map((value) => `"${String(value).replaceAll('"', '')}"`).join(',')})`;

export async function ensurePrimaryWorkspace(user) {
  if (!user?.id) throw new InfraError(401, 'Sign in to continue.');
  await serviceRequest('/rest/v1/users?on_conflict=id', {
    method: 'POST',
    body: { id: user.id, email: user.email || null },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  const workspaces = await rpc('ensure_workspace_for_user', {
    p_user_id: user.id,
    p_name: String(user.email || '').split('@')[0].slice(0, 70) || 'My workspace',
  });
  const workspace = first(workspaces);
  if (!workspace?.id) throw new InfraError(503, 'Your workspace could not be prepared. Please try again.');
  return workspace;
}

export async function readCompany(workspaceId) {
  const rows = await serviceRequest(
    `/rest/v1/companies?select=id,workspace_id,name,website,market,language,profile,created_at,updated_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.asc&limit=1`,
  );
  const company = first(rows);
  if (!company) return null;
  const competitors = await serviceRequest(
    `/rest/v1/competitors?select=id,name,website&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.asc`,
  );
  return { ...company, profile: normalizeProfile({ ...(company.profile || {}), competitors: competitors || [] }) };
}

export async function saveCompanyDraft(workspaceId, input, { confirmed = false } = {}) {
  let website;
  try { website = validateWebsiteUrl(input?.website); } catch (error) {
    throw new InfraError(400, error.message || 'Enter a valid company website.');
  }
  const name = String(input?.name || '').trim().slice(0, 120);
  if (name.length < 2) throw new InfraError(400, 'Enter a company name.');
  const profile = normalizeProfile(input?.profile || {});
  const existing = await readCompany(workspaceId);
  const companyBody = {
    workspace_id: workspaceId,
    name,
    website,
    market: profile.markets[0] || null,
    language: profile.languages[0] || 'en',
    profile,
    updated_at: new Date().toISOString(),
  };
  let company;
  if (existing?.id) {
    const rows = await serviceRequest(`/rest/v1/companies?id=eq.${encodeURIComponent(existing.id)}`, {
      method: 'PATCH', body: companyBody, prefer: 'return=representation',
    });
    company = first(rows);
  } else {
    const rows = await serviceRequest('/rest/v1/companies', {
      method: 'POST', body: companyBody, prefer: 'return=representation',
    });
    company = first(rows);
  }
  await serviceRequest(`/rest/v1/competitors?workspace_id=eq.${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE', prefer: 'return=minimal',
  });
  if (profile.competitors.length) {
    await serviceRequest('/rest/v1/competitors', {
      method: 'POST',
      body: profile.competitors.map((competitor) => ({
        workspace_id: workspaceId,
        company_id: company.id,
        name: competitor.name,
        website: competitor.website || null,
      })),
      prefer: 'return=minimal',
    });
  }
  const workspacePatch = confirmed
    ? { onboarding_step: 'questions', onboarding_profile_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { onboarding_step: 'profile', onboarding_profile_confirmed_at: null, onboarding_completed_at: null, updated_at: new Date().toISOString() };
  await serviceRequest(`/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}`, {
    method: 'PATCH', body: workspacePatch, prefer: 'return=minimal',
  });
  return readCompany(workspaceId);
}

export async function readQuestions(workspaceId, statuses = ['draft', 'active']) {
  const statusFilter = `in.(${statuses.join(',')})`;
  const rows = await serviceRequest(
    `/rest/v1/questions?select=id,intent_stage,status,created_at,updated_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&status=${encodeURIComponent(statusFilter)}&order=created_at.asc`,
  );
  if (!rows?.length) return [];
  const versions = await serviceRequest(
    `/rest/v1/question_versions?select=id,question_id,version,text,created_at&question_id=${encodeURIComponent(inFilter(rows.map((row) => row.id)))}&order=version.desc`,
  );
  const latest = new Map();
  for (const version of versions || []) if (!latest.has(version.question_id)) latest.set(version.question_id, version);
  return rows.map((question) => ({
    id: question.id,
    stage: question.intent_stage,
    status: question.status,
    text: latest.get(question.id)?.text || '',
    version: latest.get(question.id)?.version || 0,
  }));
}

export async function saveQuestionDraft(workspaceId, questions, approve) {
  let valid;
  try { valid = validateQuestionSet(questions, { minCount: 20, maxCount: 25, minPerStage: 4 }); }
  catch (error) { throw new InfraError(400, error.message); }
  await rpc('save_onboarding_questions', {
    p_workspace_id: workspaceId,
    p_questions: valid.map(({ id, stage, text }) => ({ id, stage, text })),
    p_approve: Boolean(approve),
  });
  return readQuestions(workspaceId, ['draft', 'active']);
}

export async function readProductData(workspace) {
  const [company, questions, runs, opportunities] = await Promise.all([
    readCompany(workspace.id),
    readQuestions(workspace.id),
    serviceRequest(`/rest/v1/probe_runs?select=id,run_type,status,settings,started_at,completed_at,created_at&workspace_id=eq.${encodeURIComponent(workspace.id)}&order=created_at.desc&limit=10`),
    serviceRequest(`/rest/v1/opportunities?select=id,title,evidence,suggested_change,status,created_at&workspace_id=eq.${encodeURIComponent(workspace.id)}&order=created_at.desc&limit=20`),
  ]);
  const latestRun = runs?.[0] || null;
  if (!latestRun) return { company, questions, runs: runs || [], latestRun, opportunities: opportunities || [], summary: null };

  const probes = await serviceRequest(
    `/rest/v1/probes?select=id,provider,model,surface,region,language,status,started_at,completed_at,question_version_id&probe_run_id=eq.${encodeURIComponent(latestRun.id)}&order=created_at.asc`,
  );
  const versionIds = [...new Set((probes || []).map((probe) => probe.question_version_id))];
  const versions = versionIds.length ? await serviceRequest(
    `/rest/v1/question_versions?select=id,question_id,text&id=${encodeURIComponent(inFilter(versionIds))}`,
  ) : [];
  const versionMap = new Map((versions || []).map((version) => [version.id, version]));
  const probeIds = (probes || []).map((probe) => probe.id);
  const answers = probeIds.length ? await serviceRequest(
    `/rest/v1/answers?select=id,probe_id,raw_text,input_tokens,output_tokens,search_calls,created_at&probe_id=${encodeURIComponent(inFilter(probeIds))}`,
  ) : [];
  const answerIds = (answers || []).map((answer) => answer.id);
  const [classifications, citations] = answerIds.length ? await Promise.all([
    serviceRequest(`/rest/v1/classifications?select=answer_id,brand_state,competitor_states,confidence,metadata&answer_id=${encodeURIComponent(inFilter(answerIds))}`),
    serviceRequest(`/rest/v1/citations?select=answer_id,url,title,domain,ordinal&answer_id=${encodeURIComponent(inFilter(answerIds))}&order=ordinal.asc`),
  ]) : [[], []];
  const answerMap = new Map((answers || []).map((answer) => [answer.probe_id, answer]));
  const classificationMap = new Map((classifications || []).map((row) => [row.answer_id, row]));
  const citationMap = new Map();
  for (const citation of citations || []) {
    citationMap.set(citation.answer_id, [...(citationMap.get(citation.answer_id) || []), citation]);
  }
  const evidence = (probes || []).map((probe) => {
    const version = versionMap.get(probe.question_version_id);
    const answer = answerMap.get(probe.id);
    const classification = answer && classificationMap.get(answer.id);
    return {
      ...probe,
      questionId: version?.question_id || null,
      question: version?.text || '',
      answer: answer?.raw_text || null,
      classification: classification?.brand_state || null,
      competitorStates: classification?.competitor_states || {},
      citations: answer ? citationMap.get(answer.id) || [] : [],
    };
  });
  const completed = evidence.filter((item) => item.answer).length;
  const recommended = evidence.filter((item) => ['recommended','shortlisted'].includes(item.classification)).length;
  const citationCount = evidence.reduce((count, item) => count + item.citations.length, 0);
  const providers = Object.fromEntries(['openai','perplexity'].map((provider) => {
    const items = evidence.filter((item) => item.provider === provider);
    return [provider, { total: items.length, completed: items.filter((item) => item.answer).length, failed: items.filter((item) => item.status === 'failed').length }];
  }));
  const stages = Object.fromEntries(['discovery','comparison','decision'].map((stage) => {
    const items = evidence.filter((item) => questions.find((question) => question.id === item.questionId)?.stage === stage);
    return [stage, { total: items.length, mentioned: items.filter((item) => item.classification && item.classification !== 'absent').length, recommended: items.filter((item) => ['recommended','shortlisted'].includes(item.classification)).length }];
  }));
  return {
    company, questions, runs: runs || [], latestRun, opportunities: opportunities || [], evidence,
    summary: { total: evidence.length, completed, failed: evidence.filter((item) => item.status === 'failed').length, pending: evidence.length - completed, recommendationShare: completed ? recommended / completed : null, mentions: evidence.filter((item) => item.classification && item.classification !== 'absent').length, citationCount, providers, stages },
  };
}
