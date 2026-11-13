# Local setup

How to run the portal on your own machine against a Supabase project.

## Prerequisites

- Node.js 20.12 or newer, and npm
- A Supabase project (the dev project, or a fresh one of your own)
- An OpenRouter API key, if you want AI question suggestions (everything else works without it)

## 1. Install

```bash
npm install
```

## 2. Build the database

For a **new** Supabase project, run these files in the SQL Editor, in this order:

| File | Adds |
|---|---|
| `supabase/setup.sql` | Tables, constraints, indexes, row-level security, database functions, the sign-up trigger and the storage buckets |
| `supabase/requested-changes.sql` | Question images, mandatory questions and question-level attempt snapshots (a no-op on a fresh `setup.sql`, but run it anyway) |
| `supabase/migrations/001_compliance_safety.sql` | Four roles, course archiving, the audit log and record protection |
| `supabase/migrations/002_groups_and_assignments.sql` | Training groups and course assignments (also creates the groups *Maxx Employees*, *Normal Distributors* and *Titan Distributors*) |
| `supabase/migrations/003_view_groups.sql` | Private watchlists, emails on profiles, manager-safe `required_courses()` |
| `supabase/migrations/004_certificates.sql` | Course completion certificates |
| `supabase/migrations/005_certificate_expiry.sql` | Certificates valid for 2 years |
| `supabase/migrations/006_course_materials.sql` | Several PDFs ("decks") per course |
| `supabase/migrations/007_attempt_limit.sql` | Three failed attempts per course, then an admin approves more |
| `supabase/migrations/008_view_only_courses.sql` | Reading-only courses (no test; finishing the reading issues the certificate) |
| `supabase/migrations/009_admin_email_alerts.sql` | Emails to admins about sign-ups and people out of attempts |
| `supabase/migrations/010_storage_cleanup.sql` | Lets admins actually delete stored PDFs and images |
| `supabase/migrations/011_server_side_grading.sql` | The database checks reading and grades assessments; answers no longer reach the browser |
| `supabase/migrations/012_invites_and_user_archive.sql` | Invite-only sign-up; archiving people (they lose access, their records stay) |
| `supabase/migrations/013_private_course_pdfs.sql` | Course PDFs need a sign-in; the app opens them through signed links |
| `supabase/seed.sql` | Optional: one fictional sample course, `DEMO-101` |

Skip the `*.undo.sql` files; they reverse a migration. For an **existing** database, run only the migrations it doesn't have yet. Never rerun `setup.sql` against a database that has data. See [Database changes](operations.md#database-changes).

`seed.sql` replaces the `DEMO-101` course. Once anyone has a reading session, attempt or certificate on it, the database refuses the delete and the seed fails.

## 3. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything | From the Supabase project's API settings. Inlined into the browser bundle at build time. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything | The public anon key. Safe in the browser because row-level security does the protecting. |
| `NEXT_PUBLIC_APP_ENV` | The environment banner | Set to `local` or `dev` anywhere but production. See [Environment banner](architecture.md#environment-banner). |
| `OPENROUTER_API_KEY` | AI question suggestions | Server-only. Never give it a `NEXT_PUBLIC_` prefix. Without it the suggestions API returns 503. |
| `OPENROUTER_MODEL` | Optional | Default `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `OPENROUTER_PDF_ENGINE` | Optional | Default `cloudflare-ai` (free, PDFs up to 5 MiB). `mistral-ocr` is paid but handles scans and larger files. |
| `SUPABASE_DB_URL` | `npm run test:db` only | Postgres connection string. Scripts only, never the app. |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/wp-import/load.mjs` only | Bypasses row-level security. Scripts only, never the app or the Worker. |

Never put a service-role key or any other secret in a `NEXT_PUBLIC_*` variable: those are shipped to every browser.

## 4. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign up, then make yourself super admin in the SQL Editor:

```sql
update public.profiles set role = 'super_admin'
where id = (select id from auth.users where email = 'you@maxxortho.com');
```

The SQL Editor is allowed to change roles because it runs without a signed-in user. After this, change roles from each person's profile page.

If email confirmation is on in Supabase Auth, confirm the account before signing in (or turn confirmation off on a local project).

The sample course's PDF is `public/sample-course.pdf` and needs no upload.

## Commands

```bash
npm run dev         # development server
npm run lint        # ESLint
npm test            # unit tests for lib/ (grading, attempts, compliance, roles, certificates, suggestions…)
npm run test:db     # database access-rule tests against a real database (needs SUPABASE_DB_URL)
npm run build       # production build
npm run start       # serve a completed production build
npm run check       # lint + unit tests + build
npm run preview     # production build in the local Cloudflare Workers runtime
npm run deploy:dev  # build and deploy the dev Worker
npm run deploy      # build and deploy the production Worker
```

Testing, including the manual test plan, is in [TESTING.md](../TESTING.md).
