# Mentionloom

Mentionloom is an **AI Recommendation Intelligence** product concept for understanding where a brand appears in AI answers, which buyer questions it is missing, what evidence sits behind those answers, and what the team should improve next.

This repository contains the public marketing site, a separate illustrative workspace demo, the authenticated Mentionloom product entry path, a working early-access waitlist, and an experimental add-on catalogue.

> **Data boundary:** `/app/overview/`, `/app/questions/`, and `/app/opportunities/` are authenticated and read workspace data from Supabase through the Cloudflare Worker. `/app/demo/` is the explicitly illustrative Acme workspace. The authenticated path requires the launch database migration and Worker secrets described below.

## Product surfaces

### Marketing

- `/` — primary landing page with the interactive AI-discovery story and product preview.
- `/alternative.html` — alternative, question-led marketing composition.
- `/methodology.html` — methodology for AI Recommendation Share, answer states, sampling rules, and reported signals.

The landing experience uses local provider marks, a bundled Cobe globe, generated Lucide SVG symbols, and the current Mentionloom wordmark at `assets/dark-ml.svg`.

### Product workspace

The authenticated product routes are:

| Route | Purpose |
| --- | --- |
| `/app/sign-up/`, `/app/sign-in/` | Email/password authentication with confirmation and password recovery |
| `/app/onboarding/` | Website analysis, editable company profile, and generated/approved buyer questions |
| `/app/overview/` | Real recommendation/mention results, provider coverage, citations, competitor context, question stages, and last-run status |
| `/app/questions/` | Approved buyer questions with measured answer status |
| `/app/opportunities/` | Evidence-backed opportunities; stays empty until the data model has a supported recommendation |

`/app/visibility/`, `/app/traffic/`, `/app/addons/`, and add-on detail paths redirect to the launch overview. The earlier dashboard and catalogue remain available at `/app/demo/`; their deterministic sample data is never used by the authenticated pages.

`/app/sources/` is retained as a legacy/bookmarked route and resolves back into the current app flow rather than acting as a separate primary view.

Date and product filters are encoded in the URL so refresh, browser history, deep links, and opening views in new tabs continue to work.

## What is real vs illustrative

The public demo fixture is deterministic and ends on **September 9, 2026**.

The authenticated launch product does **not** currently:

- include AI referral attribution or website-traffic collection;
- create model-generated opportunities before evidence exists;
- activate paid add-ons or Stripe subscriptions;
- infer real revenue from sample traffic.

The public `/app/demo/` retains the earlier local-only sample behavior. Workspace setup, approved questions, provider probes, answers, citations, classifications, run status, and costs in authenticated product pages use the server API and Supabase.

Traffic is modelled separately from answer sampling. The sample traffic layer includes LLM referrals, IDE sources, social, search, email, direct traffic, country/device context, page journeys, and lead events. This separation is intentional: a website visit is not treated as an AI recommendation.

## Add-on marketplace

The current catalogue contains five sample products:

- **Brief Studio** — turn a missing mention into a source-backed content brief;
- **Competitor Watch** — surface meaningful changes in competitor visibility;
- **Weekly Brief** — create a compact workspace digest;
- **Crawler Guard** — monitor AI crawler access changes;
- **Revenue Match** — connect attributed AI visits to qualified pipeline.

Pricing is illustrative and checkout is disabled. `app/lib/addons.js` supports Stripe-hosted Payment Links, but live billing requires authenticated workspace ownership, verified webhooks, fulfilment, cancellation handling, and failed-renewal handling first.

See `MARKETPLACE.md` before enabling any commercial flow.

## Waitlist

The live funnel has three stages:

1. **Join** — email plus explicit permission for early-access / launch communication.
2. **Optional qualification** — website, role, goal, current tracking approach, and urgency.
3. **Confirm and share** — public invite link plus a private signup-management link.

Signups are stored through the Supabase `waitlist` Edge Function in Postgres. The public form posts directly to that function; product authentication and workspace data remain separate.

There is currently **no automated email campaign** and stored email addresses are **unverified**.

To export leads from an authorized development environment:

```sh
npm run waitlist:export
```

Exports are written to ignored `exports/` files and must not be committed.

See `WAITLIST.md` for the full storage, privacy, export, invitation, and removal model.

## Design system

The current codebase vendors **Orbit 0.2.0** source directly under:

```
app/components/orbit/
```

It is not an npm runtime dependency. The installed source includes component templates, the runtime, Lucide integrations, OpenRunde assets, motion, controls, number rendering, overlays, and tokens.

Mentionloom-specific adaptations live outside the vendored source:

- `app/tokens.css` — application semantic tokens and density;
- `app/foundation.css` — focus, responsive control, and foundation rules;
- `app/density.css` — product-specific component sizing;
- `app/app.css`, `app/pages.css`, `app/growth.css`, `app/addons.css`, `app/traffic.css` — product compositions.

`app/components/orbit/INSTALLATION.md` records the installed version, source package, component set, and the one local runtime extension used for percentage precision.

## Brand assets

The active Mentionloom wordmark is `assets/dark-ml.svg`. The favicon uses `assets/favicon.svg`, based on the blue/light rounded-square icon.

The September 2026 brand refresh is fully mirrored in `assets/` with both canonical project names and compatibility aliases:

- Full wordmarks: `dark-ml.svg`, `blue-ml.svg`, `light-ml.svg`
- Symbol marks: `ml-dark.svg`, `ml-blue.svg`, `ml-light.svg`
- Rounded-square icons: `square-ml-dark.svg`, `square-ml-blue.svg`, `square-ml-light.svg`
- Source-package aliases: `dark.svg`, `blue.svg`, `light.svg`, `l-dark.svg`, `l-blue.svg`, `l-light.svg`, `icon-dark-light.svg`, `icon-blue-light.svg`, `icon-light-blue.svg`
- Legacy compatibility aliases: `logo.svg`, `mark.svg`, and `ml-gradient.svg` now resolve to the refreshed geometry rather than the previous identity.

Provider/competitor SVGs are kept local under `assets/brands/`. `scripts/marketing-assets.mjs` regenerates the supported Simple Icons marks, the Lucide sprite, the Grok mark, and the bundled globe asset used by the marketing experience.

No runtime CDN request is required for those assets.

## Architecture

### Marketing

- `index.html` — primary landing page.
- `alternative.html`, `alternative.css`, `alternative.js` — alternate marketing direction.
- `methodology.html` — public methodology.
- `site.css`, `site.js` — primary marketing layout, motion, product preview, and globe interactions.
- `orbit-tokens.css` — marketing-side token bridge.
- `product-portal.css` — shared product/portal styling.
- `waitlist.css`, `waitlist.js` — waitlist UI and client flow.

### App

- `app/index.html` — authenticated product shell copied to product routes.
- `app/demo.html` — earlier Acme fixture, built only to `/app/demo/`.
- `app/product.js`, `app/launch-entry.css` — authentication, onboarding, and real-data workspace views.
- `app/app.js` — main composition, routing coordination, dialogs, search, tour, and interactions.
- `app/lib/navigation.js` — canonical app routes, URL state, and legacy route handling.
- `app/lib/data.js` — deterministic answer/session fixtures.
- `app/lib/model.js` — scoped metrics, comparisons, denominators, and exports.
- `app/lib/traffic.js`, `app/lib/traffic-view.js` — independent website-traffic model and rendering.
- `app/lib/growth.js`, `app/lib/growth-view.js` — evidence → improve → measure workflow.
- `app/lib/addons.js`, `app/lib/addons-view.js` — add-on catalogue, sample commercial state, and product previews.
- `app/lib/ui.js`, `filters.js`, `charts.js`, `intelligence.js` — UI adapters, filters, charts, and domain-specific presentation.

### Server

- `src/worker.js` — Cloudflare Worker API router, auth/session endpoints, workspace APIs, cost reporting, queue endpoint, and scheduled queue processor.
- `lib/supabase.js` — Supabase HTTP transport with modern publishable/secret key support and legacy-key fallback.
- `lib/workspaces.js`, `lib/queue.js`, `lib/cost-ledger.js` — product infrastructure primitives.
- `lib/provider-secrets.js` — server-only provider credential access.
- `api/*` — retained Vercel fallback handlers; do not add new production runtime dependencies there.
- `lib/waitlist.js` and `lib/blob-store.js` — legacy Vercel waitlist implementation retained for fallback/history.

### Product infrastructure foundation

The multi-tenant foundation lives in `db/migrations/001_foundation.sql`; the launch path and workspace-scoped RLS live in `db/migrations/20260926171942_launch_onboarding_rls.sql` and `db/migrations/20260926172037_private_rls_helper.sql`.

