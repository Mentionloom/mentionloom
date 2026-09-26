import { authRequest, configureSupabaseEnv, InfraError, rpc, serviceRequest } from '../lib/supabase.js';
import { createWorkspace, listWorkspaces, requireWorkspaceMember } from '../lib/workspaces.js';
import { monthlyCost } from '../lib/cost-ledger.js';
import { claimJobs, completeJob, failOrRetryJob } from '../lib/queue.js';
import { configureProviderEnv, providerConfiguration } from '../lib/provider-secrets.js';
import { analyzeCompanyWebsite, generateBuyerQuestions } from '../lib/onboarding.js';
import { ensurePrimaryWorkspace, readCompany, readProductData, saveCompanyDraft, saveQuestionDraft } from '../lib/launch-store.js';
import { OPENAI_MODEL, PERPLEXITY_MODEL } from '../lib/launch-domain.js';
import { executeProbeJob, failProbe, updateRunStatus } from '../lib/probe-runner.js';

const ACCESS_COOKIE = 'ml_access';
const REFRESH_COOKIE = 'ml_refresh';
const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function configureRuntime(env) {
  configureSupabaseEnv(env);
  configureProviderEnv(env);
}

function json(body, status = 200, headers = {}, cookies = []) {
  const responseHeaders = new Headers({ ...JSON_HEADERS, ...headers });
  for (const cookie of cookies) responseHeaders.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function cookieMap(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index === -1
          ? [part, '']
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function cookie(name, value, maxAge, secure = true) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    secure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function sessionCookies(session, request) {
  if (!session?.access_token || !session?.refresh_token) return [];
  const secure = new URL(request.url).protocol === 'https:';
  return [
    cookie(ACCESS_COOKIE, session.access_token, Math.max(60, Number(session.expires_in) || 3600), secure),
    cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30, secure),
  ];
}

function clearSessionCookies(request) {
  const secure = new URL(request.url).protocol === 'https:';
  return [
    cookie(ACCESS_COOKIE, '', 0, secure),
    cookie(REFRESH_COOKIE, '', 0, secure),
  ];
}

function requireSameOrigin(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new InfraError(403, 'Cross-site request blocked.');
  }

  const origin = request.headers.get('origin');
  if (!origin) return;

  let parsed;
  try { parsed = new URL(origin); } catch {
    throw new InfraError(403, 'Invalid request origin.');
  }

  if (parsed.host !== new URL(request.url).host) {
    throw new InfraError(403, 'Cross-site request blocked.');
  }
}

async function jsonBody(request, maxBytes = 8192) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new InfraError(415, 'Use application/json.');
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new InfraError(413, 'Request is too large.');

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new InfraError(413, 'Request is too large.');
  }

  let body;
  try { body = JSON.parse(text); } catch {
    throw new InfraError(400, 'Invalid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InfraError(400, 'Invalid request body.');
  }
  return body;
}

function validateCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new InfraError(400, 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new InfraError(400, 'Password must be between 10 and 128 characters.');
  }
  return { email: normalizedEmail, password };
}

async function signUp(email, password, redirectTo) {
  const redirectQuery = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  return authRequest(`/auth/v1/signup${redirectQuery}`, {
    method: 'POST',
    body: validateCredentials(email, password),
  });
}

async function signIn(email, password) {
  return authRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: validateCredentials(email, password),
  });
}

const EMAIL_OTP_TYPES = new Set([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]);

function safeNextPath(value, fallback = '/app/overview/') {
  const next = String(value || '').trim();
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.startsWith('/auth/confirm')) return fallback;
  return next;
}

function redirectResponse(location, cookies = []) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    Location: location,
  });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

