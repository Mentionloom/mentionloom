import { authRequest, InfraError } from './supabase.js';

const ACCESS_COOKIE = 'ml_access';
const REFRESH_COOKIE = 'ml_refresh';

function cookieMap(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index === -1
          ? [part, '']
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  const next = current
    ? [...(Array.isArray(current) ? current : [current]), value]
    : [value];
  res.setHeader('Set-Cookie', next);
}

function serializeCookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSession(res) {
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, '', 0));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, '', 0));
}

export function setSession(res, session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const accessMaxAge = Math.max(60, Number(session.expires_in) || 3600);
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, session.access_token, accessMaxAge));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
}

function validateCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new InfraError(400, 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new InfraError(400, 'Password must be between 10 and 128 characters.');
  }
  return { email: normalizedEmail, password };
}

export async function signUp(email, password) {
  const credentials = validateCredentials(email, password);
  return authRequest('/auth/v1/signup', { method: 'POST', body: credentials });
}

export async function signIn(email, password) {
  const credentials = validateCredentials(email, password);
  return authRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: credentials });
}

export async function signOut(req, res) {
  const cookies = cookieMap(req.headers.cookie);
  if (cookies[ACCESS_COOKIE]) {
    try {
      await authRequest('/auth/v1/logout', { method: 'POST', token: cookies[ACCESS_COOKIE] });
    } catch {}
  }
  clearSession(res);
}

async function fetchUser(accessToken) {
  return authRequest('/auth/v1/user', { token: accessToken });
}

export async function getUser(req, res) {
  const cookies = cookieMap(req.headers.cookie);
  const access = cookies[ACCESS_COOKIE];
  const refresh = cookies[REFRESH_COOKIE];

  if (access) {
    try {
      return await fetchUser(access);
    } catch (error) {
      if (!(error instanceof InfraError) || ![401, 403].includes(error.status)) throw error;
    }
  }

  if (!refresh) return null;

  try {
    const session = await authRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refresh },
    });
    setSession(res, session);
    return await fetchUser(session.access_token);
  } catch (error) {
    clearSession(res);
    if (error instanceof InfraError && [400, 401, 403].includes(error.status)) return null;
    throw error;
  }
}

export async function requireUser(req, res) {
  const user = await getUser(req, res);
  if (!user?.id) throw new InfraError(401, 'Sign in to continue.');
  return user;
}
