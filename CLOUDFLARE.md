# Cloudflare deployment

Cloudflare is Mentionloom's primary application runtime. The same Worker serves the built static assets and handles authenticated product API routes.

## Git deployment

Cloudflare deploys from `Mentionloom/mentionloom`:

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Node.js: `22`

`wrangler.toml` uses `./dist` as the static asset directory and sends `/api/*`, `/auth/confirm`, and `/app/*` through `src/worker.js` first. The Worker gates product documents before returning the static shell; static fonts, CSS, JS, and images are passed through to Cloudflare Assets.

The Worker also has a one-minute Cron Trigger for the Postgres-backed job queue.

## Supabase

The production Supabase project is:

- project ref: `osksnjqaxbqjcoqytflp`
- region: `eu-west-1`
- API URL: `https://osksnjqaxbqjcoqytflp.supabase.co`

The project URL and publishable key are intentionally non-secret Cloudflare `vars` in `wrangler.toml`.

One Cloudflare Worker **secret** is required and must never be source-controlled:

```sh
npx wrangler secret put SUPABASE_SECRET_KEY
```

First analyses also require:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PERPLEXITY_API_KEY
```

Enable Supabase email/password auth and production email delivery. Set the Supabase Site URL to the Cloudflare host, allow its `/auth/confirm` URL, and use server-verifiable token-hash links in both templates: signup `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app/onboarding/`; recovery `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/app/reset-password/`.

Use the current Supabase `sb_secret_...` backend key. The runtime also supports the legacy `SUPABASE_SERVICE_ROLE_KEY` during migration, but new deployments should use the modern secret key.

Cloudflare's native `scheduled()` invocation needs no HTTP cron secret. `CRON_SECRET` is optional and only protects the manual `POST /api/worker` endpoint when you choose to enable it.

`npm run dev` serves a static visual preview and waitlist API only. For the authenticated Worker locally, copy `.dev.vars.example` to `.dev.vars` and run `npx wrangler dev`. Never commit `.dev.vars`.

## Worker API

The Cloudflare Worker owns:

- `GET /api/health`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `POST /api/auth/password-reset`
- `PUT /api/auth/password-update`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/costs?workspaceId=<uuid>&month=YYYY-MM`
- `GET /api/product`
- `/api/onboarding/*`
- `POST /api/analysis/run`
- `GET|POST /api/worker` — optional protected manual queue drain

The auth endpoints store Supabase access/refresh tokens in HTTP-only, SameSite=Lax cookies. Workspace reads and writes are authorized server-side before the service-role/secret-key database request is made.

## Queue

The one-minute Cron Trigger invokes the Worker's `scheduled()` handler. It atomically claims jobs through Postgres `FOR UPDATE SKIP LOCKED`, processes a bounded batch, retries failures with exponential backoff, and recovers stale leases. Probe jobs call OpenAI and Perplexity and persist answers, citations, classifications, and cost rows.

Apply both database migrations, in order, before serving these endpoints. The second migration installs the workspace membership RLS policies and onboarding/run RPCs.

## Waitlist

The marketing waitlist is independent from the product API Worker. It currently posts directly to the Supabase `waitlist` Edge Function and persists signups in Postgres.

## Vercel

Vercel is legacy/fallback infrastructure only. Do not add new runtime dependencies to Vercel. Production readiness must be verified against the Cloudflare deployment and its deployed Git commit.
