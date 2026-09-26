import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('foundation migration contains tenant, measurement, queue and cost entities', async () => {
  const sql = await read('db/migrations/001_foundation.sql');
  for (const table of [
    'users',
    'workspaces',
    'workspace_members',
    'companies',
    'questions',
    'probe_runs',
    'probes',
    'answers',
    'citations',
    'classifications',
    'cost_ledger',
    'jobs',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
  }
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on function public\.handle_new_auth_user\(\)/i);
});

test('launch migration scopes authenticated reads to workspace members and locks trusted RPCs', async () => {
  const sql = await read('db/migrations/20260926171942_launch_onboarding_rls.sql');
  assert.match(sql, /function public\.is_workspace_member\(p_workspace_id uuid\)/i);
  assert.match(sql, /using \(public\.is_workspace_member\(workspace_id\)\)/i);
  assert.match(sql, /revoke all on function public\.ensure_workspace_for_user\(uuid, text\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.ensure_workspace_for_user\(uuid, text\) to service_role/i);
  assert.match(sql, /save_onboarding_questions/);
  assert.match(sql, /create_baseline_run/);
  assert.doesNotMatch(sql, /create policy[^;]+for\s+(?:all|insert|update|delete)\s+to authenticated/i);
  assert.match(sql, /All writes go through the authenticated Worker/);
  const helper = await read('db/migrations/20260926172037_private_rls_helper.sql');
  assert.match(helper, /function private\.is_workspace_member\(p_workspace_id uuid\)/i);
  assert.match(helper, /drop function public\.is_workspace_member\(uuid\)/i);
});

test('server credential contract includes Supabase and AI providers', async () => {
  const env = await read('.env.example');
  for (const name of [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'CRON_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'PERPLEXITY_API_KEY',
  ]) {
    assert.match(env, new RegExp(`^${name}=`, 'm'));
  }
});

test('Cloudflare Worker owns API routing and scheduled queue execution', async () => {
  const worker = await read('src/worker.js');
  const config = await read('wrangler.toml');

  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /async scheduled\(/);
  assert.match(worker, /configureRuntime\(env\)/);
  assert.match(worker, /\/api\/auth\/sign-up/);
  assert.match(worker, /\/auth\/confirm/);
  assert.match(worker, /\/auth\/v1\/verify/);
  assert.match(worker, /\/api\/workspaces/);
  assert.match(worker, /\/api\/costs/);
  assert.match(worker, /\/api\/product/);
  assert.match(worker, /\/api\/onboarding\/analyze/);
  assert.match(worker, /\/api\/analysis\/run/);
  assert.match(worker, /protectProductPage/);
  assert.match(config, /main\s*=\s*"\.\/src\/worker\.js"/);
  assert.match(config, /binding\s*=\s*"ASSETS"/);
  assert.match(config, /run_worker_first\s*=\s*\["\/api\/\*",\s*"\/auth\/confirm",\s*"\/app",\s*"\/app\/\*"\]/);
  assert.match(config, /crons\s*=\s*\["\* \* \* \* \*"\]/);
});


test('Cloudflare backend helpers accept injected runtime bindings', async () => {
  const supabase = await read('lib/supabase.js');
  const providers = await read('lib/provider-secrets.js');
  assert.match(supabase, /configureSupabaseEnv/);
  assert.match(supabase, /runtimeEnv/);
  assert.match(providers, /configureProviderEnv/);
  assert.match(providers, /runtimeEnv/);
});


test('Supabase auth requests mirror client API-key authorization headers', async () => {
  const supabase = await read('lib/supabase.js');
  assert.match(supabase, /Authorization:\s*\x60Bearer \$\{token \|\| key\}\x60/);
});