async function handleAuthConfirm(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const url = new URL(request.url);
  const tokenHash = String(url.searchParams.get('token_hash') || '');
  const type = String(url.searchParams.get('type') || '');
  const next = safeNextPath(url.searchParams.get('next'));

  if (!tokenHash || !EMAIL_OTP_TYPES.has(type)) {
    return redirectResponse('/app/sign-in/?auth=confirmation-missing');
  }

  try {
    const session = await authRequest('/auth/v1/verify', {
      method: 'POST',
      body: {
        token_hash: tokenHash,
        type,
      },
    });

    if (!session?.access_token || !session?.refresh_token) {
      throw new InfraError(400, 'Confirmation did not return a session.');
    }

    return redirectResponse(next, sessionCookies(session, request));
  } catch (error) {
    if (error instanceof InfraError && [400, 401, 403, 422].includes(error.status)) {
      return redirectResponse('/app/sign-in/?auth=confirmation-error');
    }
    throw error;
  }
}

async function fetchUser(accessToken) {
  return authRequest('/auth/v1/user', { token: accessToken });
}

async function getUser(request) {
  const cookies = cookieMap(request.headers.get('cookie'));
  const access = cookies[ACCESS_COOKIE];
  const refresh = cookies[REFRESH_COOKIE];

  if (access) {
    try {
      return { user: await fetchUser(access), cookies: [], accessToken: access };
    } catch (error) {
      if (!(error instanceof InfraError) || ![401, 403].includes(error.status)) throw error;
    }
  }

  if (!refresh) return { user: null, cookies: [] };

  try {
    const session = await authRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refresh },
    });
    return {
      user: await fetchUser(session.access_token),
      cookies: sessionCookies(session, request),
      accessToken: session.access_token,
    };
  } catch (error) {
    if (error instanceof InfraError && [400, 401, 403].includes(error.status)) {
      return { user: null, cookies: clearSessionCookies(request) };
    }
    throw error;
  }
}

async function requireUser(request) {
  const session = await getUser(request);
  if (!session.user?.id) throw new InfraError(401, 'Sign in to continue.');
  return session;
}

async function handleSignUp(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);
  const body = await jsonBody(request, 4096);
  const redirectTo = `${new URL(request.url).origin}/auth/confirm?next=${encodeURIComponent('/app/onboarding/')}`;
  const result = await signUp(body.email, body.password, redirectTo);
  const cookies = result?.access_token ? sessionCookies(result, request) : [];

  return json({
    ok: true,
    user: result?.user ? { id: result.user.id, email: result.user.email } : null,
    needsEmailConfirmation: !result?.access_token,
  }, 200, {}, cookies);
}

async function handlePasswordReset(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);
  const body = await jsonBody(request, 4096);
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) {
    throw new InfraError(400, 'Enter a valid email address.');
  }
  const redirectTo = `${new URL(request.url).origin}/auth/confirm?next=${encodeURIComponent('/app/reset-password/')}`;
  await authRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    body: { email },
  });
  return json({ ok: true });
}

async function handlePasswordUpdate(request) {
  if (request.method !== 'PUT') return methodNotAllowed('PUT');
  requireSameOrigin(request);
  const body = await jsonBody(request, 4096);
  const session = await requireUser(request);
  if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) {
    throw new InfraError(400, 'Password must be between 10 and 128 characters.');
  }
  await authRequest('/auth/v1/user', {
    method: 'PUT',
    body: { password: body.password },
    token: session.accessToken,
  });
  return json({ ok: true }, 200, {}, session.cookies);
}

async function handleSignIn(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);
  const body = await jsonBody(request, 4096);

  try {
    const session = await signIn(body.email, body.password);
    return json({
      ok: true,
      user: session?.user ? { id: session.user.id, email: session.user.email } : null,
    }, 200, {}, sessionCookies(session, request));
  } catch (error) {
    if (error instanceof InfraError && [400, 401].includes(error.status)) {
      throw new InfraError(401, 'Email or password is incorrect.');
    }
    throw error;
  }
}

async function handleSignOut(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);

  const cookies = cookieMap(request.headers.get('cookie'));
  if (cookies[ACCESS_COOKIE]) {
    try {
      await authRequest('/auth/v1/logout', { method: 'POST', token: cookies[ACCESS_COOKIE] });
    } catch {}
  }

  return json({ ok: true }, 200, {}, clearSessionCookies(request));
}

