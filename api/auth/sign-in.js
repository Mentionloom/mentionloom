import { InfraError } from '../../lib/supabase.js';
import { signIn, setSession } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    const session = await signIn(req.body?.email, req.body?.password);
    setSession(res, session);
    return res.status(200).json({
      ok: true,
      user: session?.user ? { id: session.user.id, email: session.user.email } : null,
    });
  } catch (error) {
    const status = error instanceof InfraError ? error.status : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Could not sign in.' : 'Email or password is incorrect.' });
  }
}
