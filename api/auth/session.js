import { getUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    const user = await getUser(req, res);
    return res.status(200).json({
      ok: true,
      authenticated: Boolean(user),
      user: user ? { id: user.id, email: user.email } : null,
    });
  } catch {
    return res.status(503).json({ ok: false, error: 'Authentication service unavailable.' });
  }
}
