import { createWaitlist, WaitlistError } from '../lib/waitlist.js';
import { blobStore } from '../lib/blob-store.js';

export const config = { maxDuration: 30 };

export function createHandler({ store = blobStore, secret = () => process.env.WAITLIST_SIGNING_SECRET } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use the signup form to join the waitlist.' });
  }
  try {
    let origin;
    try { origin = new URL(req.headers.origin); } catch {}
    if (!origin || origin.host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') throw new WaitlistError(403, 'Please use the form on the Mentionloom website.');
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new WaitlistError(415, 'Please refresh the page and try again.');
    if (Number(req.headers['content-length']) > 4096) throw new WaitlistError(413, 'That request is too large.');
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new WaitlistError(400, 'Please refresh the page and try again.'); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WaitlistError(400, 'Please refresh the page and try again.');
    if (Buffer.byteLength(JSON.stringify(body)) > 4096) throw new WaitlistError(413, 'That request is too large.');
    if (!['signup', 'profile', 'remove', 'status'].includes(body.action)) throw new WaitlistError(400, 'This action is not supported.');
    const service = createWaitlist({ store, secret: secret() });
    // Vercel sets this header at its trusted proxy. It is never retained as a raw IP.
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
    const result = await service[body.action](body, ip);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof WaitlistError) {
      if (error.status === 429) res.setHeader('Retry-After', '900');
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    // Avoid logging request bodies, addresses, or secret tokens.
    console.error('Waitlist storage request failed:', error.name);
    return res.status(503).json({ ok: false, error: 'We couldn’t save that just now. Please try again in a moment.' });
  }
}
}
export default createHandler();
