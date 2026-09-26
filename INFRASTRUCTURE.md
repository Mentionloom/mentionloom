# Mentionloom launch infrastructure

The authenticated Mentionloom product runs on Cloudflare Workers + Static Assets and Supabase Auth/Postgres. The older Acme sample dashboard is isolated at `/app/demo/`.

## Runtime and data boundary

- Supabase access and refresh tokens live in HTTP-only, SameSite=Lax cookies set by the Cloudflare Worker.
- Product data uses the server-only Supabase secret key. It is never included in browser assets.
- The session selects the workspace. The browser cannot submit an owner id or choose another tenant's workspace.
- RLS reads are constrained by `workspace_members`; trusted workspace bootstrap, onboarding, and baseline RPCs are executable only by `service_role`.
- Provider keys remain server-only Cloudflare Worker secrets.
- Postgres `jobs` plus a one-minute Cloudflare Cron trigger run independent provider probes with retries.
- `cost_ledger` stores token counts, search calls, provider request ids, and micro-USD amounts per run/probe.

## Database setup

Apply migrations in order:

1. `db/migrations/001_foundation.sql`
2. `db/migrations/20260926171942_launch_onboarding_rls.sql`
3. `db/migrations/20260926172037_private_rls_helper.sql`

The launch migrations add persisted onboarding state, service-role-only bootstrap/question/run RPCs, and membership-scoped read policies across every product table. The membership lookup lives in a non-exposed `private` schema. Product writes go through the authenticated Worker using its server-only key. Apply both migrations before routing customer traffic to the authenticated app.

After applying it, run the Supabase security advisors and review any remaining notices against the membership policies. The auth user trigger and launch RPCs are revoked from `public`, `anon`, and `authenticated`.

## Cloudflare secrets and Supabase Auth

Required Worker secrets:

```text
SUPABASE_SECRET_KEY
OPENAI_API_KEY
PERPLEXITY_API_KEY
```

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are non-secret Worker vars. `CRON_SECRET` is optional and only protects the manual `/api/worker` endpoint.

Enable email/password authentication and email delivery in Supabase Auth. Set the Supabase Site URL to the Cloudflare host and allow that host's `/auth/confirm` URL. Use a token-hash link in the email templates so the Worker can verify it server-side: signup confirmation should link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app/onboarding/`; password recovery should use the same path with `type=recovery&next=/app/reset-password/`. When email confirmation is enabled, signup shows a check-your-email state. Password recovery returns through the same callback to `/app/reset-password/`.

`npm run dev` is a static visual preview and waitlist server; it does not run Supabase-backed product APIs. For the authenticated flow, use `npx wrangler dev` after creating `.dev.vars` from `.dev.vars.example`. Never commit local secrets.

## Product and auth API

- `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `POST /api/auth/password-reset`, `PUT /api/auth/password-update`
- `GET /api/product` returns the server-selected workspace and current product data.
- `POST /api/onboarding/analyze` fetches a public HTTPS company page and extracts a structured profile.
- `GET|PUT /api/onboarding/profile` reads or confirms the editable profile.
- `GET|POST|PUT /api/onboarding/questions` reads, generates, saves, and approves 20–25 staged questions.
- `POST /api/analysis/run` queues a two-provider baseline.
- `GET /api/costs?workspaceId=<uuid>&month=YYYY-MM` reads owner/admin cost totals.

The Worker runs before `/app/*` document routes. Signed-out visitors go to sign-in; authenticated workspaces resume onboarding until approved questions exist. The public `/app/demo/` path is deliberately separate.

## Provider execution

Each approved question creates one OpenAI Responses web-search probe and one Perplexity Agent API Sonar probe. Responses, request ids, usage, citations, and deterministic mention states are stored in Postgres. Job retries apply independently; a run is marked partial when some probes fail and others finish.

Perplexity returns billed request cost in its usage payload. OpenAI cost calculation uses the dated model, cache, and web-search rates in `lib/launch-domain.js`; update the rates when provider pricing changes.

## Production smoke test

After applying both migrations, setting secrets, and configuring email delivery, verify:

```text
sign up → email confirmation (if enabled) → workspace bootstrap
→ website analysis → profile confirmation → approve questions
→ run baseline → observe answers, citations, costs and overview
```

Run the Supabase advisors and test isolation with two users/workspaces before launch. Local tests verify domain rules and static assets but cannot replace those authenticated production checks.
