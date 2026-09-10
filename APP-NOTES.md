# Acme discovery workspace

The standalone app lives at `/app/`. It is an interactive sample workspace, not a screenshot or embedded landing-page preview. The marketing site and existing private waitlist API remain separate.

## Reference decisions

- **Connected interactions:** one reporting scope, clickable ranked rows, concise metrics, and progressively revealed detail.
- **Orbit 0.2.0:** installed using the [official getting-started guide](https://giovanitier.github.io/orbit/guides/getting-started/) and its versioned source CLI. The actual runtime, component templates, Lucide icons and OpenRunde fonts live in `app/components/orbit`. The former hand-adapted `app/orbit.css` has been removed. See [installation notes](app/components/orbit/INSTALLATION.md) for the pinned package, component list and local extension.
- **Comfortable density:** the app extends Orbit's semantic tokens with a shared rem-based type scale: 16px body, 14px supporting text, 12px chart axes/eyebrows, 44px primary controls and minimum button targets. Light mode is explicit. Color and spacing continue to originate in Orbit's installed token file.

## Information architecture

1. The overview connects sampled visibility and citations to attributed referrals and lead events.
2. Date, engine and topic filters update the chart and its breakdowns together. Filter state survives reloads in the URL.
3. Engine, competitor and source rows lead to narrower evidence. Native modal drawers include a back path and keyboard focus handling.
4. Buyer questions support search, sorting, coverage filters and locally saved pending questions.
5. Improvements link back to their evidence and remember shipped status in this browser.
6. Source setup and crawler access reveal collection requirements without claiming an active integration.

## Architecture

- `app/lib/data.js`: a deterministic 180-day fixture, four engines, twelve questions, separate answer/session records, sample crawler snapshot and improvement plans.
- `app/lib/model.js`: pure scope selection, correct denominators, comparisons and CSV encoding.
- `app/components/orbit/runtime`: the installed Orbit 0.2.0 runtime, tokens, control behaviors, fonts and overlay templates.
- `app/lib/ui.js`: a thin Orbit initializer/adapter plus product-specific persistence and export helpers.
- `app/tokens.css`: the application density scale and accessible semantic foregrounds.
- `app/foundation.css`: the documented comfortable-density theme, focus styles and responsive controls.
- `app/lib/charts.js`: responsive zero-based charts, monotone curves, previous-period comparison, pointer/keyboard exploration. Ninety-day charts group three days without changing the daily export.
- `app/app.js`: dashboard composition and interaction coordination.
- `app/app.css`: domain layout and mobile adaptations.

## Data boundaries

All displayed data is illustrative, ending September 9, 2026. Adding a question does not query an AI provider. A setup plan does not install a tracker. Shipped improvements do not change sample measurements. Browser-local demo edits are not sent to the waitlist API.

Answer visibility covers only sampled prompts. Referrals use identifiable UTM/referrer context, which can be missing. Conversions belong to a session; no claim links a specific private answer to a specific person. Topic filters map topics to related landing pages. Crawler requests are a separate fixed 30-day sample snapshot, not human visits.

To connect real data, implement tenant authentication and domain verification, a consent-aware website event collector, scheduled answer sampling with stored source evidence, a durable measurement store, and optional verified CDN/server log imports. The four signal types should stay distinct in the model.

## Verification

- `npm test`: 19 passing checks, including the existing dashboard/waitlist suites, complete Orbit production asset copying, and semantic text/control contrast.
- Lighthouse 12.8.2 accessibility audit: **96 before, 100 after** on the default dashboard. Fixed the measured green-text contrast failures and engine-row accessible name mismatches. This automated result is not a claim of complete WCAG conformance.
- Browser checks: native Orbit filter selection with arrow keys and Enter; focus restoration; Escape closes the drawer and returns focus; the app owns Cmd+K without opening Orbit's sample command palette; inline form errors focus and describe the invalid field.
- Responsive checks at 320px, 390px and desktop. Larger labels contract before control targets shrink; the page has no horizontal overflow at 320px. Section navigation remains intentionally horizontally scrollable.
- The runtime's reduced-motion branch and the app's reduced-motion CSS disable animation; replay has a visible pause action. Full screen-reader and forced-colors testing still require manual assistive-technology review.
