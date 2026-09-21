import { InfraError } from '../../lib/supabase.js';
import { signUp, setSession } from '../../lib/auth.js';
import { requireJsonBody, requireSameOrigin } from '../../lib/http.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    requireSameOrigin(req);
    const body = requireJsonBody(req, 4096);
    const result = await signUp(body.email, body.password);
    if (result?.access_token) setSession(res, result);
    return res.status(200).json({
      ok: true,
      user: result?.user ? { id: result.user.id, email: result.user.email } : null,
      needsEmailConfirmation: !result?.access_token,
    });
  } catch (error) {
    const status = error instanceof InfraError ? error.status : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Could not create the account.' : error.message });
  }
}
