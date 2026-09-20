# Acme discovery workspace

The standalone app lives at `/app/`. It is an interactive sample workspace, not a screenshot or embedded landing-page preview. The marketing site and existing private waitlist API remain separate.

## Reference decisions

- **Connected interactions:** one reporting scope, clickable ranked rows, concise metrics, and progressively revealed detail.
- **Orbit 0.2.0:** installed using the [official getting-started guide](https://giovanitier.github.io/orbit/guides/getting-started/) and its versioned source CLI. The actual runtime, component templates, Lucide icons and OpenRunde fonts live in `app/components/orbit`. The former hand-adapted `app/orbit.css` has been removed. See [installation notes](app/components/orbit/INSTALLATION.md) for the pinned package, component list and local extension.
- **Orbit density:** body text is 14px; buttons use 12px text and 36px minimum height; filter triggers use 38px minimum height; badges use 10px text; metric values use 25px. These dimensions match the installed Orbit runtime. `app/density.css` applies the component scale across product compositions and expands controls to 44px minimum for coarse pointers. Light mode remains explicit.

## Information architecture

The top navigation exposes six primary page URLs, rather than scrolling through one long dashboard or switching ARIA tabs:

| Page                  | Primary content                                                               | Details on demand                                            |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/app/overview/`      | Contextual KPIs, trend, recommended next move, engine and competitor rankings | Metric cards open reports; the next move starts a saved plan |
| `/app/visibility/`    | Mention rate, citations, engine and competitor rankings                       | Sampled answers and cited pages                              |
| `/app/traffic/`       | Visits, visitors, page views, leads, source/country/device breakdowns and funnel stages | Session, journey and conversion evidence                     |
| `/app/questions/`     | Coverage KPIs, distribution chart, searchable question table                  | Per-engine answers and browser-local pending questions       |
| `/app/opportunities/` | Open/shipped counts, missing-answer bars, improvement rows and saved baselines | Full brief, suggested page, checklist and measurement review |
| `/app/addons/`        | Experimental content, monitoring, reporting and attribution add-ons           | Product preview, sample offer and browser-local activation   |

Date and view-specific scope carry between pages in the URL. Browser history, refresh, direct links and opening a page in a new tab work. Older `#questions`, `#actions`, `#sources`, referral links, and `/app/sources/` resolve into the current app flow; Sources is no longer a primary navigation view. Detailed methodology, answer excerpts, setup instructions and source requirements live in modal drawers with a back path and keyboard focus handling.

Question additions, shipped status and setup plans remain local to this browser. The small sample-data label and Demo badge stay visible; a real connection is never implied.

## Guided growth loop

The September 11 refinement uses UI Skills' **Interface Design** and **Interaction Design** guidance. The intended client is a founder or growth lead returning between other tasks: they should understand their position, choose a useful improvement, and return to assess evidence. Orbit remains the light-only visual system. Purple marks the next action and sampled visibility; green marks observed positive comparisons or recorded completion. Neutral surfaces keep evidence readable.

The overview gives each number context: mention counts and denominators, citations, attributable sessions, and lead conversion rate. It pairs the trend with a recommended improvement, then shows engine coverage and position among the same benchmark brands. The primary action stays near the page heading, including on mobile.

Recommendations rank six sample content plans by missing answers in the current reporting scope. Every default question below 40% visibility has an actionable plan. Started work takes priority over untouched work, and shipped work leaves the active queue. This is not estimated buyer demand or forecast revenue.

The flow is **evidence → improve → measure**. Starting a plan saves its reporting window, engine/topic scope and baseline. Native Orbit checkboxes record individual steps; all steps must be complete before shipping. Returning under different filters does not replace the saved baseline. Shipped work opens a before/after review that explicitly awaits new measurements. The sample dataset cannot demonstrate post-change impact.

New product compositions, built from Orbit primitives: **recommended next move**, **growth workflow navigation**, **saved-baseline panel**, **persistent improvement checklist**, and **measurement review**. Progress motion only confirms a state change and respects reduced motion. The Opportunities page leads with the work queue; underlying gap charts are a native expandable disclosure.

## Architecture

- `app/lib/data.js`: a deterministic 180-day fixture, four engines, twelve questions, separate answer/session records, sample crawler snapshot and improvement plans.
- `app/lib/model.js`: pure scope selection, correct denominators, comparisons and CSV encoding.
- `app/lib/navigation.js`: page paths, metric compatibility, shared URL filters and legacy link resolution.
- `app/lib/traffic.js` and `app/lib/traffic-view.js`: an illustrative website-session model kept separate from answer sampling, with source/country/device filters, journeys and funnel stages.
- `app/lib/growth.js`: evidence ranking, frozen baselines, validated progress and shipping readiness.
- `app/lib/growth-view.js`: reusable next-move, workflow, checklist and measurement compositions.
- `app/lib/addons.js` and `app/lib/addons-view.js`: the experimental add-on catalogue, sample commercial state and product previews.
- `app/components/orbit/runtime`: the installed Orbit 0.2.0 runtime, tokens, control behaviors, fonts and overlay templates.
- `app/lib/ui.js`: a thin Orbit initializer/adapter plus product-specific persistence and export helpers.
- `app/tokens.css`: the application density scale and accessible semantic foregrounds.
- `app/foundation.css`: the documented comfortable-density theme, focus styles and responsive controls.
- `app/lib/charts.js`: responsive zero-based charts, monotone curves, previous-period comparison, pointer/keyboard exploration. Ninety-day charts group three days without changing the daily export.
- `app/app.js`: dashboard composition and interaction coordination.
- `app/app.css`: domain layout and mobile adaptations.
- `app/pages.css`: focused page layouts and compact responsive controls, using the installed Orbit tokens.
- `app/growth.css`: the hierarchy and responsive layout for guided growth, using Orbit tokens and controls.
- `app/addons.css`: add-on marketplace and product-detail layouts.
- `app/traffic.css`: traffic analysis, breakdown, journey and funnel layouts.
- `build.mjs`: creates static entries for each primary app view, the legacy Sources route, and every add-on detail page so Vercel deep links work without a catch-all rewrite.

## Data boundaries

All displayed data is illustrative, ending September 9, 2026. Adding a question does not query an AI provider. A setup plan does not install a tracker. Shipped improvements do not change sample measurements. Browser-local demo edits are not sent to the waitlist API.

Answer visibility covers only sampled prompts. Referrals use identifiable UTM/referrer context, which can be missing. Conversions belong to a session; no claim links a specific private answer to a specific person. Topic filters map topics to related landing pages. Crawler requests are a separate fixed 30-day sample snapshot, not human visits.

To connect real data, implement tenant authentication and domain verification, a consent-aware website event collector, scheduled answer sampling with stored source evidence, a durable measurement store, and optional verified CDN/server log imports. The four signal types should stay distinct in the model.

## Verification

- `npm test`: the current dashboard/waitlist, Orbit runtime, navigation, growth, add-on, brand, traffic and globe suites. The build checks direct static entries for the six primary views plus the legacy Sources route.
- Lighthouse 12.8.2 accessibility audits cover Overview, Questions and Opportunities. This automated check is not a claim of complete WCAG conformance.
- Browser checks: native Orbit filter selection with arrow keys and Enter; focus restoration; Escape closes the drawer and returns focus; the app owns Cmd+K without opening Orbit's sample command palette; inline form errors focus and describe the invalid field.
- Responsive checks at 320px, 390px and desktop. Larger labels contract before control targets shrink; the page has no horizontal overflow at 320px. Page navigation remains intentionally horizontally scrollable and keeps the active page in view.
- The runtime's reduced-motion branch and the app's reduced-motion CSS disable animation. Full screen-reader and forced-colors testing still require manual assistive-technology review.
