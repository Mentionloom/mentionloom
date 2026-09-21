export class InfraError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'InfraError';
    this.status = status;
    this.details = details;
  }
}

function requiredAny(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new InfraError(503, `${names.join(' or ')} is not configured.`);
}

function baseUrl() {
  return requiredAny(['SUPABASE_URL']).replace(/\/$/, '');
}

function publishableKey() {
  return requiredAny(['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY']);
}

function secretKey() {
  return requiredAny(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
}

function isLegacyJwt(value) {
  return typeof value === 'string' && value.startsWith('eyJ');
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Infrastructure request failed.';
    throw new InfraError(response.status, String(message), payload);
  }
  return payload;
}

export function isDatabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export async function authRequest(path, { method = 'GET', body, token } = {}) {
  const key = publishableKey();
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function serviceRequest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const key = secretKey();
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(isLegacyJwt(key) ? { Authorization: `Bearer ${key}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function rpc(name, args = {}) {
  return serviceRequest(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: args,
    prefer: 'return=representation',
  });
}
