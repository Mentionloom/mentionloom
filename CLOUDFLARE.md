# Cloudflare Pages

Mentionloom's public frontend is ready to deploy from this repository with Cloudflare Pages.

## Git deployment

Create a Pages project connected to `Mentionloom/mentionloom` with:

- Project name: `mentionloom`
- Production branch: `main`
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy:cloudflare`
- Build output directory: `dist`
- Node.js: `22`

No runtime secret is required for the public waitlist. The form posts to the `waitlist` Supabase Edge Function, which persists signups in Postgres.

Keep the project name `mentionloom` so production uses `https://mentionloom.pages.dev`; that origin is already allowed by the waitlist function.

Vercel can remain connected temporarily as a fallback while Cloudflare Pages is verified.


## Current Cloudflare build settings

Do **not** use `npx wrangler deploy` for this project. Mentionloom is a Pages project, so the deploy command must be:

```
npm run deploy:cloudflare
```

That runs:

```
npx wrangler@4.136.0 pages deploy dist --project-name=mentionloom
```
