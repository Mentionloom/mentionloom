# Mentionloom infrastructure foundation

Mentionloom's production foundation is Cloudflare Workers + Supabase. The existing Acme workspace is still illustrative until live provider probes replace `app/lib/data.js`.

## Runtime decisions

- **Application/runtime:** Cloudflare Worker + Static Assets.
- **Auth + Postgres:** Supabase.
- **Sessions:** Supabase access/refresh tokens stored in secure HTTP-only cookies by the Cloudflare Worker.
- **Application data access:** server-side through Supabase using a backend secret key. Customer tables have RLS enabled and no browser-facing policies.
- **Workspaces:** `users → workspace_members → workspaces`, with `owner/admin/member/viewer` roles.
- **Queue:** Postgres `jobs` table with atomic `FOR UPDATE SKIP LOCKED` claiming, retries and stale-lease recovery. Cloudflare Cron invokes the Worker's `scheduled()` handler every five minutes.
- **Provider secrets:** OpenAI, Claude, Gemini and Perplexity keys remain Worker secrets.
- **Cost ledger:** provider/runtime charges are attributable to workspace, run and probe in micro-USD.

## Supabase status

The `mentionloom` Supabase project exists in the Mentionloom organization in `eu-west-1`.

`db/migrations/001_foundation.sql` has been applied. It creates the multi-tenant and measurement schema, queue and `cost_ledger`.

The security-definer auth trigger is not callable by public, anonymous or normal authenticated roles. RLS-with-no-policy notices are intentional because browser clients do not read application tables directly.

## Cloudflare configuration

The project URL and publishable key are non-secret values in `wrangler.toml`.

Required Worker secret:

```text
SUPABASE_SECRET_KEY
```

Optional manual queue endpoint secret:

```text
CRON_SECRET
```

Legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported temporarily. Prefer `SUPABASE_SECRET_KEY`.

Later provider secrets:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
PERPLEXITY_API_KEY
```

Never expose backend/provider secrets in HTML, client JS, analytics, static build output or Git.

## Auth endpoints

- `POST /api/auth/sign-up` — body `{ email, password }`
- `POST /api/auth/sign-in` — body `{ email, password }`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`

Supabase may require email verification. When enabled, sign-up returns `needsEmailConfirmation: true` until confirmation.

## Workspace endpoints

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/costs?workspaceId=<uuid>&month=YYYY-MM`

Every future workspace-scoped API must verify membership before reading or writing customer data.

## Queue

The Cloudflare Worker has a native `scheduled()` handler. `/api/worker` is an optional manual drain endpoint and is disabled unless `CRON_SECRET` is configured.

The queue:
- claims a bounded batch;
- leases jobs to a worker id;
- retries failures with exponential backoff;
- recovers leases stale for 15 minutes;
- supports dedupe keys.

The initial handler only supports `provider_config_check`. Provider probing should be implemented as queued jobs rather than long browser requests.

## Cost ledger

Call `recordCost()` after each billable provider request. Store provider/model, token counts, search calls, runtime where useful, exact or estimated micro-USD cost, run/probe ids, and provider request id.

`external_id` is unique per provider to avoid double-booking a retried provider charge.

## Gate 1

Infrastructure is considered operational only when the Cloudflare production runtime passes:

```text
/api/health
databaseConfigured: true
workerConfigured: true

sign up
→ sign in
→ create workspace
→ reload session
→ read workspace
```

Do not call the product data pipeline real before this gate passes.

## Launch boundary

The database and runtime foundation can be real while the product UI is still demo data. Keep Demo Workspace explicit until authenticated app reads and live probes are connected.
