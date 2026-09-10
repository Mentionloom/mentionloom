# Mentionloom landing page

Light-only interactive landing-page draft. Static HTML, CSS, and JavaScript; no build required.

Run from this directory: `python3 -m http.server 4321 --bind 127.0.0.1`

Production build: `npm run build`. This copies only the current page, styles, script, and licensed assets into `dist/`. Vercel uses `vercel.json` to build and publish that directory. The GitHub repository is private; the deployed landing page is public. Connect the repository to Vercel with `main` as the production branch for automatic deployments.

Open http://127.0.0.1:4321. The workspace has four views: Overview, AI visits, Answers, and Opportunities. It includes selectable metrics, date ranges, question examples, opportunity completion/reset, and mouse/keyboard chart inspection. Feature cards include replayable sample crawler activity. The early-access request stays local and can be downloaded; it does not submit anything or charge a payment. All dashboard data is illustrative.

References: https://github.com/giovanitier/orbit (actual design tokens, controls, OpenRunde). Product copy, examples, layout implementation, and woven-glass image are original. Fonts retain their SIL license in assets/OFL.txt. The page uses no runtime dependencies or third-party analytics.

Current files: index.html provides the page; orbit-tokens.css supplies the Orbit tokens; site.css contains the complete layout and component styling; site.js handles all interactions. DESIGN-v5.md records the design direction. assets/woven-light.png is the generated project artwork. Earlier styles and scripts are no longer loaded by the page.

Checks: `node checks/v5.cjs` verifies the current page, including light-only rendering under a dark browser preference, all four workspace views at four screen widths, metric and range updates, dropdown and chart keyboard interaction, answer examples, completion/reset, feature links, form validation/download/edit, FAQ, and browser errors. It requires Playwright and Chrome; set `BASE_URL` to test a production build or hosted deployment. Earlier checks and designs are historical; archive-v3 and archive-v4 preserve previous local versions and are excluded from Git.

The published page is a product preview. Before accepting signups: connect signup handling, confirm the brand and offer, and review the claims against implemented product coverage.
