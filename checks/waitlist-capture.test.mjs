import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const tables = { waitlist_signups: [], waitlist_rate_limits: [] };
let failInsert = false;
let handler;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select'; }
  select() { return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; this.required = true; return this; }
  insert(values) { this.operation = 'insert'; this.values = values; return this; }
  upsert(values) { this.operation = 'upsert'; this.values = values; return this; }
  update(values) { this.operation = 'update'; this.values = values; return this; }
  delete() { this.operation = 'delete'; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    const rows = tables[this.table];
    let selected = rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
    if (this.operation === 'insert') {
      if (failInsert) return { data: null, error: new Error('Simulated database failure') };
      if (rows.some(row => row.id === this.values.id)) return { data: null, error: { code: '23505' } };
      rows.push(structuredClone(this.values)); selected = [rows.at(-1)];
    } else if (this.operation === 'upsert') {
      let row = rows.find(row => row.ip_hash === this.values.ip_hash && row.window_id === this.values.window_id);
      if (row) Object.assign(row, this.values); else rows.push(row = structuredClone(this.values));
      selected = [row];
    } else if (this.operation === 'update') {
      selected.forEach(row => Object.assign(row, structuredClone(this.values)));
    } else if (this.operation === 'delete') {
      tables[this.table] = rows.filter(row => !selected.includes(row));
    }
    if (this.required && selected.length !== 1) return { data: null, error: new Error('Missing row') };
    return { data: structuredClone(this.one ? selected[0] ?? null : selected), error: null };
  }
}
const source = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/waitlist/index.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, ''));
vm.runInNewContext(source, {
  Deno: { env: { get: name => name === 'SUPABASE_URL' ? 'https://test.invalid' : 'test-only-not-a-live-key' }, serve: fn => { handler = fn; } },
  createClient: () => ({ from: table => new Query(table) }),
  crypto: webcrypto, TextEncoder, Uint8Array, URL, Response, Request,
  console: { error() {} },
  fetch: async () => { throw new Error('No external requests allowed in this test'); },
});
const nonce = webcrypto.randomUUID();
const base = { action: 'signup', email: 'waitlist-test@example.com', website: 'Example.COM/about?ref=test', formVersion: 'email-website-v1', consent: true, requestId: nonce, source: 'navigation' };
async function call(overrides = {}, origin = 'https://mentionloom.com') {
  const response = await handler(new Request('https://test.invalid/waitlist', {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ ...base, ...overrides }),
  }));
  return { status: response.status, body: await response.json(), headers: response.headers };
}
const first = await call();
assert.equal(first.status, 200);
assert.equal(first.body.ok, true);
assert.match(first.body.token, /^[a-f0-9]{64}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/);
assert.equal(tables.waitlist_signups.length, 1);
assert.equal(tables.waitlist_signups[0].email, base.email);
assert.equal(tables.waitlist_signups[0].profile.website, 'https://example.com');
assert.equal(tables.waitlist_signups[0].stage, 'joined');
assert.equal(first.headers.get('access-control-allow-origin'), 'https://mentionloom.com');
assert.equal((await call()).body.token, first.body.token);
assert.equal(tables.waitlist_signups.length, 1);
await call({ website: 'https://corrected.example.com' });
assert.equal(tables.waitlist_signups[0].profile.website, 'https://corrected.example.com');
const other = await call({ requestId: webcrypto.randomUUID(), website: 'https://not-owner.example.com' });
assert.equal(other.body.token, null);
assert.equal(tables.waitlist_signups[0].profile.website, 'https://corrected.example.com');
for (const website of ['', undefined, 'not a website', 'localhost', 'javascript:alert(1)', 'https://user:pass@example.com', 'ftp://example.com', '-bad.example.com', 'https://foo_bar.example.com']) {
  assert.equal((await call({ website })).status, 400, `Invalid website accepted: ${website}`);
}
assert.equal((await call({ consent: false })).status, 400);
assert.equal((await call({}, 'https://attacker.example')).status, 403);
const legacy = await call({ email: 'legacy-test@example.com', website: undefined, formVersion: undefined, requestId: webcrypto.randomUUID() });
assert.equal(legacy.status, 200, 'Legacy email-only clients must keep working');
failInsert = true;
assert.equal((await call({ email: 'db-failure@example.com', requestId: webcrypto.randomUUID() })).status, 503);
assert.equal(tables.waitlist_signups.some(row => row.email === 'db-failure@example.com'), false);
console.log('PASS: atomic email + website insert; normalization; idempotent retry; owner-only website update; duplicate privacy; 9 invalid URLs; consent; CORS; legacy compatibility; database failure.');
