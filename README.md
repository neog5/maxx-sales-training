# Maxx Orthopedics Rep Training Portal

A Next.js 16 App Router application backed by Supabase. Reps read course PDFs, complete page-based reading checkpoints, take randomized quizzes, and review their results. Admins can create courses, upload PDFs, manage question banks, and view attempt metrics.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Supabase project
- An OpenRouter API key (for AI-generated question recommendations)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. In a new Supabase project's SQL editor, run these files in order:

   - `supabase/setup.sql` - tables, constraints, indexes, row-level security, database functions, signup trigger, and storage buckets
   - `supabase/seed.sql` - one fictional sample course with reading and quiz questions

3. Copy the environment template and add the public credentials from the Supabase project's API settings:

   ```bash
   cp .env.local.example .env.local
   ```

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```

   The two `NEXT_PUBLIC_*` values are intentionally exposed to the browser. `OPENROUTER_API_KEY` is server-only and must never use the `NEXT_PUBLIC_` prefix. Security depends on Supabase Row Level Security; never put a service-role key or another private credential in a `NEXT_PUBLIC_*` variable.

   Question generation passes the course PDF to OpenRouter by its public Supabase URL (OpenRouter fetches the file itself), so models can consider diagrams and other page imagery as well as text without the server buffering the PDF. It defaults to the zero-usage-cost `nvidia/nemotron-3-ultra-550b-a55b:free` model and OpenRouter’s free `cloudflare-ai` PDF parser. Pinning this model provides enough output capacity for complete question sets and avoids random free-router choices with small output limits. Free models still have lower rate limits and variable availability. Override `OPENROUTER_MODEL` for a more consistent paid model, or set `OPENROUTER_PDF_ENGINE=mistral-ocr` for stronger paid OCR of scanned documents.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The included `public/sample-course.pdf` is referenced by the sample course and requires no storage upload.

## Create an administrator

Sign up through the app. The database trigger creates a `profiles` row with the `rep` role. In the Supabase Table Editor, change that profile's role to `admin`, then refresh the app. Admins can open `/admin`, upload course PDFs, and edit question banks.

If the database was created before profile role editing was added, run `supabase/profile-role-policy.sql` once in the Supabase SQL Editor. Without this policy, Supabase RLS blocks admins from updating another person's role.

If the database already exists, run `supabase/requested-changes.sql` in the Supabase SQL Editor after pulling these changes, even if you ran an earlier version of that script. It safely adds question images, mandatory assessment questions, and the attempt-question metadata used by performance reporting. Do not rerun `setup.sql` against an existing database.

If email confirmation is enabled in Supabase Auth, confirm the new account before signing in. For a frictionless local demo, adjust that setting in the Supabase dashboard.

## Deploying to Cloudflare Workers

The app deploys to Cloudflare Workers with the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Config lives in `wrangler.jsonc` and `open-next.config.ts`.

There are two Workers, defined as environments in `wrangler.jsonc`, each with its own Supabase project:

| Environment | Worker | Domain | Git branch | Supabase |
|---|---|---|---|---|
| dev | `maxx-sales-training-dev` | training-dev.maxxorthoportal.com | `dev` | current project |
| production | `maxx-sales-training` | training.maxxorthoportal.com | `main` | business-account project (not created yet) |

```bash
npm run preview     # build and run in the local Workers runtime (needs .env.local)
npm run deploy:dev  # build and deploy the dev Worker (needs `npx wrangler login`)
npm run deploy      # build and deploy the production Worker
```

Build variables per Worker (Settings → Build → Variables and secrets): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and on every non-production Worker `NEXT_PUBLIC_APP_ENV=dev`. Runtime secret (Settings → Variables and Secrets, outside Build): `OPENROUTER_API_KEY`.

**Environment banner:** when `NEXT_PUBLIC_APP_ENV` is set to anything other than `production`, every page shows a red "DEV environment" strip, the browser tab title is prefixed with `[DEV]`, and search engines are told not to index the site (`components/EnvironmentBanner.jsx`). The production Worker must leave `NEXT_PUBLIC_APP_ENV` unset (or set it to `production`). It is a build variable, so changing it requires a rebuild.

In Cloudflare Workers Builds, use build command `npx opennextjs-cloudflare build` and deploy command `npx opennextjs-cloudflare deploy --env dev` for the dev Worker, or `npx opennextjs-cloudflare deploy` for production. The custom domains in `wrangler.jsonc` are created on deploy, so the `maxxorthoportal.com` zone must be in the same Cloudflare account as the Workers.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined at build time, so in Cloudflare Workers Builds set them as **build variables** as well as runtime variables.
- `OPENROUTER_API_KEY` (and optional `OPENROUTER_MODEL` / `OPENROUTER_PDF_ENGINE`) are runtime-only: add them as Worker secrets/variables.
- Keep `next` within the range supported by `@opennextjs/cloudflare`; Next 16.4 is not yet supported by adapter 1.20.10.
- OpenNext is not fully supported on Windows; prefer WSL, or let Cloudflare build from GitHub.
- **Worker size:** the Workers Free plan limits the compressed Worker to 3 MB (Paid: 10 MB). The build is currently about 1.75 MB. Check it with `npx wrangler deploy --dry-run` ("gzip" figure) after adding dependencies.
- **Route protection uses `middleware.js`, not `proxy.js`.** Next 16 renamed middleware to `proxy`, but `proxy.js` always runs on the Node.js runtime, which OpenNext supports only experimentally and which bundles a second copy of the Next.js server (about +1.2 MB compressed, over the Free plan limit). The Edge `middleware.js` is officially supported and much smaller. Next prints a deprecation warning for it during builds; do not run the `middleware-to-proxy` codemod while deploying to Cloudflare.
- **Workers Free plan CPU limit:** 10 ms of CPU time per request (time spent waiting on Supabase/OpenRouter does not count). Requests that exceed it fail with error 1102; if that appears in logs, move to the Workers Paid plan.
- **Course PDF size:** with the default free `cloudflare-ai` PDF engine, AI question suggestions only work for PDFs of **5 MiB (5,242,880 bytes) or less**. OpenRouter rejects larger files with "The file exceeds the maximum size supported by the file parser" (or "Download exceeded 5242880 byte limit" when sent by URL). Compress larger PDFs before uploading (a lossless re-save often saves 10%; image downsampling saves far more), or set `OPENROUTER_PDF_ENGINE=mistral-ocr` (paid). Uploads themselves are capped at 50 MB by the storage bucket, and the course reader works at any size. The Worker no longer downloads PDFs (OpenRouter fetches the public URL), so the 128 MB Worker memory limit no longer applies. If the route is ever changed back to downloading or base64-encoding PDFs, PDFs over about 20 MB can exhaust Worker memory.
- **Private PDFs:** the URL approach requires the `course-pdfs` bucket to stay public. If it becomes private, pass a short-lived signed URL to OpenRouter instead.

## Production launch checklist

Not done yet. When moving to training.maxxorthoportal.com:

1. Create the production Supabase project on the business account, run `supabase/setup.sql` (and any later migration files), and set its Authentication → URL Configuration Site URL to `https://training.maxxorthoportal.com`.
2. Create a second Worker named exactly `maxx-sales-training` from this repo: Git branch `main`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`.
3. Build variables: the production `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do **not** set `NEXT_PUBLIC_APP_ENV` (no dev banner).
4. Runtime secret (Settings → Variables and Secrets, not Build): `OPENROUTER_API_KEY`.
5. Merge `dev` into `main`; the push builds and deploys production.
6. **Restrict the dev site with Cloudflare Access** so employees cannot land on it by mistake (production users are also `@maxxortho.com`, so allow a named list of testers, not the whole domain):
   - Zero Trust → Settings → Authentication: confirm the One-time PIN login method.
   - Access → Access Groups → add `Training portal – dev testers`, Include → Emails → each tester.
   - Access → Applications → Add → Self-hosted: domain `training-dev.maxxorthoportal.com` (empty path), session 24 hours, policy Allow → Include → Access Group `Training portal – dev testers`.
   - Test in a private window with an allowed and a non-allowed email. Make sure the application does not cover `training.maxxorthoportal.com`.
   - `workers_dev` and `preview_urls` are already disabled in `wrangler.jsonc`, so Access cannot be bypassed via other URLs.
