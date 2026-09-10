import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWaitlist, consentText } from '../lib/waitlist.js';
import { memoryStore } from './memory-store.mjs';
const secret = 'test-secret-only-'.repeat(4);
const input = () => ({ email: 'Founder@Example.com', consent: true, requestId: randomUUID(), source: 'hero', attribution: { utm_source: 'newsletter', referrer: 'https://example.org/sensitive?token=private' } });
function setup() { const store = memoryStore(); return { store, service: createWaitlist({ store, secret }) }; }
test('signup persists normalized email, consent and bounded attribution before qualification', async () => {
  const { store, service } = setup();
  const result = await service.signup(input(), '1');
  assert(result.token);
  const subscriber = [...store.records.entries()].find(([key]) => key.startsWith('subscribers/'))[1].value;
  assert.equal(subscriber.email, 'founder@example.com');
  assert.equal(subscriber.consent.text, consentText);
  assert.equal(subscriber.emailVerified, false);
  assert.equal(subscriber.stage, 'joined');
  assert.equal(subscriber.profile, null);
  assert.equal(subscriber.attribution.referrer, 'example.org');
  assert.equal(subscriber.source, 'hero');
  assert(!JSON.stringify([...store.records.keys()]).includes('founder'));
});
test('network retries recover the same token; duplicates cannot take over or overwrite a signup', async () => {
  const { store, service } = setup(); const first = input();
  const original = await service.signup(first, '1');
  assert.equal((await service.signup(first, '1')).token, original.token);
  assert.equal((await service.signup({ ...first, requestId: randomUUID(), source: 'closing' }, '2')).token, null);
  assert.equal([...store.records.keys()].filter(key => key.startsWith('subscribers/')).length, 1);
  const record = [...store.records.values()].find(row => row.value.email);
  assert.equal(record.value.source, 'hero');
});
test('concurrent duplicate signups create one subscriber and one owner', async () => {
  const { store, service } = setup();
  const results = await Promise.all([service.signup(input(), '1'), service.signup(input(), '2')]);
  assert.equal(results.filter(r => r.token).length, 1);
  assert.equal([...store.records.keys()].filter(k => k.startsWith('subscribers/')).length, 1);
});
test('profile requires ownership and stores only valid, optional qualification fields', async () => {
  const { store, service } = setup(); const { token } = await service.signup(input(), '1');
  await assert.rejects(service.profile({ token: token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), website: 'evil.com' }, '1'), { status: 401 });
  await assert.rejects(service.profile({ token, website: 'invalid' }, '1'), { status: 400 });
  await assert.rejects(service.profile({ token, website: 'https://user:password@example.com' }, '1'), { status: 400 });
  await assert.rejects(service.profile({ token, role: 'injected' }, '1'), { status: 400 });
  await service.profile({ token }, '1');
  assert.equal([...store.records.values()].find(r => r.value.email).value.stage, 'joined');
  await service.profile({ token, website: 'example.com/a?private=1', role: 'founder', goal: 'visibility' }, '1');
  const record = [...store.records.values()].find(row => row.value.email).value;
  assert.deepEqual(record.profile, { website: 'https://example.com', role: 'founder', goal: 'visibility' });
  assert.equal(record.stage, 'qualified');
});
test('invalid email, missing consent, invalid request IDs and honeypots never persist subscribers', async () => {
  const { store, service } = setup();
  for (const body of [{ ...input(), email: 'broken' }, { ...input(), consent: false }, { ...input(), requestId: '../bad' }]) await assert.rejects(service.signup(body, '1'), { status: 400 });
  assert.deepEqual(await service.signup({ ...input(), company_fax: 'bot' }, '1'), { ok: true, token: null });
  assert.equal(store.records.size, 0);
});
test('rate limits are stored, shared across instances, and reset after the window', async () => {
  const store = memoryStore(); let time = 0;
  const service = createWaitlist({ store, secret, now: () => time });
  for (let i = 0; i < 12; i++) await service.signup(input(), '1');
  const otherInstance = createWaitlist({ store, secret, now: () => time });
  await assert.rejects(otherInstance.signup(input(), '1'), { status: 429 });
  time = 900001;
  assert.equal((await otherInstance.signup(input(), '1')).ok, true);
});
test('remove is private and retry-safe; an old token cannot delete a new signup for the same email', async () => {
  const { service } = setup(); const { token } = await service.signup(input(), '1');
  assert.equal((await service.status({ token })).ok, true);
  await service.remove({ token }); await service.remove({ token });
  await assert.rejects(service.status({ token }), { status: 404 });
  const renewed = await service.signup(input(), '1');
  await assert.rejects(service.remove({ token }), { status: 404 });
  assert.equal((await service.status({ token: renewed.token })).ok, true);
});
test('storage failures fail closed instead of reporting a successful signup', async () => {
  const service = createWaitlist({ store: { async read() { throw new Error('offline'); } }, secret });
  await assert.rejects(service.signup(input(), '1'), /offline/);
});
