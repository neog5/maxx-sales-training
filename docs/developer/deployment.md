# Deployment

The app runs on **Cloudflare Workers** through the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Config: `wrangler.jsonc` and `open-next.config.ts`.

## Environments

| Environment | Worker | Domain | Git branch | Supabase |
|---|---|---|---|---|
| dev | `maxx-sales-training-dev` | training-dev.maxxorthoportal.com | `dev` | current project (test data only) |
| production | `maxx-sales-training` | training.maxxorthoportal.com | `main` | business-account project (**not created yet**) |

Cloudflare Workers Builds builds from GitHub on every push to the branch:

| | Build command | Deploy command |
|---|---|---|
| dev | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy --env dev` |
| production | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy` |

Or deploy from your machine (needs `npx wrangler login`; OpenNext is not fully supported on Windows, so prefer WSL or let Cloudflare build):

```bash
npm run preview     # build and run in the local Workers runtime (needs .env.local)
npm run deploy:dev  # build and deploy the dev Worker
npm run deploy      # build and deploy the production Worker
```

The custom domains in `wrangler.jsonc` are created on deploy, so the `maxxorthoportal.com` zone must be in the same Cloudflare account. `workers_dev` and `preview_urls` are off, so there are no other URLs to the Workers.

## Variables

| Variable | Where in Cloudflare | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build** variables (Settings → Build → Variables and secrets), and runtime variables | Inlined into the bundle at build time |
| `NEXT_PUBLIC_APP_ENV` | Build variable | `dev` on every non-production Worker. **Leave unset on production.** |
| `OPENROUTER_API_KEY` | Runtime secret (Settings → Variables and Secrets) | |
| `OPENROUTER_MODEL`, `OPENROUTER_PDF_ENGINE` | Runtime variables | Optional |

Changing a build variable needs a rebuild.

## Platform limits to keep in mind

- **Worker size**: the Free plan allows 3 MB compressed (Paid: 10 MB). The build is about 1.75 MB. Check after adding dependencies with `npx wrangler deploy --dry-run` (the "gzip" figure). Keep heavy browser-only libraries behind dynamic imports.
- **CPU time**: Free plan allows 10 ms of CPU per request (waiting on Supabase or OpenRouter doesn't count). Error 1102 in logs means it was exceeded; move to the Paid plan.
- **Next.js version**: keep `next` within the range `@opennextjs/cloudflare` supports. Next 16.4 isn't supported by adapter 1.20.10 yet.
- **PDF size for AI suggestions**: 5 MiB with the free `cloudflare-ai` parser. Compress larger PDFs or use `OPENROUTER_PDF_ENGINE=mistral-ocr` (paid). Uploads are capped at 50 MB and the reader works at any size. The Worker never downloads PDFs (OpenRouter fetches them by URL), so memory isn't a concern. If that ever changes, PDFs over about 20 MB could exhaust the 128 MB Worker memory.
- **Public PDFs**: suggestions need the `course-pdfs` bucket to stay public. If it goes private, pass OpenRouter a short-lived signed URL instead.

### Why `middleware.js` and not `proxy.js`

Next 16 renamed middleware to `proxy`, but `proxy.js` always runs on the Node.js runtime, which OpenNext supports only experimentally. It also bundles a second copy of the Next.js server, adding about 1.2 MB compressed and pushing the build over the Free plan limit. The Edge `middleware.js` is supported and small. Next prints a deprecation warning for it during builds. Don't run the `middleware-to-proxy` codemod.

## Production launch checklist

Not done yet. When moving to training.maxxorthoportal.com:

1. Create the production Supabase project on the business account. Run `supabase/setup.sql`, `supabase/requested-changes.sql`, then every `supabase/migrations/NNN_*.sql` in order (not the `.undo.sql` files, and not `seed.sql`). Set Authentication → URL Configuration → Site URL to `https://training.maxxorthoportal.com`.
2. Create a Worker named exactly `maxx-sales-training` from this repo: branch `main`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`.
3. Build variables: the production `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do **not** set `NEXT_PUBLIC_APP_ENV`.
4. Runtime secret: `OPENROUTER_API_KEY`.
5. Set up [admin email alerts](operations.md#admin-email-alerts) in the production project (no `[DEV]` subject prefix).
6. Sign up and [make the first super admin](operations.md#the-first-super-admin).
7. Read [Security](security.md) and decide whether any open points must be closed first (for example, private storage for confidential PDFs).
8. Merge `dev` into `main`; the push builds and deploys production.
9. **Restrict the dev site with Cloudflare Access** so employees can't land on it by mistake. Production users are also `@maxxortho.com`, so allow a named list of testers, not the whole domain:
   - Zero Trust → Settings → Authentication: confirm the One-time PIN login method.
   - Access → Access Groups → add `Training portal – dev testers`, Include → Emails → each tester.
   - Access → Applications → Add → Self-hosted: domain `training-dev.maxxorthoportal.com` (empty path), session 24 hours, policy Allow → Include → Access Group `Training portal – dev testers`.
   - Test in a private window with an allowed and a non-allowed email. Make sure the application doesn't cover `training.maxxorthoportal.com`.

## Before every release

- `npm run check` passes (lint, unit tests, build).
- `npm run test:db` passes against the dev database if any SQL changed.
- Walk the relevant parts of the manual test plan in [TESTING.md](../TESTING.md).
- Any new migrations have been run on the target Supabase project **before** the code that needs them deploys.
- `.env.local` stays untracked; all real values live in Cloudflare and Supabase.
