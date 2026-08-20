# Maxx Orthopedics Rep Training Portal

A Next.js 16 App Router application backed by Supabase. Reps read course PDFs, complete page-based reading checkpoints, take randomized quizzes, and review their results. Admins can create courses, upload PDFs, manage question banks, and view attempt metrics.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Supabase project

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. In a new Supabase project's SQL editor, run these files in order:

   - `supabase/setup.sql` - tables, constraints, indexes, row-level security, database functions, signup trigger, and the `course-pdfs` storage bucket
   - `supabase/seed.sql` - one fictional sample course with reading and quiz questions

3. Copy the environment template and add the public credentials from the Supabase project's API settings:

   ```bash
   cp .env.local.example .env.local
   ```

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   These two values are intentionally exposed to the browser. Security depends on Supabase Row Level Security; never put a service-role key or another private credential in a `NEXT_PUBLIC_*` variable.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The included `public/sample-course.pdf` is referenced by the sample course and requires no storage upload.

## Create an administrator

Sign up through the app. The database trigger creates a `profiles` row with the `rep` role. In the Supabase Table Editor, change that profile's role to `admin`, then refresh the app. Admins can open `/admin`, upload course PDFs, and edit question banks.

If email confirmation is enabled in Supabase Auth, confirm the new account before signing in. For a frictionless local demo, adjust that setting in the Supabase dashboard.

## Useful commands

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve a completed production build
npm run check    # repository verification (currently the production build)
```

## Database files

The repository deliberately has only two SQL entry points:

- `supabase/setup.sql` initializes a fresh Supabase project.
- `supabase/seed.sql` replaces only the `DEMO-101` sample course, so it can be rerun without deleting real courses or users.

The setup script is intended for a fresh project and is not a migration for an existing database. Future schema changes should use a migration workflow rather than rerunning it against production.

## Application structure

```text
app/
  login/                  authentication
  courses/                rep-facing course list
  courses/[id]/read/      PDF reader and page checkpoints
  courses/[id]/quiz/      randomized quiz and results
  admin/                  dashboard
  admin/courses/          course and PDF creation
  admin/questions/        question bank CRUD
components/               shared UI components
lib/supabase/             browser and server Supabase clients
public/sample-course.pdf  fictional sample training document
supabase/setup.sql        complete fresh-project database setup
supabase/seed.sql         sample course and question bank
proxy.js                  session refresh and route protection
```

## Prototype security and integrity limitations

This code is suitable for demonstration and further development, but quiz outcomes should not yet be treated as trusted training or compliance records:

- Grading and attempt creation happen in the browser, so an authenticated user can alter submitted results.
- Quiz RPC responses include correct answers and explanations before submission.
- Reading completion and retry cooldown enforcement are client-side and can be bypassed.
- The results screen may appear even if attempt persistence fails.
- Public course PDFs are readable by anyone with their URL. Use a private bucket and signed URLs if course material is confidential.

Move grading, attempt persistence, reading-gate enforcement, and cooldown enforcement to trusted server-side code before production use.

## Publishing checklist

- Keep `.env.local` untracked and configure environment variables in the deployment platform.
- Run `npm run check` before each release.
- Review uploaded course materials for redistribution rights and confidential information.
- Choose and add a `LICENSE` file if you intend to grant reuse rights. A public repository without a license does not grant general permission to copy or modify the code.
