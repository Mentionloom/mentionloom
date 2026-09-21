import { signOut } from '../../lib/auth.js';
import { requireSameOrigin } from '../../lib/http.js';
import { InfraError } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    requireSameOrigin(req);
    await signOut(req, res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = error instanceof InfraError ? error.status : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Could not sign out.' : error.message });
  }
}