It introduces:

- Supabase Auth and Postgres-backed `users`, `workspaces`, and `workspace_members`;
- real measurement entities for companies, competitors, question versions, runs, probes, raw answers, citations, classifications, snapshots, opportunities, and interventions;
- a Postgres-backed `jobs` queue with atomic claiming, retries, stale-lease recovery, and a Cloudflare Cron worker;
- a `cost_ledger` that attributes provider/runtime cost to workspace, run, and probe in micro-USD;
- server-only environment variables for OpenAI, Claude, Gemini, and Perplexity.

Browser clients do not receive the Supabase secret/service-role key or provider credentials. Workspace APIs verify membership server-side before returning customer data.

`app/lib/data.js` remains the deterministic sample source for `/app/demo/` only. Product API reads choose the workspace from the authenticated Supabase session; provider credentials and the Supabase secret key stay in Worker bindings.

## Local development

Install dependencies:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

This is a static visual preview plus the local waitlist API. It does not run the authenticated product backend. For signup, onboarding, and analysis, run `npx wrangler dev` after creating `.dev.vars` from `.dev.vars.example` and applying the database migrations.

For an isolated waitlist flow that does not touch production storage:

```sh
node scripts/dev-server.mjs --test-storage
```

Then open:

```
http://127.0.0.1:4323
```

## Build

Production build:

```sh
npm run build
```

`build.mjs` creates `dist/`, copies the marketing and app source required at runtime, copies the complete installed Orbit component source, regenerates marketing assets, copies licenses, and creates static entry points for every app view and add-on detail route.

Cloudflare Workers Static Assets publishes `dist/`, while `src/worker.js` handles `/api/*` and scheduled background work. `vercel.json` remains only for fallback deployment compatibility.

## Deployment

Primary production deployment:

- **Runtime:** Cloudflare Workers + Static Assets
- **Worker:** `mentionloom`
- **Repository:** https://github.com/Mentionloom/mentionloom
- **Production branch:** `main`
- **Build:** `npm run build`
- **Deploy:** `npx wrangler deploy`

`wrangler.toml` binds `dist/` as static assets, routes `/api/*`, `/auth/confirm`, and `/app/*` through `src/worker.js`, and schedules the Postgres-backed queue every minute.

### Deployment caveat

Vercel remains connected as temporary fallback infrastructure, but it is no longer the authoritative runtime. Do not infer Cloudflare production state from a Vercel deployment.

For every production release, verify the Cloudflare build/deploy completed from `Mentionloom/mentionloom` at the intended `main` commit. New backend/runtime work belongs in the Cloudflare Worker, not in Vercel Functions.

## Tests

Run:

```sh
npm test
```

The current test command covers:

- waitlist state and API boundaries;
- dashboard metrics and data denominators;
- the complete vendored Orbit runtime and production build output;
- navigation and URL-state round trips;
- growth-plan persistence and baseline behavior;
- add-on contracts and disabled sample checkout;
- local provider SVG coverage;
- traffic metrics and filtering;
- globe behavior;
- infrastructure migration, Cloudflare Worker routing, server-secret contract, and scheduled queue configuration.

The Orbit build test also verifies direct static entries for Overview, Visibility, Traffic, Questions, Opportunities, Add-ons, and the legacy Sources path.

## Supporting documentation

- `APP-NOTES.md` — app architecture, information model, data boundaries, and interaction decisions.
- `WAITLIST.md` — waitlist storage, privacy, exports, invitations, and removal.
- `MARKETPLACE.md` — requirements before enabling paid add-ons.
- `DESIGN-v5.md` — original landing composition direction.
- `LANDING-GTM.md` — landing-page commercial and product-story decisions.
- `POSITIONING-NEXT.md` — question-led positioning direction.
- `INFRASTRUCTURE.md` — auth, Postgres, workspace ownership, queue, provider-secret, and cost-ledger setup.
- `strategy/` — ICP, metrics, design-partner, and launch-planning notes.

## Licensing and external assets

OpenRunde, Geist, Space Grotesk, Lucide, Cobe, and provider marks retain their respective notices under `assets/` and `assets/licenses/`.

Provider marks identify the systems used in the illustrative product experience; they do not imply a partnership or endorsement.