async function handleSession(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const session = await getUser(request);
  return json({
    ok: true,
    authenticated: Boolean(session.user),
    user: session.user ? { id: session.user.id, email: session.user.email } : null,
  }, 200, {}, session.cookies);
}

async function handleWorkspaces(request) {
  const session = await requireUser(request);

  if (request.method === 'GET') {
    const workspace = await ensurePrimaryWorkspace(session.user);
    return json({
      ok: true,
      workspaces: await listWorkspaces(session.user.id),
      workspace,
    }, 200, {}, session.cookies);
  }

  if (request.method === 'POST') {
    requireSameOrigin(request);
    const body = await jsonBody(request, 4096);
    const workspace = await createWorkspace(session.user.id, body);
    return json({ ok: true, workspace }, 201, {}, session.cookies);
  }

  return methodNotAllowed('GET, POST');
}

async function productContext(request) {
  const session = await requireUser(request);
  const workspace = await ensurePrimaryWorkspace(session.user);
  return { session, workspace };
}

async function handleProduct(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const { session, workspace } = await productContext(request);
  const data = await readProductData(workspace);
  return json({ ok: true, workspace, data }, 200, {}, session.cookies);
}

async function handleWebsiteAnalyze(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);
  const body = await jsonBody(request, 4096);
  const { session, workspace } = await productContext(request);
  const result = await analyzeCompanyWebsite({ workspaceId: workspace.id, website: body.website });
  const company = await saveCompanyDraft(workspace.id, result.company);
  return json({ ok: true, company }, 200, {}, session.cookies);
}

async function handleCompanyProfile(request) {
  if (!['GET','PUT'].includes(request.method)) return methodNotAllowed('GET, PUT');
  const { session, workspace } = await productContext(request);
  if (request.method === 'GET') {
    return json({ ok: true, company: await readCompany(workspace.id) }, 200, {}, session.cookies);
  }
  requireSameOrigin(request);
  const body = await jsonBody(request, 16_384);
  const company = await saveCompanyDraft(workspace.id, body.company || body, { confirmed: Boolean(body.confirmed) });
  return json({ ok: true, company }, 200, {}, session.cookies);
}

async function handleOnboardingQuestions(request) {
  if (!['GET','POST','PUT'].includes(request.method)) return methodNotAllowed('GET, POST, PUT');
  const { session, workspace } = await productContext(request);
  if (request.method === 'GET') {
    const data = await readProductData(workspace);
    return json({ ok: true, questions: data.questions }, 200, {}, session.cookies);
  }
  requireSameOrigin(request);
  const body = await jsonBody(request, 24_000);
  if (request.method === 'POST') {
    if (!workspace.onboarding_profile_confirmed_at) {
      throw new InfraError(409, 'Confirm the company profile before generating buyer questions.');
    }
    const company = await readCompany(workspace.id);
    if (!company) throw new InfraError(409, 'Analyze and confirm your company profile first.');
    const questions = await generateBuyerQuestions({ workspaceId: workspace.id, company });
    const saved = await saveQuestionDraft(workspace.id, questions, false);
    await serviceRequest(`/rest/v1/workspaces?id=eq.${encodeURIComponent(workspace.id)}`, {
      method: 'PATCH', body: { onboarding_step: 'questions' }, prefer: 'return=minimal',
    });
    return json({ ok: true, questions: saved }, 200, {}, session.cookies);
  }
  const questions = await saveQuestionDraft(workspace.id, body.questions, Boolean(body.approve));
  return json({ ok: true, questions, approved: Boolean(body.approve) }, 200, {}, session.cookies);
}

