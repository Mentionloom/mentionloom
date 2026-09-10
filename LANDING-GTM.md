# Mentionloom landing: AI discovery, from answers to action

## Commercial direction

The initial audience is founders and growth teams at B2B software companies. The buying trigger is uncertainty about whether AI answer engines recommend their product or its alternatives. The page promises a clearer view of that discovery journey and a concrete next action, rather than an unexplained visibility score or guaranteed ranking.

Primary conversion: join the early-access waitlist. The secondary action opens the standalone `/app/` dashboard. This is an early-access product preview, not a claim that production data collection is already available. No customer logos, quotes, growth claims, or pricing have been invented.

Page sequence: outcome → illustrative discovery journey → engine coverage in the preview → interactive visibility/questions/opportunities → cited pages and attributed traffic → planned setup workflow → early-access offer → measurement and privacy objections.

The landing page emphasizes clarity, space, product-led storytelling, and an animated globe. Ramp informs the direct commercial promise and repeated conversion opportunity. Vercel informs modular composition and geometric background detail. The typography, palette, controls, and interaction language remain Orbit.

## Installed design system

The page imports the real installed Orbit 0.2 runtime, OpenRunde font files, semantic palette, spacing, radii, and motion tokens from `app/components/orbit/runtime/`. It shares the dashboard's comfortable density and accessibility theme in `app/tokens.css` and `app/foundation.css`. The installed source is preserved; marketing layout rules are scoped to `.marketing-app`.

Additional official templates installed for this iteration: **Tabs, Accordion, Floating navigation**. The page uses Tabs and Accordion; Floating navigation is available for later use. Existing Button, Icon button, Segmented control, Badge, Checkbox, and Rolling number foundations are reused.

Product-specific compositions added:

- **Discovery globe:** CSS atmosphere, orbital lines, floating provider/answer cards, and a Cobe globe that upgrades after scrolling settles. Offscreen and hidden-document rendering pauses. Reduced-motion preferences and the pause control are respected. Software WebGL renderers and failed contexts retain the lightweight CSS version.
- **Visibility explorer:** engine filters, an accessible zero-to-100% chart with mouse inspection and a keyboard date slider, and competitor mention rates.
- **Buyer question explorer:** monitored questions, selected engine context, the latest sample response, citation and mention status. Separate accessible tab panels avoid Orbit's gallery-only content replacement.
- **Opportunity briefs:** expandable recommendations and an interactive checklist with progress.
- **Cited-page list and referral funnel:** supporting examples with exact sample counts and proportional bars; they retain the complete sample-period scope.

The marketing page does not reproduce the full dashboard shell. Its product demonstrations link directly to the standalone app, preserving the engine and relevant section.

## Data and claims

Interactive reporting uses the same deterministic data and selector as `/app/`: 12 chosen prompts, four engines, and the 30 days ending September 9, 2026. Acme is fictional. Competitor identities are real, but all comparison rates and responses are illustrative. Changing the engine changes the denominator and every related report in the explorer.

The question explorer shows a monitored prompt, not a private user conversation. Under “All engines,” the answer card shows the latest ChatGPT sample and explicitly names ChatGPT. Selecting another engine shows its latest sample. A mention without a citation does not fabricate an Acme source.

Organic answer presence, identifiable AI referral sessions, conversions, and crawler access remain separate signals. The page explains that answer monitoring is planned, referral/conversion analysis requires an analytics connection, and crawler analysis requires server or CDN logs. No promise of access to private AI conversations, complete attribution, guaranteed recommendations, or advertising placement is made.

## Assets and maintenance

All interface icons come from `lucide-static` 1.44.0; provider/competitor marks come from Simple Icons 16.30.0 via the pinned Iconify collection. `scripts/marketing-assets.mjs` writes only the used logos and a Lucide sprite and bundles Cobe 2.0.1 locally. No third-party logo API or runtime CDN request is needed. Source and notices are in `assets/licenses/`.

Run `npm run dev` for the source server, or `node scripts/dev-server.mjs --test-storage` after generating assets for an isolated signup test. `npm run build` regenerates marketing assets and ships the complete installed Orbit source. The generated assets are tracked so the existing source-server workflow also works immediately.

Orbit 0.2 gallery behavior is isolated deliberately: `prepare()` adds gallery layout classes; the existing adapter removes only that layout class. Generic `data-tab` handlers replace gallery specimen content, so marketing tabs use `data-story` with explicit tab-panel associations. Orbit's keyboard and indicator behavior is retained. The scoped theme also resets gallery `main` padding and horizontal section-heading layout. These are product integration rules, not changes to the vendor runtime.

## Funnel and launch measurement

The existing private Vercel Blob signup API is retained. It saves a normalized email and consent before asking for optional website, role, and priority. Confirmation supports sharing, a private management link, removal, and opening the full dashboard. Campaign parameters and CTA source are saved with signups.

For launch reporting, compare qualified signups by campaign and CTA source, then invitation acceptance and connected-workspace activation once onboarding exists. Demo browsing and tab clicks are not currently transmitted as analytics events; do not treat them as measured conversions.

## Validation

- Existing 19 automated tests cover data denominators and filters, waitlist validation/persistence/privacy, and Orbit build integrity.
- Desktop and 390px mobile review: real logo assets, engine filters, keyboard tabs, chart inspection, question details, expanding opportunities, and no horizontal overflow.
- Signup, optional qualification, confirmation and private removal tested against isolated local storage. No test subscriber was sent to production.
- Local Lighthouse accessibility, best practices, and SEO audits score 100. Performance checks identified and removed initial decorative shader compilation; production delivery supplies asset compression unavailable in the local source server.
