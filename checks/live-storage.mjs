import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { createWaitlist } from '../lib/waitlist.js';
import { blobStore } from '../lib/blob-store.js';
const secret = process.env.WAITLIST_SIGNING_SECRET;
const service = createWaitlist({ store: blobStore, secret });
const requestId = randomUUID();
const ip = `storage-smoke-${requestId}`;
const input = { email: `qa-${requestId}@example.com`, consent: true, requestId, source: 'direct' };
let token;
try {
  const signup = await service.signup(input, ip); token = signup.token; assert(token);
  const id = token.split('.')[0];
  const before = await blobStore.read(`subscribers/${id}.json`);
  assert.equal(before.value.email, input.email);
  assert.equal(before.value.stage, 'joined');
  assert.equal((await service.signup(input, ip)).token, token);
  await service.profile({ token, website: 'example.com', role: 'founder', goal: 'visibility' }, ip);
  const after = await blobStore.read(`subscribers/${id}.json`);
  assert.equal(after.value.stage, 'qualified');
  assert.equal(after.value.profile.website, 'https://example.com');
  await service.remove({ token }); token = null;
  assert.equal(await blobStore.read(`subscribers/${id}.json`), null);
  console.log('PASS: real private storage saves, deduplicates, qualifies, and removes a synthetic signup.');
} finally {
  if (token) await service.remove({ token });
  const rateKey = `limits/${createHmac('sha256', secret).update('ip:' + ip).digest('hex')}.json`;
  const counter = await blobStore.read(rateKey);
  if (counter) await blobStore.remove(rateKey, counter.etag);
}
