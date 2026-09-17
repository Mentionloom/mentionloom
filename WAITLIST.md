# Mentionloom waitlist

The live funnel has one primary action: **Join the waitlist**.

1. **Join:** email and explicit permission for early-access/launch emails. The signup is saved immediately.
2. **Qualify, optionally:** website, role, the first thing the visitor wants to understand, how they track AI recommendations today, and how soon it matters. Skipping preserves the signup. Website and role help prioritise the first cohort; tracking and urgency separate teams with a live problem from visitors watching the space.
3. **Confirm and share:** what happens next, a public invite link, and a separate private signup-management link.

The page makes no promise of immediate access, a queue position, a launch date, or a free product plan. Joining is free. The product dashboard still uses illustrative data.

## Stored data

Signups live in the private `mentionloom-waitlist` Vercel Blob store in Frankfurt. They are not stored in GitHub, shipped to the browser, or exposed by a list endpoint.

Each subscriber record contains email, timestamps, consent text/version, CTA source, optional campaign attribution, qualification, and a hashed ownership nonce. Qualification holds the website origin, role, goal, current tracking approach, and urgency. Referrers and company websites are reduced to hostname/origin; arbitrary browsing URLs are not saved. Email addresses are normalized and deduplicated. Emails are currently **unverified**.

The server uses bounded input, same-origin checks, a honeypot, and persistent rate limits. Rate-limit records contain an HMAC of the network address, count, and window; they never contain the raw address. Private management links require a server signature and matching ownership. Failed or timed-out saves show a retry message, never a false confirmation. Retries from the same form retain their request ID.

## Export leads and funnel totals

From this directory, refresh the development environment with the Vercel CLI, then run:

```sh
npm run waitlist:export
```

This writes a private CSV to ignored `exports/` and reports signup count, qualified count, qualification rate, and CTA sources. It does not print email addresses. Campaign columns support attribution; no visitor/session tracking or third-party analytics is installed, so this does not measure page-view-to-signup conversion.

Only team members with access to the connected Vercel store can run the export. Protect exported files as personal data. Do not commit them or the `.env` files. Rate-limit records are outside the subscriber export; old records with `expiresAt` in the past can be deleted during routine storage maintenance.

## Invitations and removal

There is no automatic email sender or nurture campaign connected yet. Exported subscribers have explicitly asked for early-access/launch emails, but are unverified; verify addresses through the chosen email provider before campaigns. The interface does not claim an email has already been sent.

Visitors can copy a private management link from their confirmation, reopen it, and remove their email and preferences. That link is a credential; it is distinct from the public invite link. Browser session storage remembers only this token, never the email. The link is removed from the address bar after it is read.

## Development and verification

`npm test` covers validation, consent, concurrent duplicates, retry recovery, ownership, updates, removal, rate limits, and API request boundaries. `npm run build` publishes only the page and its assets; Vercel separately builds `api/waitlist.js` as a server function.

For an isolated local funnel with no production data:

```sh
node scripts/dev-server.mjs --test-storage
```

Open `http://127.0.0.1:4323`. This test store lives only in that local process. To use the connected private store locally, load `.env.local` and omit `--test-storage`.

`checks/live-storage.mjs` verifies private-storage persistence with a synthetic example.com signup, then removes that test record. It requires the connected environment and must never be pointed at arbitrary user records.
