create table if not exists public.waitlist_signups (
  id text primary key,
  email text not null unique,
  owner_hash text not null,
  email_verified boolean not null default false,
  source text not null default 'direct',
  attribution jsonb not null default '{}'::jsonb,
  consent jsonb not null,
  stage text not null default 'joined' check (stage in ('joined','qualified')),
  profile jsonb,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

create table if not exists public.waitlist_rate_limits (
  ip_hash text not null,
  window_id bigint not null,
  count integer not null default 1 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (ip_hash, window_id)
);

alter table public.waitlist_rate_limits enable row level security;

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

create index if not exists waitlist_signups_source_idx
  on public.waitlist_signups (source);
