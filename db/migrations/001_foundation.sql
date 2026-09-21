-- Mentionloom foundation: Supabase Auth + Postgres + workspaces + measurement entities
-- + a Postgres-backed job queue + exact cost ledger.
-- Apply in a Supabase project before enabling the authenticated product APIs.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_auth_user();

insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email, updated_at = now();

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,47}$'),
  monthly_cost_limit_microusd bigint,
  monthly_probe_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  website text not null,
  market text,
  language text not null default 'en',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_workspace_idx on public.companies(workspace_id);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  website text,
  created_at timestamptz not null default now()
);
create index if not exists competitors_workspace_idx on public.competitors(workspace_id);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  intent_stage text not null check (intent_stage in ('discovery','comparison','decision')),
  is_control boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questions_workspace_idx on public.questions(workspace_id, status);

create table if not exists public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version integer not null check (version > 0),
  text text not null,
  created_at timestamptz not null default now(),
  unique (question_id, version)
);

create table if not exists public.probe_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_type text not null check (run_type in ('snapshot','baseline','scheduled','remeasurement','divergence')),
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  settings jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists probe_runs_workspace_created_idx on public.probe_runs(workspace_id, created_at desc);

create table if not exists public.probes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  probe_run_id uuid not null references public.probe_runs(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id),
  provider text not null,
  engine text not null,
  model text not null,
  surface text not null,
  region text,
  language text not null default 'en',
  run_index integer not null check (run_index > 0),
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  provider_request_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists probes_run_idx on public.probes(probe_run_id, status);
create index if not exists probes_workspace_created_idx on public.probes(workspace_id, created_at desc);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  probe_id uuid not null unique references public.probes(id) on delete cascade,
  raw_text text not null,
  raw_json jsonb,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  search_calls integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists answers_workspace_idx on public.answers(workspace_id, created_at desc);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  ordinal integer not null,
  url text not null,
  title text,
  domain text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (answer_id, ordinal)
);
create index if not exists citations_answer_idx on public.citations(answer_id);

create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  classifier_version text not null,
  brand_state text not null check (brand_state in ('absent','mentioned','shortlisted','recommended')),
  competitor_states jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (answer_id, classifier_version)
);
create index if not exists classifications_workspace_idx on public.classifications(workspace_id, created_at desc);

create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  probe_run_id uuid references public.probe_runs(id) on delete set null,
  scope jsonb not null default '{}'::jsonb,
  recommendation_share numeric(7,4),
  lost_recommendation_share numeric(7,4),
  band_low numeric(7,4),
  band_high numeric(7,4),
  sample_size integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists snapshots_workspace_idx on public.snapshots(workspace_id, created_at desc);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  title text not null,
  evidence jsonb not null default '{}'::jsonb,
  suggested_change jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','started','shipped','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_workspace_idx on public.opportunities(workspace_id, status);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  baseline_run_id uuid references public.probe_runs(id) on delete set null,
  followup_run_id uuid references public.probe_runs(id) on delete set null,
  hypothesis text,
  changes jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','in_progress','shipped','remeasured','cancelled')),
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interventions_workspace_idx on public.interventions(workspace_id, status);

create table if not exists public.cost_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  probe_run_id uuid references public.probe_runs(id) on delete set null,
  probe_id uuid references public.probes(id) on delete set null,
  provider text,
  model text,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  search_calls integer not null default 0 check (search_calls >= 0),
  runtime_ms bigint not null default 0 check (runtime_ms >= 0),
  amount_microusd bigint not null check (amount_microusd >= 0),
  currency char(3) not null default 'USD',
  source text not null default 'actual' check (source in ('actual','estimated')),
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists cost_ledger_external_id_idx
  on public.cost_ledger(provider, external_id)
  where external_id is not null;
create index if not exists cost_ledger_workspace_month_idx
  on public.cost_ledger(workspace_id, occurred_at desc);
create index if not exists cost_ledger_run_idx on public.cost_ledger(probe_run_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists jobs_dedupe_key_idx on public.jobs(dedupe_key) where dedupe_key is not null;
create index if not exists jobs_claim_idx on public.jobs(status, available_at, created_at);
create index if not exists jobs_workspace_idx on public.jobs(workspace_id, created_at desc);

create or replace function public.create_workspace_for_user(
  p_user_id uuid,
  p_name text,
  p_slug text
)
returns setof public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
begin
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Unknown user';
  end if;

  insert into public.workspaces(name, slug)
  values (p_name, p_slug)
  returning * into v_workspace;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_workspace.id, p_user_id, 'owner');

  return next v_workspace;
end;
$$;

create or replace function public.claim_jobs(
  p_worker_id text,
  p_limit integer default 8
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from public.jobs
    where attempts < max_attempts
      and (
        (status = 'queued' and available_at <= now())
        or
        (status = 'running' and locked_at < now() - interval '15 minutes')
      )
    order by available_at asc, created_at asc
    for update skip locked
    limit least(greatest(p_limit, 1), 20)
  )
  update public.jobs j
  set
    status = 'running',
    locked_at = now(),
    locked_by = p_worker_id,
    attempts = j.attempts + 1,
    updated_at = now()
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

-- Browser clients never talk directly to application tables. Authenticated product
-- requests go through Vercel APIs, which verify workspace membership server-side.
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.companies enable row level security;
alter table public.competitors enable row level security;
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.probe_runs enable row level security;
alter table public.probes enable row level security;
alter table public.answers enable row level security;
alter table public.citations enable row level security;
alter table public.classifications enable row level security;
alter table public.snapshots enable row level security;
alter table public.opportunities enable row level security;
alter table public.interventions enable row level security;
alter table public.cost_ledger enable row level security;
alter table public.jobs enable row level security;

revoke all on function public.create_workspace_for_user(uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.create_workspace_for_user(uuid, text, text) to service_role;
grant execute on function public.claim_jobs(text, integer) to service_role;
