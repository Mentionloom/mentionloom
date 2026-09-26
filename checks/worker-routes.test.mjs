import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

function environment() {
  return {
    ASSETS: { fetch: async () => new Response('shell', { status: 200 }) },
  };
}

test('unauthenticated app documents, including /app, redirect to sign-in', async () => {
  for (const path of ['/app', '/app/', '/app/overview/']) {
    const response = await worker.fetch(new Request(`https://mentionloom.test${path}`), environment());
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /^\/app\/sign-in\/\?next=/);
  }
});

test('sign-in and the separately labelled demo are public documents', async () => {
  for (const path of ['/app/sign-in/', '/app/demo/', '/app/demo/overview/']) {
    const response = await worker.fetch(new Request(`https://mentionloom.test${path}`), environment());
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'shell');
  }
});

test('browser JavaScript assets remain public while product APIs require a session', async () => {
  const env = environment();
  const asset = await worker.fetch(new Request('https://mentionloom.test/app/product.js'), env);
  assert.equal(asset.status, 200);

  const response = await worker.fetch(new Request('https://mentionloom.test/api/product'), env);
  assert.equal(response.status, 401);
});
