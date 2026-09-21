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
});

test('provider credentials are documented as server environment variables', async () => {
  const env = await read('.env.example');
  for (const name of [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'PERPLEXITY_API_KEY',
  ]) {
    assert.match(env, new RegExp(`^${name}=`, 'm'));
  }
});

test('worker is protected and scheduled', async () => {
  const worker = await read('api/worker.js');
  const config = JSON.parse(await read('vercel.json'));
  assert.match(worker, /CRON_SECRET/);
  assert.ok(config.crons?.some((cron) => cron.path === '/api/worker'));
});
