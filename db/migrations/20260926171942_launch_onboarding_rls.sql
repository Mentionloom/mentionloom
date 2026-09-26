-- Launch path: persistent onboarding state, idempotent workspace bootstrap,
-- atomic question approval/run creation, and workspace-scoped table policies.

alter table public.workspaces
  add column if not exists onboarding_step text not null default 'website'
    check (onboarding_step in ('website','profile','questions','complete')),
  add column if not exists onboarding_profile_confirmed_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to service_role;

-- This SECURITY DEFINER function is only callable by the trusted Worker. Its
-- p_user_id always comes from the verified Supabase session, never request JSON.
create or replace function public.ensure_workspace_for_user(p_user_id uuid, p_name text default null)
returns setof public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_name text;
  v_slug text;
begin
  if p_user_id is null or not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'Unknown user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select w.* into v_workspace
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = p_user_id
  order by wm.created_at asc
  limit 1;

  if found then
    return next v_workspace;
    return;
  end if;

  v_name := left(coalesce(nullif(trim(p_name), ''), 'My workspace'), 80);
  if char_length(v_name) < 2 then v_name := 'My workspace'; end if;
  v_slug := left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 34);
  v_slug := trim(both '-' from v_slug);
  if char_length(v_slug) < 2 then v_slug := 'workspace'; end if;
  v_slug := v_slug || '-' || substr(replace(p_user_id::text, '-', ''), 1, 10);

  insert into public.workspaces(name, slug)
  values (v_name, v_slug)
  returning * into v_workspace;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_workspace.id, p_user_id, 'owner');

  return next v_workspace;
end;
$$;

