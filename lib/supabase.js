export class InfraError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'InfraError';
    this.status = status;
    this.details = details;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new InfraError(503, `${name} is not configured.`);
  return value.replace(/\/$/, '');
}

function baseUrl() {
  return required('SUPABASE_URL');
}

function anonKey() {
  return required('SUPABASE_ANON_KEY');
}

function serviceKey() {
  return required('SUPABASE_SERVICE_ROLE_KEY');
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
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function authRequest(path, { method = 'GET', body, token } = {}) {
  const key = anonKey();
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function serviceRequest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const key = serviceKey();
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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
