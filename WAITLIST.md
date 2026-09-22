# Mentionloom waitlist

The live funnel has one primary action: **Join the waitlist**.

1. **Join:** email and explicit permission for early-access/launch emails. The signup is saved immediately.
2. **Qualify, optionally:** website, role, the first thing the visitor wants to understand, how they track AI recommendations today, and how soon it matters.
3. **Confirm and share:** what happens next, a public invite link, and a separate private signup-management link.

The page makes no promise of immediate access, a queue position, a launch date, or a free product plan. Joining is free. The product dashboard still uses illustrative data.

## Production data path

The public form in `waitlist.js` posts directly to the Supabase Edge Function:

```
https://osksnjqaxbqjcoqytflp.supabase.co/functions/v1/waitlist
```

The Edge Function source is versioned at:

```
supabase/functions/waitlist/index.ts
```

It persists signups in Postgres:

- `public.waitlist_signups`
- `public.waitlist_rate_limits`

The tables are private to the server role. `anon` and `authenticated` have no table privileges; the public browser never reads or writes them directly.

Allowed browser origins include:

- `https://mentionloom.com`
- `https://www.mentionloom.com`
- `https://mentionloom.vercel.app`
- Mentionloom Cloudflare Pages preview origins
- localhost / 127.0.0.1 for development

## Stored data

Each subscriber record contains the normalized email, timestamps, consent text/version, CTA source, optional campaign attribution, optional qualification, and a hashed ownership nonce. Qualification can hold website origin, role, goal, current tracking approach, and urgency.

Email addresses are normalized and deduplicated. Emails are currently **unverified**.

The Edge Function uses bounded inputs, a honeypot, persistent rate limits, signed private management tokens, and persistence verification before returning success.

## Invitations and removal

There is no automatic email sender or nurture campaign connected yet. Joining the waitlist means the email is captured for early-access/launch communication; it does not currently send a confirmation email.

Visitors can copy a private management link, reopen it, and remove their email and preferences. The browser stores only the management token in session storage, never the email.

## Database migrations

The production Supabase migration history is mirrored in `db/migrations/`, including:

- `20260921150259_harden_auth_trigger_permissions.sql`
- `20260921151708_add_waitlist_signups.sql`
- `20260922134757_harden_waitlist_table_permissions.sql`

## Verification

Before calling the funnel fully verified after a deployment:

1. Open `https://mentionloom.com`.
2. Submit a unique test email through the real waitlist UI.
3. Confirm the success state is shown only after the request completes.
4. Confirm the row appears in `public.waitlist_signups`.
5. Remove the synthetic test row or use its private management link.
6. Check the Edge Function invocation/log for unexpected errors.

Do not use real customer emails for smoke tests.