create or replace function public.save_onboarding_questions(
  p_workspace_id uuid,
  p_questions jsonb,
  p_approve boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_question_id uuid;
  v_stage text;
  v_text text;
  v_previous_text text;
  v_version integer;
  v_keep uuid[] := array[]::uuid[];
  v_count integer;
begin
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'Questions must be an array'; end if;
  v_count := jsonb_array_length(p_questions);
  if v_count < 20 or v_count > 25 then raise exception 'Keep between 20 and 25 buyer questions'; end if;
  if p_approve and (
    not exists (
      select 1 from public.workspaces w
      where w.id = p_workspace_id and w.onboarding_profile_confirmed_at is not null
    )
    or exists (
      select stages.stage_name
      from unnest(array['discovery','comparison','decision']) as stages(stage_name)
      where (select count(*) from jsonb_array_elements(p_questions) as question(value)
        where lower(value->>'stage') = stages.stage_name) < 4
    )
  ) then
    raise exception 'Confirm the company profile and include at least four questions in each stage';
  end if;

  for v_item in select value from jsonb_array_elements(p_questions)
  loop
    v_stage := lower(trim(v_item->>'stage'));
    v_text := trim(regexp_replace(coalesce(v_item->>'text',''), '\s+', ' ', 'g'));
    if v_stage not in ('discovery','comparison','decision') or char_length(v_text) < 12 or char_length(v_text) > 280 then
      raise exception 'A question has an invalid stage or text';
    end if;

    v_question_id := nullif(v_item->>'id','')::uuid;
    if v_question_id is not null and exists (
      select 1 from public.questions q
      where q.id = v_question_id and q.workspace_id = p_workspace_id and q.status in ('draft','active')
    ) then
      select qv.text into v_previous_text
      from public.question_versions qv
      where qv.question_id = v_question_id
      order by qv.version desc limit 1;
      update public.questions
      set intent_stage = v_stage, status = case when p_approve then 'active' else 'draft' end, updated_at = now()
      where id = v_question_id;
      if v_previous_text is distinct from v_text then
        select coalesce(max(qv.version), 0) + 1 into v_version
        from public.question_versions qv where qv.question_id = v_question_id;
        insert into public.question_versions(question_id, version, text)
        values (v_question_id, v_version, v_text);
      end if;
    else
      insert into public.questions(workspace_id, intent_stage, status)
      values (p_workspace_id, v_stage, case when p_approve then 'active' else 'draft' end)
      returning id into v_question_id;
      insert into public.question_versions(question_id, version, text)
      values (v_question_id, 1, v_text);
    end if;

    v_keep := array_append(v_keep, v_question_id);
  end loop;

  update public.questions
  set status = 'archived', updated_at = now()
  where workspace_id = p_workspace_id and status in ('draft','active')
    and not (id = any(v_keep));

  update public.workspaces
  set onboarding_step = case when p_approve then 'complete' else 'questions' end,
      onboarding_completed_at = case when p_approve then coalesce(onboarding_completed_at, now()) else null end,
      updated_at = now()
  where id = p_workspace_id;
end;
$$;

create or replace function public.create_baseline_run(
  p_workspace_id uuid,
  p_region text,
  p_language text,
  p_openai_model text,
  p_perplexity_model text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_question_count integer;
begin
  select count(*) into v_question_count
  from public.questions q
  where q.workspace_id = p_workspace_id and q.status = 'active';
  if v_question_count < 20 or v_question_count > 25 then
    raise exception 'Approve between 20 and 25 buyer questions before starting a baseline';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.onboarding_profile_confirmed_at is not null
  ) then
    raise exception 'Confirm the company profile before starting a baseline';
  end if;

  insert into public.probe_runs(workspace_id, run_type, status, settings, started_at)
  values (
    p_workspace_id,
    'baseline',
    'queued',
    jsonb_build_object(
      'providers', jsonb_build_array('openai','perplexity'),
      'surface', 'provider API with web search',
      'region', p_region,
      'language', p_language,
      'samplesPerQuestionProvider', 1
    ),
    null
  )
  returning id into v_run_id;

  with versions as (
    select distinct on (q.id)
      q.id as question_id, q.workspace_id, qv.id as question_version_id
    from public.questions q
    join public.question_versions qv on qv.question_id = q.id
    where q.workspace_id = p_workspace_id and q.status = 'active'
    order by q.id, qv.version desc
  ), inserted as (
    insert into public.probes(
      workspace_id, probe_run_id, question_version_id, provider, engine, model,
      surface, region, language, run_index, status
    )
    select v.workspace_id, v_run_id, v.question_version_id, providers.provider,
      providers.engine, providers.model, providers.surface, p_region, p_language, 1, 'queued'
    from versions v
    cross join (values
      ('openai', 'OpenAI', p_openai_model, 'openai_api_web_search'),
      ('perplexity', 'Perplexity', p_perplexity_model, 'perplexity_agent_sonar')
    ) as providers(provider, engine, model, surface)
    returning id, workspace_id, probe_run_id
  )
  insert into public.jobs(workspace_id, kind, payload, dedupe_key)
  select i.workspace_id, 'probe_execute',
    jsonb_build_object('probeId', i.id, 'runId', i.probe_run_id),
    'probe:' || i.id::text
  from inserted i
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  update public.workspaces set onboarding_step = 'complete', updated_at = now()
  where id = p_workspace_id;
  return v_run_id;
end;
$$;

-- Application table reads are scoped to a user's actual workspace membership.
-- Product writes continue through the server Worker using its server-only key.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated using (id = auth.uid());

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- All writes go through the authenticated Worker and its server-only key.
-- Remove direct client-write policies so users cannot alter onboarding state,
-- workspace limits, membership roles, or measurement records from the browser.
drop policy if exists workspaces_update_admin on public.workspaces;
drop policy if exists workspace_members_insert_admin on public.workspace_members;
drop policy if exists workspace_members_update_admin on public.workspace_members;
drop policy if exists workspace_members_delete_admin on public.workspace_members;

do $$
declare
  v_table text;
  v_select_policy text;
  v_write_policy text;
begin
  foreach v_table in array array[
    'companies','competitors','questions','probe_runs','probes','answers','citations',
    'classifications','snapshots','opportunities','interventions','cost_ledger','jobs'
  ] loop
    v_select_policy := v_table || '_select_workspace_member';
    execute format('drop policy if exists %I on public.%I', v_select_policy, v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      v_select_policy, v_table
    );
  end loop;

  foreach v_table in array array[
    'companies','competitors','questions','opportunities','interventions'
  ] loop
    v_write_policy := v_table || '_write_workspace_admin';
    execute format('drop policy if exists %I on public.%I', v_write_policy, v_table);
  end loop;
end;
$$;

drop policy if exists question_versions_select_workspace_member on public.question_versions;
create policy question_versions_select_workspace_member on public.question_versions
  for select to authenticated using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and public.is_workspace_member(q.workspace_id)
    )
  );
drop policy if exists question_versions_insert_workspace_admin on public.question_versions;

revoke all on function public.ensure_workspace_for_user(uuid, text) from public, anon, authenticated;
revoke all on function public.save_onboarding_questions(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.create_baseline_run(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_workspace_for_user(uuid, text) to service_role;
grant execute on function public.save_onboarding_questions(uuid, jsonb, boolean) to service_role;
grant execute on function public.create_baseline_run(uuid, text, text, text, text) to service_role;
