-- Keep the membership lookup available to RLS without exposing it as a Data API RPC.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;

alter policy workspaces_select_member on public.workspaces
  using (private.is_workspace_member(id));
alter policy workspace_members_select_member on public.workspace_members
  using (private.is_workspace_member(workspace_id));

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'companies','competitors','questions','probe_runs','probes','answers','citations',
    'classifications','snapshots','opportunities','interventions','cost_ledger','jobs'
  ] loop
    execute format(
      'alter policy %I on public.%I using (private.is_workspace_member(workspace_id))',
      v_table || '_select_workspace_member', v_table
    );
  end loop;
end;
$$;

alter policy question_versions_select_workspace_member on public.question_versions
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and private.is_workspace_member(q.workspace_id)
    )
  );

drop function public.is_workspace_member(uuid);
