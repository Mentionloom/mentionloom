import { requireUser } from '../lib/auth.js';
import { requireWorkspaceMember } from '../lib/workspaces.js';
import { monthlyCost } from '../lib/cost-ledger.js';
import { InfraError } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const user = await requireUser(req, res);
    const workspaceId = String(req.query.workspaceId || '');
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    await requireWorkspaceMember(user.id, workspaceId, ['owner', 'admin']);
    const cost = await monthlyCost(workspaceId, month);
    return res.status(200).json({ ok: true, cost });
  } catch (error) {
    const status = error instanceof InfraError ? error.status : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Cost service unavailable.' : error.message });
  }
}
