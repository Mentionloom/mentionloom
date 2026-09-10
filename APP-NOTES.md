# Acme discovery workspace

The standalone app lives at `/app/`. It is an interactive sample workspace, not a screenshot or embedded landing-page preview. The marketing site and existing private waitlist API remain separate.

## Reference decisions

- **Connected interactions:** one reporting scope, clickable ranked rows, concise metrics, and progressively revealed detail.
- **Orbit:** https://github.com/giovanitier/orbit at `07b99c7`. Reused the existing light palette and semantic tokens in `orbit-tokens.css`; adapted the original `controls.css`, `styles.css`, `numbers.css`, and `motion.js` patterns into `app/orbit.css` and `app/lib/ui.js`. Orbit is a vanilla HTML/CSS/JS component gallery, not a framework dependency. Controls use a comfortable 14px/40px variant with the original surface, radius, focus and elevation language. OpenRunde is shared with the landing page.

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
- `app/lib/ui.js` + `app/orbit.css`: shared primitives, icons, menus, rolling numbers, motion and local persistence.
- `app/lib/charts.js`: responsive zero-based charts, monotone curves, previous-period comparison, pointer/keyboard exploration. Ninety-day charts group three days without changing the daily export.
- `app/app.js`: dashboard composition and interaction coordination.
- `app/app.css`: domain layout and mobile adaptations.

## Data boundaries

All displayed data is illustrative, ending September 9, 2026. Adding a question does not query an AI provider. A setup plan does not install a tracker. Shipped improvements do not change sample measurements. Browser-local demo edits are not sent to the waitlist API.

Answer visibility covers only sampled prompts. Referrals use identifiable UTM/referrer context, which can be missing. Conversions belong to a session; no claim links a specific private answer to a specific person. Topic filters map topics to related landing pages. Crawler requests are a separate fixed 30-day sample snapshot, not human visits.

To connect real data, implement tenant authentication and domain verification, a consent-aware website event collector, scheduled answer sampling with stored source evidence, a durable measurement store, and optional verified CDN/server log imports. The four signal types should stay distinct in the model.

## Verification

- `npm run build` bundles all app modules; the ignore rule was corrected so `app/app.js` is tracked by Git.
- `npm test`: seven dashboard data tests plus the ten existing waitlist tests.
- Browser review at desktop and 390px mobile: composed filters, 90-day range, responsive chart labels, keyboard day drill-down, question/page/back flow, persisted question and shipped state, search, setup-plan save, CSV trigger, no horizontal overflow and no reported browser errors.
- Animation respects reduced-motion preferences; the sample replay can be paused and does not advance while offscreen or in a background tab.
