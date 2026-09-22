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
  assert.match(worker, /\/api\/auth\/sign-up/);
  assert.match(worker, /\/auth\/confirm/);
  assert.match(worker, /\/auth\/v1\/verify/);
  assert.match(worker, /\/api\/workspaces/);
  assert.match(worker, /\/api\/costs/);
  assert.match(config, /main\s*=\s*"\.\/src\/worker\.js"/);
  assert.match(config, /binding\s*=\s*"ASSETS"/);
  assert.match(config, /run_worker_first\s*=\s*\["\/api\/\*",\s*"\/auth\/confirm"\]/);
  assert.match(config, /crons\s*=\s*\["\*\/5 \* \* \* \*"\]/);
});
