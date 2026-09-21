# Cloudflare deployment

Mentionloom is deployed from `Mentionloom/mentionloom` using Cloudflare Workers Static Assets.

The current Cloudflare Git build settings can remain:

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Node.js: `22`

`wrangler.toml` points Cloudflare at `./dist`:

```toml
name = "mentionloom"
compatibility_date = "2026-09-21"

[assets]
directory = "./dist"
```

No Worker entry point is needed because Mentionloom's public site is deployed as static assets.

The public waitlist posts directly to the Supabase `waitlist` Edge Function and persists new signups in Postgres, so this frontend deployment does not need Vercel runtime APIs or Cloudflare runtime secrets.

Vercel may remain connected temporarily as a fallback while the Cloudflare deployment is verified.