7. Retire the old Vercel deployment.

## Useful commands

```bash
npm run dev      # development server
npm run test     # question-suggestion validation tests
npm run build    # production build
npm run start    # serve a completed production build
npm run check    # repository verification (tests and production build)
npm run preview  # production build in the local Cloudflare Workers runtime
npm run deploy   # deploy to Cloudflare Workers
```

## Database files

- `supabase/setup.sql` initializes a fresh Supabase project.
- `supabase/seed.sql` replaces only the `DEMO-101` sample course, so it can be rerun without deleting real courses or users.
- `supabase/requested-changes.sql` upgrades an existing database with question media, mandatory-question assessment selection, and question-level attempt reporting.
- `supabase/profile-role-policy.sql` upgrades older databases with administrator profile-editing access.

The setup script is intended for a fresh project and is not a migration for an existing database. Future schema changes should use a migration workflow rather than rerunning it against production.

## Application structure

```text
app/
  login/                  authentication
  courses/                rep-facing course list
  courses/[id]/read/      PDF reader and page checkpoints
  courses/[id]/quiz/      randomized quiz and results
  admin/                  dashboard
  admin/people/           searchable team directory and performance overview
  admin/courses/          course and PDF creation
  admin/questions/        question bank CRUD
components/               shared UI components
lib/supabase/             browser and server Supabase clients
public/sample-course.pdf  fictional sample training document
supabase/setup.sql        complete fresh-project database setup
supabase/seed.sql         sample course and question bank
supabase/requested-changes.sql  existing-project question upgrade
middleware.js             session refresh and route protection (Edge middleware; see Cloudflare notes)
wrangler.jsonc            Cloudflare Worker configuration
open-next.config.ts       OpenNext Cloudflare adapter configuration
```

## Prototype security and integrity limitations

This code is suitable for demonstration and further development, but quiz outcomes should not yet be treated as trusted training or compliance records:

- Grading and attempt creation happen in the browser, so an authenticated user can alter submitted results.
- Quiz RPC responses include correct answers and explanations before submission.
- Reading completion and retry cooldown enforcement are client-side and can be bypassed.
- The results screen may appear even if attempt persistence fails.
- Public course PDFs and question images are readable by anyone with their URL. Use private buckets and signed URLs if course material is confidential.

Move grading, attempt persistence, reading-gate enforcement, and cooldown enforcement to trusted server-side code before production use.

## Publishing checklist

- Keep `.env.local` untracked and configure environment variables in the deployment platform.
- Run `npm run check` before each release.
- Review uploaded course materials for redistribution rights and confidential information.
- Choose and add a `LICENSE` file if you intend to grant reuse rights. A public repository without a license does not grant general permission to copy or modify the code.
