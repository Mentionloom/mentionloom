# Mentionloom

Mentionloom is an **AI Recommendation Intelligence** product concept for understanding where a brand appears in AI answers, which buyer questions it is missing, what evidence sits behind those answers, and what the team should improve next.

This repository contains the public marketing site, an interactive sample product workspace, the methodology page, a working early-access waitlist, and an experimental add-on marketplace.

> **Data boundary:** the product workspace uses illustrative sample data. The waitlist is real and writes signups to private Vercel Blob storage.

## Product surfaces

### Marketing

- `/` — primary landing page with the interactive AI-discovery story and product preview.
- `/alternative.html` — alternative, question-led marketing composition.
- `/methodology.html` — methodology for AI Recommendation Share, answer states, sampling rules, and reported signals.

The landing experience uses local provider marks, a bundled Cobe globe, generated Lucide SVG symbols, and the current Mentionloom wordmark at `assets/dark-ml.svg`.

### Product workspace

The standalone demo lives under `/app/` and currently exposes six primary views:

| Route | Purpose |
| --- | --- |
| `/app/overview/` | Contextual KPIs, trends, engine/competitor position, and the recommended next move |
| `/app/visibility/` | Mention rate, citations, engine rankings, competitor rankings, and sampled answer evidence |
| `/app/traffic/` | Website visits, visitors, page views, leads, source/country/device breakdowns, journeys, and funnel stages |
| `/app/questions/` | Buyer-question coverage, search, sample answers, and browser-local pending questions |
| `/app/opportunities/` | Visibility gaps, improvement plans, saved baselines, progress, shipping state, and measurement review |
| `/app/addons/` | Experimental add-on catalogue for content, monitoring, reporting, and attribution workflows |

Each add-on also receives a direct route at `/app/addons/<product>/`.

`/app/sources/` is retained as a legacy/bookmarked route and resolves back into the current app flow rather than acting as a separate primary view.

Date and product filters are encoded in the URL so refresh, browser history, deep links, and opening views in new tabs continue to work.

## What is real vs illustrative

The dashboard fixture is deterministic and ends on **September 9, 2026**.

The demo does **not** currently:

- query live AI providers when a question is added;
- install analytics or a website collector when setup is saved;
- change sample measurements when an improvement is marked shipped;
- activate paid add-ons or Stripe subscriptions;
- infer real revenue from sample traffic.

Question additions, setup plans, add-on state, and improvement progress are stored locally in the browser.

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

Signups are stored in the private `mentionloom-waitlist` Vercel Blob store. The API includes bounded inputs, same-origin checks, a honeypot, persistent rate limiting, deduplication, ownership signatures, and safe retries.

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

- `app/index.html` — shared static shell for all app routes.
- `app/app.js` — main composition, routing coordination, dialogs, search, tour, and interactions.
- `app/lib/navigation.js` — canonical app routes, URL state, and legacy route handling.
- `app/lib/data.js` — deterministic answer/session fixtures.
- `app/lib/model.js` — scoped metrics, comparisons, denominators, and exports.
- `app/lib/traffic.js`, `app/lib/traffic-view.js` — independent website-traffic model and rendering.
- `app/lib/growth.js`, `app/lib/growth-view.js` — evidence → improve → measure workflow.
- `app/lib/addons.js`, `app/lib/addons-view.js` — add-on catalogue, sample commercial state, and product previews.
- `app/lib/ui.js`, `filters.js`, `charts.js`, `intelligence.js` — UI adapters, filters, charts, and domain-specific presentation.

### Server

- `api/waitlist.js` — Vercel waitlist endpoint.
- `lib/waitlist.js` — validation, ownership, qualification, rate limiting, and request handling.
- `lib/blob-store.js` — private Vercel Blob persistence.

## Local development

Install dependencies:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

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

Vercel is configured by `vercel.json` to run `npm run build` and publish `dist/`.

## Deployment

Production project:

- **Vercel project:** `mentionloom`
- **Workspace:** `tier`
- **Public URL:** https://mentionloom.vercel.app/
- **Repository:** https://github.com/Mentionloom/mentionloom
- **Intended production branch:** `main`

### Current deployment caveat

The repository was moved from the personal `giovanitier/mentionloom` repository into the `Mentionloom` organization.

As of **September 21, 2026**, the Vercel project is still showing historical deployment metadata for `githubOrg: giovanitier`, and the latest production artifact was created through the Vercel CLI rather than from the current organization repository. Do **not** assume a push to `main` has reached production until the Vercel project Git source is explicitly reconnected to `Mentionloom/mentionloom` and the resulting deployment references the current commit.

This is an infrastructure binding issue, not a build configuration issue in `vercel.json`.

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
- globe behavior.

The Orbit build test also verifies direct static entries for Overview, Visibility, Traffic, Questions, Opportunities, Add-ons, and the legacy Sources path.

## Supporting documentation

- `APP-NOTES.md` — app architecture, information model, data boundaries, and interaction decisions.
- `WAITLIST.md` — waitlist storage, privacy, exports, invitations, and removal.
- `MARKETPLACE.md` — requirements before enabling paid add-ons.
- `DESIGN-v5.md` — original landing composition direction.
- `LANDING-GTM.md` — landing-page commercial and product-story decisions.
- `POSITIONING-NEXT.md` — question-led positioning direction.
- `strategy/` — ICP, metrics, design-partner, and launch-planning notes.

## Licensing and external assets

OpenRunde, Geist, Space Grotesk, Lucide, Cobe, and provider marks retain their respective notices under `assets/` and `assets/licenses/`.

Provider marks identify the systems used in the illustrative product experience; they do not imply a partnership or endorsement.
