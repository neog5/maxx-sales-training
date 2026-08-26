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

   Question generation always sends PDFs as base64 file attachments so models can consider diagrams and other page imagery as well as text. It defaults to the zero-usage-cost `nvidia/nemotron-3-ultra-550b-a55b:free` model and OpenRouter’s free `cloudflare-ai` PDF parser. Pinning this model provides enough output capacity for complete question sets and avoids random free-router choices with small output limits. Free models still have lower rate limits and variable availability. Override `OPENROUTER_MODEL` for a more consistent paid model, or set `OPENROUTER_PDF_ENGINE=mistral-ocr` for stronger paid OCR of scanned documents.

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

## Useful commands

```bash
npm run dev      # development server
npm run test     # question-suggestion validation tests
npm run build    # production build
npm run start    # serve a completed production build
npm run check    # repository verification (tests and production build)
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
proxy.js                  session refresh and route protection
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
