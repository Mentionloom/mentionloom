# Mentionloom infrastructure foundation

This foundation turns the repository from browser-local demo state toward a real multi-tenant product without pretending that live provider measurement is already implemented.

## Decisions

- **Runtime:** Vercel Functions.
- **Auth + Postgres:** Supabase. Auth uses Supabase email/password sessions, but session tokens are kept in secure HTTP-only cookies set by Mentionloom's Vercel API. The browser never receives the Supabase service-role key.
- **Application data access:** server-side only through the Supabase REST API using the service-role key. Application tables have RLS enabled with no browser-facing policies.
- **Workspaces:** real `users → workspace_members → workspaces` ownership with `owner/admin/member/viewer` roles.
- **Queue:** Postgres-backed `jobs` table with atomic `FOR UPDATE SKIP LOCKED` claiming, retry backoff and stale-lease recovery. Vercel Cron calls `/api/worker`.
- **Provider secrets:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `PERPLEXITY_API_KEY` are read only by server modules.
- **Cost ledger:** every provider/runtime charge can be recorded in micro-USD and attributed to workspace, run and probe.

This does not yet make the illustrative dashboard live. The next layer is the provider runner that writes `probe_runs → probes → answers → citations → classifications` and records its costs.

## Required setup

1. Create a Supabase project.
2. Run `db/migrations/001_foundation.sql` in the Supabase SQL editor.
3. Configure the Vercel project environment variables from `.env.example`.
4. Generate a long random `CRON_SECRET`. Vercel sends it as `Authorization: Bearer <secret>` for cron requests.
5. Add paid provider API keys only in Vercel's server environment. Never expose them through `site.js`, `app.js`, HTML, analytics, or public endpoints.

## Auth endpoints

- `POST /api/auth/sign-up` — body `{ email, password }`
- `POST /api/auth/sign-in` — body `{ email, password }`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`

Supabase can be configured to require email verification. If it is enabled, sign-up returns `needsEmailConfirmation: true` until the user confirms.

## Workspace endpoints

- `GET /api/workspaces` — list workspaces for the signed-in user.
- `POST /api/workspaces` — create a workspace and owner membership atomically.
- `GET /api/costs?workspaceId=<uuid>&month=YYYY-MM` — owner/admin monthly cost summary.

Every future workspace-scoped API must call `requireWorkspaceMember()` before reading or writing customer data.

## Queue

The migration creates `jobs` and the atomic `claim_jobs()` function.

`/api/worker`:
- accepts only requests authenticated with `CRON_SECRET`;
- claims a bounded batch;
- leases jobs to a unique worker id;
- retries failures with exponential backoff;
- recovers jobs whose worker lease has been stale for 15 minutes.

The initial handler supports `provider_config_check` only. Provider probe execution should be registered here next rather than embedded in browser requests.

## Cost ledger

Use `recordCost()` immediately after each provider request resolves (or after a provider reports billable usage). Store:
- provider/model;
- input and output tokens;
- web/search calls;
- runtime milliseconds where useful;
- exact or estimated cost in `amount_microusd`;
- `probe_run_id` and `probe_id`;
- provider request id as `external_id` when available.

`external_id` is unique per provider so retries do not double-book the same provider charge.

## Security rules

- Never serialize the Supabase service role or provider API keys into the build output.
- Never trust a workspace id sent by the browser without checking membership.
- Auth cookies are HTTP-only, SameSite=Lax and Secure in production.
- Application tables have RLS enabled and are intentionally unavailable directly to browser clients.
- Raw answers and customer evidence stay in Mentionloom's database; do not send them to product analytics by default.

## Launch boundary

After this migration, the infrastructure is real but the existing Acme product UI remains sample data until its reads are moved from `app/lib/data.js` to authenticated APIs. Keep Demo Workspace explicit until that cutover happens.
