import { InfraError } from './supabase.js';

export function requireSameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new InfraError(403, 'Cross-site request blocked.');
  }

  const origin = req.headers.origin;
  if (!origin) return;

  let parsed;
  try { parsed = new URL(origin); } catch {
    throw new InfraError(403, 'Invalid request origin.');
  }

  if (!req.headers.host || parsed.host !== req.headers.host) {
    throw new InfraError(403, 'Cross-site request blocked.');
  }
}

export function requireJsonBody(req, maxBytes = 8192) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    throw new InfraError(415, 'Use application/json.');
  }
  if (Number(req.headers['content-length'] || 0) > maxBytes) {
    throw new InfraError(413, 'Request is too large.');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      throw new InfraError(400, 'Invalid JSON.');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InfraError(400, 'Invalid request body.');
  }
  if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) {
    throw new InfraError(413, 'Request is too large.');
  }
  return body;
}
