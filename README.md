# Mentionloom landing page

Light-only landing page with an interactive product preview and a working waitlist backed by a Vercel function and private Blob storage.

For a local page and isolated waitlist test, run `node scripts/dev-server.mjs --test-storage` and open `http://127.0.0.1:4323`.

Production build: `npm run build`. This copies only the current page, styles, script, and licensed assets into `dist/`. Vercel uses `vercel.json` to build and publish that directory. The [GitHub repository](https://github.com/giovanitier/mentionloom) is private; the deployed landing page is public. The repository is connected to the `mentionloom` project in the Vercel `tier` workspace, with automatic production deployments from `main`.

The workspace has four views: Overview, AI visits, Answers, and Opportunities. It includes selectable metrics, date ranges, question examples, opportunity completion/reset, and mouse/keyboard chart inspection. All dashboard data is illustrative. The waitlist saves real signups, offers optional qualification, and supports private signup removal. No payment is collected.

References: https://github.com/giovanitier/orbit (actual design tokens, controls, OpenRunde). Product copy, examples, layout implementation, and woven-glass image are original. Fonts retain their SIL license in assets/OFL.txt. The browser uses no runtime dependencies or third-party analytics; the server uses the official Vercel Blob SDK.

Current files: index.html provides the page; orbit-tokens.css supplies the Orbit tokens; site.css and site.js handle the product preview; waitlist.css and waitlist.js handle the signup funnel. api/waitlist.js is the server endpoint; lib/ contains validation, ownership, and storage logic. DESIGN-v5.md records the original design direction; WAITLIST.md covers the funnel, private storage, exports, and operations. Earlier styles and scripts are no longer loaded by the page.

Checks: `npm test` verifies waitlist behavior and API boundaries. `node checks/v5.cjs` verifies the product preview, four screen widths, keyboard interactions, FAQ, and opening the waitlist. It requires Playwright and Chrome; set `BASE_URL` to test a hosted deployment. Earlier checks and designs are historical; archive-v3 and archive-v4 preserve previous local versions and are excluded from Git.

The live page accepts waitlist signups. To export leads, refresh the connected development environment and run `npm run waitlist:export`; private CSVs stay in ignored exports/. Automated email campaigns are not connected, and stored email addresses are unverified. See WAITLIST.md before sending invitations.