async function handleStartRun(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  requireSameOrigin(request);
  const { session, workspace } = await productContext(request);
  const configured = providerConfiguration();
  if (!configured.openai || !configured.perplexity) {
    throw new InfraError(503, 'Add the OpenAI and Perplexity API keys to the Cloudflare Worker before starting an analysis.');
  }
  const existing = await serviceRequest(
    `/rest/v1/probe_runs?select=id,status&workspace_id=eq.${encodeURIComponent(workspace.id)}&status=in.(queued,running)&limit=1`,
  );
  if (existing?.[0]) return json({ ok: true, runId: existing[0].id, alreadyRunning: true }, 200, {}, session.cookies);
  const company = await readCompany(workspace.id);
  if (!company) throw new InfraError(409, 'Confirm your company profile before starting an analysis.');
  const result = await rpc('create_baseline_run', {
    p_workspace_id: workspace.id,
    p_region: company.profile?.markets?.[0] || company.market || 'United States',
    p_language: company.profile?.languages?.[0] || company.language || 'English',
    p_openai_model: OPENAI_MODEL,
    p_perplexity_model: PERPLEXITY_MODEL,
  });
  const runId = Array.isArray(result) ? result[0] : result;
  if (!runId) throw new InfraError(503, 'The first analysis could not be queued. Please try again.');
  return json({ ok: true, runId }, 202, {}, session.cookies);
}

async function handleCosts(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const session = await requireUser(request);
  const url = new URL(request.url);
  const workspaceId = String(url.searchParams.get('workspaceId') || '');
  const month = String(url.searchParams.get('month') || new Date().toISOString().slice(0, 7));

  await requireWorkspaceMember(session.user.id, workspaceId, ['owner', 'admin']);
  return json({
    ok: true,
    cost: await monthlyCost(workspaceId, month),
  }, 200, {}, session.cookies);
}

async function executeJob(job) {
  switch (job.kind) {
    case 'provider_config_check':
      return {
        configured: providerConfiguration(),
        checkedAt: new Date().toISOString(),
      };
    case 'probe_execute': {
      const result = await executeProbeJob(job);
      await updateRunStatus(job.payload?.runId);
      return result;
    }
    default:
      throw new Error(`No worker handler registered for job kind: ${job.kind}`);
  }
}

async function processQueue(limit = 8) {
  const workerId = `cloudflare:${crypto.randomUUID()}`;
  const jobs = await claimJobs(workerId, Math.min(Math.max(Number(limit) || 1, 1), 20));
  const outcomes = await Promise.all(jobs.map(async (job) => {
    try {
      const result = await executeJob(job);
      await completeJob(job, result);
      return { id: job.id, status: 'completed' };
    } catch (error) {
      await failOrRetryJob(job, error);
      if (Number(job.attempts) >= Number(job.max_attempts)) {
        await failProbe(job.payload?.probeId, error).catch(() => {});
      }
      return {
        id: job.id,
        status: Number(job.attempts) >= Number(job.max_attempts) ? 'failed' : 'queued',
      };
    }
  }));

  return { claimed: jobs.length, outcomes };
}

async function handleWorker(request, env) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed('GET, POST');
  if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return json({ ok: false }, 401);
  }
  return json({ ok: true, ...(await processQueue()) });
}

function methodNotAllowed(allow) {
  return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: allow });
}

function isProductDocumentRoute(path) {
  if (path !== '/app' && !path.startsWith('/app/')) return false;
  if (path === '/app/demo' || path.startsWith('/app/demo/')) return false;
  const relative = path.slice('/app/'.length);
  return !relative.split('/').some((segment) => segment.includes('.'));
}

