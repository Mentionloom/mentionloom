import { serviceRequest, rpc, InfraError } from './supabase.js';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function listWorkspaces(userId) {
  const memberships = await serviceRequest(
    `/rest/v1/workspace_members?select=workspace_id,role&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`,
  );
  if (!Array.isArray(memberships) || memberships.length === 0) return [];

  const ids = memberships.map((row) => row.workspace_id);
  const filter = ids.map((id) => `"${id}"`).join(',');
  const workspaces = await serviceRequest(
    `/rest/v1/workspaces?select=id,name,slug,created_at&id=in.(${encodeURIComponent(filter)})`,
  );
  const roles = new Map(memberships.map((row) => [row.workspace_id, row.role]));
  return (workspaces || []).map((workspace) => ({
    ...workspace,
    role: roles.get(workspace.id),
  }));
}

export async function createWorkspace(userId, { name, slug }) {
  const cleanName = String(name || '').trim().slice(0, 80);
  const cleanSlug = slugify(slug || cleanName);
  if (cleanName.length < 2) throw new InfraError(400, 'Workspace name is too short.');
  if (cleanSlug.length < 2) throw new InfraError(400, 'Choose a valid workspace slug.');

  const result = await rpc('create_workspace_for_user', {
    p_user_id: userId,
    p_name: cleanName,
    p_slug: cleanSlug,
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function getMembership(userId, workspaceId) {
  const result = await serviceRequest(
    `/rest/v1/workspace_members?select=workspace_id,user_id,role&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return Array.isArray(result) ? result[0] || null : null;
}

export async function requireWorkspaceMember(userId, workspaceId, roles = null) {
  if (!/^[0-9a-f-]{36}$/i.test(String(workspaceId || ''))) {
    throw new InfraError(400, 'Invalid workspace.');
  }
  const membership = await getMembership(userId, workspaceId);
  if (!membership) throw new InfraError(403, 'You do not have access to this workspace.');
  if (roles && !roles.includes(membership.role)) {
    throw new InfraError(403, 'Your workspace role cannot perform this action.');
  }
  return membership;
}
