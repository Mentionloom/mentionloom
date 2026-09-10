import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../api/waitlist.js';
import { memoryStore } from './memory-store.mjs';
const secret = 'test-secret-only-'.repeat(4);
const body = () => ({ action: 'signup', email: 'api@example.com', consent: true, requestId: randomUUID() });
async function call(handler, options = {}) {
  const req = { method: 'POST', headers: { host: 'mentionloom.vercel.app', origin: 'https://mentionloom.vercel.app', 'content-type': 'application/json' }, body: body(), ...options };
  const res = { headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler(req, res); return res;
}
test('API saves a valid signup and prevents caching', async () => {
  const result = await call(createHandler({ store: memoryStore(), secret: () => secret }));
  assert.equal(result.code, 200); assert.equal(result.data.ok, true); assert(result.data.token);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('API rejects unsupported methods, cross-site submissions, malformed bodies and oversized payloads', async () => {
  const handler = createHandler({ store: memoryStore(), secret: () => secret });
  assert.equal((await call(handler, { method: 'GET' })).code, 405);
  assert.equal((await call(handler, { headers: { host: 'mentionloom.vercel.app', origin: 'https://attacker.example', 'content-type': 'application/json' } })).code, 403);
  assert.equal((await call(handler, { headers: { host: 'mentionloom.vercel.app', 'content-type': 'application/json' } })).code, 403);
  assert.equal((await call(handler, { headers: { host: 'mentionloom.vercel.app', origin: 'https://mentionloom.vercel.app', 'content-type': 'text/plain' } })).code, 415);
  assert.equal((await call(handler, { body: '{bad json' })).code, 400);
  assert.equal((await call(handler, { body: { ...body(), extra: 'x'.repeat(5000) } })).code, 413);
  assert.equal((await call(handler, { body: { action: '__proto__' } })).code, 400);
});
