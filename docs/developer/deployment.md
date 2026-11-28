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
- **Private PDFs**: the `course-pdfs` bucket is private (migration 013). OpenRouter gets a signed link that works for 15 minutes.

### Why `middleware.js` and not `proxy.js`

Next 16 renamed middleware to `proxy`, but `proxy.js` always runs on the Node.js runtime, which OpenNext supports only experimentally. It also bundles a second copy of the Next.js server, adding about 1.2 MB compressed and pushing the build over the Free plan limit. The Edge `middleware.js` is supported and small. Next prints a deprecation warning for it during builds. Don't run the `middleware-to-proxy` codemod.

## Production launch plan

Not done yet (updated 27 Nov 2026). Production is training.maxxorthoportal.com. Its database is built from scratch: there is no production data to migrate. Work through the phases in order. Each phase lists who does it.

### Phase 0 · Decisions and content (before any production setup)

1. **Close the open decisions.** Go through the security open points in [Security](security.md#still-open) and decide which must be fixed before launch. Also decide whether to move AI suggestions off OpenRouter first (GitHub issue #7). *Owner: product owner.*
2. **Certificate template.** Swap in the final template if it's changing, then check that a very long name and a long course title still fit ([Changing the certificate template](operations.md#changing-the-certificate-template)). *Owner: product owner, then developer.*
3. **Course content.** Every course from the old WordPress site goes to production. That means the 7 quiz courses already imported to dev, plus the view-only courses still waiting for their Google Slides PDFs, plus the 11 courses without quizzes. Collect every missing PDF and decide how the no-quiz courses are set up (No assessment, or questions added). See [wordpress-import.md](../wordpress-import.md). *Owner: product owner.*
4. **Docs refresh.** Bring the developer docs and user guides up to date with the late-November changes (the list is in the pre-launch review notes). *Owner: developer.*
5. **Freeze dev.** `npm run check` and `npm run test:db` pass, the review checklist is ticked, and nothing else merges into `dev` until launch. *Owner: developer.*

### Phase 1 · Production Supabase (business account)

6. Create the production project on the business account, on the **Pro** plan (needed for video storage), in the same region as dev.
7. Build the schema: run `supabase/setup.sql`, `supabase/requested-changes.sql`, then every `supabase/migrations/NNN_*.sql` in order, from `001` to the newest (`020` at the time of writing). Don't run the `.undo.sql` files or `seed.sql`. Then check that the buckets `course-pdfs`, `course-videos` and `question-images` exist, and that `course-pdfs` and `course-videos` are private.
8. Point a scratch copy of `SUPABASE_DB_URL` at the new project and run `npm run test:db` once. It runs inside a transaction that is rolled back, so it leaves nothing behind. Then remove the scratch value.
9. Storage → Settings: raise the global upload limit to **2 GB** (needs the Owner or Administrator role), or video uploads fail.
10. Authentication → URL Configuration: Site URL `https://training.maxxorthoportal.com`. Add `https://training.maxxorthoportal.com/reset-password` to Redirect URLs.
11. Set up [sign-in emails (SMTP)](operations.md#sign-in-emails-smtp). Without it, confirmation and forgot-password emails don't reach anyone outside the Supabase organisation.
12. Set up [admin email alerts](operations.md#admin-email-alerts) in Vault: `resend_api_key`, `portal_url` = `https://training.maxxorthoportal.com`, and `alert_from_email` = `Maxx Ortho Sales Training <alerts@maxxorthoportal.com>`. Leave out `alert_subject_prefix`, so there's no `[DEV]` prefix. To send from `sales-training-alerts@maxxortho.com` instead, IT must first verify `maxxortho.com` in Resend (DNS records).

### Phase 2 · Production Worker (Cloudflare)

13. Create a Worker named exactly `maxx-sales-training` from this repo. Branch `main`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`. Don't connect it until step 19, so nothing deploys early.
14. Build variables: the production `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do **not** set `NEXT_PUBLIC_APP_ENV`, so there's no DEV banner.
15. Runtime secret `OPENROUTER_API_KEY` (or the new provider's key if issue #7 was done first).

### Phase 3 · People and content in production

16. Sign up with your own address and [make the first super admin](operations.md#the-first-super-admin). Invite-only sign-up means the very first account needs the one-off step described there.
17. Import the courses. Run `scripts/wp-import/load.mjs` against production with the production service-role key in your shell only (never in a file in the repo). Then upload the remaining decks and videos by hand. Every course starts as "Only the groups and people you give it to", so nobody sees anything yet.
18. Create the training groups, give each course to its groups (Required or Optional, or "Everyone"), and check every course's questions.

### Phase 4 · Go live

19. Merge `dev` into `main` (only on the product owner's go-ahead). The push builds and deploys production.
20. Smoke test on training.maxxorthoportal.com with a test learner you invite yourself: sign up from the invite email, finish one course to a certificate, check the admin emails arrive, then archive the test learner.
21. Send the real invites (People → Invites), in batches by training group.

### Phase 5 · After launch

22. **Restrict the dev site with Cloudflare Access** so employees can't land on it by mistake. Production users are also `@maxxortho.com`, so allow a named list of testers, not the whole domain:
   - Zero Trust → Settings → Authentication: confirm the One-time PIN login method.
   - Access → Access Groups → add `Training portal – dev testers`, Include → Emails → each tester.
   - Access → Applications → Add → Self-hosted: domain `training-dev.maxxorthoportal.com` (empty path), session 24 hours, policy Allow → Include → Access Group `Training portal – dev testers`.
   - Test in a private window with an allowed and a non-allowed email. Make sure the application doesn't cover `training.maxxorthoportal.com`.
23. Disconnect the old Vercel app from the GitHub repo. It still runs a failing check on every pull request.
24. Watch the first week: Worker logs (error 1102 means the Free plan's CPU limit was hit, so move to Paid), Resend delivery, and the Dashboard.

## Before every release

- `npm run check` passes (lint, unit tests, build).
- `npm run test:db` passes against the dev database if any SQL changed.
- Walk the relevant parts of the manual test plan in [TESTING.md](../TESTING.md).
- Any new migrations have been run on the target Supabase project **before** the code that needs them deploys.
- `.env.local` stays untracked; all real values live in Cloudflare and Supabase.