async function protectProductPage(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/app';
  const session = await getUser(request);
  const publicAuthPage = ['/app/sign-in','/app/sign-up','/app/forgot-password'].includes(path);
  const resetPage = path === '/app/reset-password';
  if (!session.user) {
    if (publicAuthPage) return envAsset(request, env, session.cookies);
    return redirectResponse(`/app/sign-in/?next=${encodeURIComponent(path + url.search)}`, session.cookies);
  }

  if (resetPage) return envAsset(request, env, session.cookies);
  if (publicAuthPage) {
    const workspace = await ensurePrimaryWorkspace(session.user);
    return redirectResponse(workspace.onboarding_step === 'complete' ? '/app/overview/' : '/app/onboarding/', session.cookies);
  }

  const workspace = await ensurePrimaryWorkspace(session.user);
  if (path !== '/app/onboarding' && workspace.onboarding_step !== 'complete') {
    return redirectResponse('/app/onboarding/', session.cookies);
  }
  if (path === '/app' && workspace.onboarding_step === 'complete') {
    return redirectResponse('/app/overview/', session.cookies);
  }
  if (!['/app/overview','/app/questions','/app/opportunities','/app/onboarding'].includes(path)) {
    return redirectResponse('/app/overview/', session.cookies);
  }
  if (path === '/app/onboarding' && workspace.onboarding_step === 'complete') {
    return redirectResponse('/app/overview/', session.cookies);
  }
  return envAsset(request, env, session.cookies);
}

async function envAsset(request, env, cookies = []) {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(error) {
  if (error instanceof InfraError) {
    const upstreamCode = error.details?.error_code || error.details?.code || null;
    const upstreamMessage = String(error.message || '').toLowerCase();

    if (error.status >= 500) {
      const emailDeliveryFailure =
        upstreamMessage.includes('confirmation email') ||
        upstreamMessage.includes('smtp') ||
        upstreamMessage.includes('sending email') ||
        upstreamMessage.includes('send email');

      return json({
        ok: false,
        error: emailDeliveryFailure
          ? 'Could not send the confirmation email. Check Supabase SMTP settings.'
          : 'Service temporarily unavailable.',
        ...(upstreamCode ? { code: String(upstreamCode) } : {}),
      }, error.status);
    }

    return json({
      ok: false,
      error: error.message,
      ...(upstreamCode ? { code: String(upstreamCode) } : {}),
    }, error.status);
  }

  console.error('Mentionloom Worker request failed:', error?.name || 'Error');
  return json({ ok: false, error: 'Service temporarily unavailable.' }, 500);
}

async function handleApi(request, env) {
  const path = new URL(request.url).pathname;

  try {
    if (path === '/api/health') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return json({
        ok: true,
        databaseConfigured: Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)),
        workerConfigured: Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)),
        providers: { openai: Boolean(env.OPENAI_API_KEY), perplexity: Boolean(env.PERPLEXITY_API_KEY) },
      });
    }
    if (path === '/api/auth/sign-up') return await handleSignUp(request);
    if (path === '/api/auth/sign-in') return await handleSignIn(request);
    if (path === '/api/auth/sign-out') return await handleSignOut(request);
    if (path === '/api/auth/session') return await handleSession(request);
    if (path === '/api/auth/password-reset') return await handlePasswordReset(request);
    if (path === '/api/auth/password-update') return await handlePasswordUpdate(request);
    if (path === '/api/workspaces') return await handleWorkspaces(request);
    if (path === '/api/product') return await handleProduct(request);
    if (path === '/api/onboarding/analyze') return await handleWebsiteAnalyze(request);
    if (path === '/api/onboarding/profile') return await handleCompanyProfile(request);
    if (path === '/api/onboarding/questions') return await handleOnboardingQuestions(request);
    if (path === '/api/analysis/run') return await handleStartRun(request);
    if (path === '/api/costs') return await handleCosts(request);
    if (path === '/api/worker') return await handleWorker(request, env);

    return json({ ok: false, error: 'Not found.' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  async fetch(request, env) {
    configureRuntime(env);
    const path = new URL(request.url).pathname;

    try {
      if (path === '/auth/confirm') return await handleAuthConfirm(request);
      if (path.startsWith('/api/')) return handleApi(request, env);
      if (isProductDocumentRoute(path)) return protectProductPage(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  },

  async scheduled(_controller, env, ctx) {
    configureRuntime(env);
    if (!env.SUPABASE_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) return;
    ctx.waitUntil(
      processQueue().catch((error) => {
        console.error('Mentionloom scheduled worker failed:', error?.name || 'Error');
      }),
    );
  },
};
