# Acme discovery workspace

The standalone app lives at `/app/`. It is an interactive sample workspace, not a screenshot or embedded landing-page preview. The marketing site and existing private waitlist API remain separate.

## Reference decisions

- **Connected interactions:** one reporting scope, clickable ranked rows, concise metrics, and progressively revealed detail.
- **Orbit 0.2.0:** installed using the [official getting-started guide](https://giovanitier.github.io/orbit/guides/getting-started/) and its versioned source CLI. The actual runtime, component templates, Lucide icons and OpenRunde fonts live in `app/components/orbit`. The former hand-adapted `app/orbit.css` has been removed. See [installation notes](app/components/orbit/INSTALLATION.md) for the pinned package, component list and local extension.
- **Comfortable density:** the app extends Orbit's semantic tokens with a shared rem-based type scale: 16px body, 14px supporting text, 12px chart axes/eyebrows, 44px primary controls and minimum button targets. Light mode is explicit. Color and spacing continue to originate in Orbit's installed token file.

## Information architecture

The top navigation opens six separate page URLs, rather than scrolling through one long dashboard or switching ARIA tabs:

| Page                  | Primary content                                                    | Details on demand                             |
| --------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `/app/overview/`      | Four KPIs, trend chart, engine bars, next opportunities            | Metric cards open the relevant report         |
| `/app/visibility/`    | Mention rate, citations, engine and competitor rankings            | Sampled answers and cited pages               |
| `/app/traffic/`       | Referrals, leads, conversion funnel, landing pages                 | Session and conversion evidence               |
| `/app/questions/`     | Coverage KPIs, distribution chart, searchable question table       | Per-engine answers, pending question controls |
| `/app/opportunities/` | Open/shipped counts, missing-answer bars, compact improvement rows | Full brief, suggested page, shipping status   |
| `/app/sources/`       | Connection status and crawler request counts                       | Requirements for each individual source       |

Date, engine and topic scope carries between pages in the URL. Browser history, refresh, direct links and opening a page in a new tab work. Older `#questions`, `#actions`, `#sources` and referral links resolve to the appropriate page. Coverage, source ownership and status are Orbit dropdowns. Detailed methodology, answer excerpts and setup instructions live in modal drawers with a back path and keyboard focus handling.

Question additions, shipped status and setup plans remain local to this browser. The small sample-data label and Demo badge stay visible; a real connection is never implied.

## Architecture

- `app/lib/data.js`: a deterministic 180-day fixture, four engines, twelve questions, separate answer/session records, sample crawler snapshot and improvement plans.
- `app/lib/model.js`: pure scope selection, correct denominators, comparisons and CSV encoding.
- `app/lib/navigation.js`: page paths, metric compatibility, shared URL filters and legacy link resolution.
- `app/components/orbit/runtime`: the installed Orbit 0.2.0 runtime, tokens, control behaviors, fonts and overlay templates.
- `app/lib/ui.js`: a thin Orbit initializer/adapter plus product-specific persistence and export helpers.
- `app/tokens.css`: the application density scale and accessible semantic foregrounds.
- `app/foundation.css`: the documented comfortable-density theme, focus styles and responsive controls.
- `app/lib/charts.js`: responsive zero-based charts, monotone curves, previous-period comparison, pointer/keyboard exploration. Ninety-day charts group three days without changing the daily export.
- `app/app.js`: dashboard composition and interaction coordination.
- `app/app.css`: domain layout and mobile adaptations.
- `app/pages.css`: focused page layouts and compact responsive controls, using the installed Orbit tokens.
- `build.mjs`: creates an actual static entry point for each page, so Vercel deep links work without a catch-all rewrite.

## Data boundaries

All displayed data is illustrative, ending September 9, 2026. Adding a question does not query an AI provider. A setup plan does not install a tracker. Shipped improvements do not change sample measurements. Browser-local demo edits are not sent to the waitlist API.

Answer visibility covers only sampled prompts. Referrals use identifiable UTM/referrer context, which can be missing. Conversions belong to a session; no claim links a specific private answer to a specific person. Topic filters map topics to related landing pages. Crawler requests are a separate fixed 30-day sample snapshot, not human visits.

To connect real data, implement tenant authentication and domain verification, a consent-aware website event collector, scheduled answer sampling with stored source evidence, a durable measurement store, and optional verified CDN/server log imports. The four signal types should stay distinct in the model.

## Verification

- `npm test`: 21 passing checks, including dashboard/waitlist suites, complete Orbit assets and six static page entry points, URL routing and filter round trips, and semantic text/control contrast.
- Lighthouse 12.8.2 accessibility audits cover Overview, Questions and Opportunities. This automated check is not a claim of complete WCAG conformance.
- Browser checks: native Orbit filter selection with arrow keys and Enter; focus restoration; Escape closes the drawer and returns focus; the app owns Cmd+K without opening Orbit's sample command palette; inline form errors focus and describe the invalid field.
- Responsive checks at 320px, 390px and desktop. Larger labels contract before control targets shrink; the page has no horizontal overflow at 320px. Page navigation remains intentionally horizontally scrollable and keeps the active page in view.
- The runtime's reduced-motion branch and the app's reduced-motion CSS disable animation. Full screen-reader and forced-colors testing still require manual assistive-technology review.
