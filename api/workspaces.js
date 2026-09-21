import { requireUser } from '../lib/auth.js';
import { createWorkspace, listWorkspaces } from '../lib/workspaces.js';
import { InfraError } from '../lib/supabase.js';
import { requireJsonBody, requireSameOrigin } from '../lib/http.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireUser(req, res);

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, workspaces: await listWorkspaces(user.id) });
    }

    if (req.method === 'POST') {
      requireSameOrigin(req);
      const body = requireJsonBody(req, 4096);
      const workspace = await createWorkspace(user.id, body);
      return res.status(201).json({ ok: true, workspace });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error) {
    const status = error instanceof InfraError ? error.status : 500;
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Workspace service unavailable.' : error.message });
  }
}
