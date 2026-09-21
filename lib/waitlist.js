import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export class WaitlistError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const hash = value => createHash('sha256').update(value).digest('hex');
const text = (value, max = 100) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const roles = ['founder', 'marketing', 'agency', 'other'];
const goals = ['visibility', 'traffic', 'improvements'];
const urgencies = ['now', 'soon', 'exploring'];
const tracking = ['nothing', 'manual', 'tool', 'agency'];
const sources = ['header', 'hero', 'waitlist', 'closing', 'footer', 'app', 'direct'];
export const consentText = 'I agree to receive emails about Mentionloom early access and launch updates.';

export function createWaitlist({ store, secret, now = () => Date.now() }) {
  if (!secret || secret.length < 32) throw new Error('Waitlist signing secret is not configured.');
  const sign = value => createHmac('sha256', secret).update(value).digest('hex');
  function tokenFor(id, requestId) {
    const payload = `${id}.${requestId}`;
    return `${payload}.${sign('manage:' + payload)}`;
  }
  function parseToken(token) {
    if (typeof token !== 'string' || token.length > 220) throw new WaitlistError(401, 'This signup link is not valid.');
    const [id, nonce, signature, extra] = token.split('.');
    if (extra || !/^[a-f0-9]{64}$/.test(id || '') || !/^[a-f0-9-]{36}$/i.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '')) throw new WaitlistError(401, 'This signup link is not valid.');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`manage:${id}.${nonce}`)))) throw new WaitlistError(401, 'This signup link is not valid.');
    return { id, nonce };
  }
  async function owned(token) {
    const { id, nonce } = parseToken(token);
    const record = await store.read(`subscribers/${id}.json`);
    if (!record || record.value.ownerHash !== hash(nonce)) throw new WaitlistError(404, 'This signup is no longer available.');
    return { id, ...record };
  }
  async function rateLimit(ip) {
    const key = `limits/${sign('ip:' + ip)}.json`;
    const window = Math.floor(now() / 900000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const previous = await store.read(key);
      const count = previous?.value.window === window ? previous.value.count : 0;
      if (count >= 12) throw new WaitlistError(429, 'A few too many attempts. Please try again in 15 minutes.');
      const value = { window, count: count + 1, expiresAt: now() + 86400000 };
      const saved = previous ? await store.replace(key, value, previous.etag) : await store.create(key, value);
      if (saved) return;
    }
    throw new WaitlistError(429, 'Please wait a moment and try again.');
  }
  async function signup(body, ip) {
    if (text(body.company_fax)) return { ok: true, token: null };
    const email = text(body.email, 255).toLowerCase();
    if (!/^[^\s@<>]{1,64}@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(email) || email.length > 254) throw new WaitlistError(400, 'Enter a valid email address.');
    if (body.consent !== true) throw new WaitlistError(400, 'Please agree to receive early-access updates.');
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId || '')) throw new WaitlistError(400, 'Please refresh the page and try again.');
    await rateLimit(ip);
    const id = sign('email:' + email);
    const key = `subscribers/${id}.json`;
    const attribution = {};
    for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'ref']) {
      const value = text(body.attribution?.[name], 100);
      if (value) attribution[name] = value;
    }
    // Keep only the referring hostname, never query strings or full browsing URLs.
    try { attribution.referrer = new URL(body.attribution?.referrer).hostname; } catch {}
    const record = {
      id, email, createdAt: new Date(now()).toISOString(),
      ownerHash: hash(body.requestId), emailVerified: false,
      source: sources.includes(body.source) ? body.source : 'direct', attribution,
      consent: { text: consentText, version: '2026-09-10', at: new Date(now()).toISOString() },
      stage: 'joined', profile: null,
    };
    if (await store.create(key, record)) {
      const persisted = await store.read(key);
      if (!persisted || persisted.value?.email !== email) throw new Error('Waitlist persistence verification failed.');
      return { ok: true, token: tokenFor(id, body.requestId) };
    }
    // A retry from the same browser can recover its response. Another signup cannot edit an existing lead.
    const existing = await store.read(key);
    return { ok: true, token: existing?.value.ownerHash === record.ownerHash ? tokenFor(id, body.requestId) : null };
  }
  async function profile(body, ip) {
    const current = await owned(body.token);
    await rateLimit(ip);
    const website = text(body.website, 300);
    let normalized = '';
    if (website) {
      try {
        const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
        if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password || /[\s<>]/.test(website)) throw new Error();
        normalized = url.origin;
      } catch { throw new WaitlistError(400, 'Enter a website such as company.com, or leave it blank.'); }
    }
    if (body.role && !roles.includes(body.role)) throw new WaitlistError(400, 'Choose one of the roles shown.');
    if (body.goal && !goals.includes(body.goal)) throw new WaitlistError(400, 'Choose one of the goals shown.');
    if (body.urgency && !urgencies.includes(body.urgency)) throw new WaitlistError(400, 'Choose one of the timing options shown.');
    if (body.tracking && !tracking.includes(body.tracking)) throw new WaitlistError(400, 'Choose one of the tracking options shown.');
    const values = { website: normalized, role: body.role || '', goal: body.goal || '', urgency: body.urgency || '', tracking: body.tracking || '' };
    if (!Object.values(values).some(Boolean)) return { ok: true };
    const saved = await store.replace(`subscribers/${current.id}.json`, {
      ...current.value, profile: values, stage: 'qualified', qualifiedAt: new Date(now()).toISOString(),
    }, current.etag);
    if (!saved) throw new WaitlistError(409, 'Your details changed in another tab. Please try saving again.');
    return { ok: true };
  }
  async function remove(body) {
    const { id, nonce } = parseToken(body.token);
    const current = await store.read(`subscribers/${id}.json`);
    if (!current) return { ok: true };
    if (current.value.ownerHash !== hash(nonce)) throw new WaitlistError(404, 'This signup is no longer available.');
    await store.remove(`subscribers/${id}.json`, current.etag);
    return { ok: true };
  }
  async function status(body) {
    await owned(body.token);
    return { ok: true };
  }
  return { signup, profile, remove, status };
}
