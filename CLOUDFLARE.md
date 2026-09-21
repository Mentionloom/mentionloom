# Cloudflare deployment

Cloudflare is Mentionloom's primary application runtime. The same Worker serves the built static assets and handles authenticated product API routes.

## Git deployment

Cloudflare deploys from `Mentionloom/mentionloom`:

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Node.js: `22`

`wrangler.toml` uses `./dist` as the static asset directory and sends `/api/*` through `src/worker.js` first. Non-API assets continue to be served directly by Cloudflare.

The Worker also has a five-minute Cron Trigger for the Postgres-backed job queue.

## Supabase

The production Supabase project is:

- project ref: `osksnjqaxbqjcoqytflp`
- region: `eu-west-1`
- API URL: `https://osksnjqaxbqjcoqytflp.supabase.co`

The project URL and publishable key are intentionally non-secret Cloudflare `vars` in `wrangler.toml`.

Two values must be Cloudflare Worker **secrets**, never source-controlled:

```sh
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put CRON_SECRET
```

Use the current Supabase `sb_secret_...` backend key for `SUPABASE_SECRET_KEY`. The runtime also supports the legacy `SUPABASE_SERVICE_ROLE_KEY` during migration, but new deployments should use the modern secret key.

`CRON_SECRET` protects the manual `/api/worker` endpoint. Cloudflare's native `scheduled()` invocation does not depend on this HTTP secret.

For local Worker development, copy `.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`.

## Worker API

The Cloudflare Worker owns:

- `GET /api/health`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/costs?workspaceId=<uuid>&month=YYYY-MM`
- `GET|POST /api/worker` — protected manual queue drain

The auth endpoints store Supabase access/refresh tokens in HTTP-only, SameSite=Lax cookies. Workspace reads and writes are authorized server-side before the service-role/secret-key database request is made.

## Queue

The five-minute Cron Trigger invokes the Worker's `scheduled()` handler. It atomically claims jobs through Postgres `FOR UPDATE SKIP LOCKED`, processes a bounded batch, retries failures with exponential backoff, and recovers stale leases.

The current queue only implements `provider_config_check`. Live provider probe execution is the next job type.

## Waitlist

The marketing waitlist is independent from the product API Worker. It currently posts directly to the Supabase `waitlist` Edge Function and persists signups in Postgres.

## Vercel

Vercel is legacy/fallback infrastructure only. Do not add new runtime dependencies to Vercel. Production readiness must be verified against the Cloudflare deployment and its deployed Git commit.
