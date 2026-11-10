# Architecture

## Stack

| Layer | What |
|---|---|
| Framework | Next.js 16 App Router, React 19, plain JavaScript (no TypeScript), hand-written CSS |
| Data, auth and files | Supabase: Postgres with row-level security, Supabase Auth (email and password), Supabase Storage |
| PDF | `pdfjs-dist` renders course PDFs and certificate previews in the browser; `pdf-lib` and `@pdf-lib/fontkit` build certificate PDFs in the browser |
| AI | OpenRouter chat completions, for suggested quiz questions |
| Email | Resend, called from inside Postgres with `pg_net` |
| Hosting | Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`) |

There is no backend of our own besides one API route. Pages talk to Supabase directly, and **row-level security is the real access control**. The role checks in pages and components only decide what to show.

## How a request flows

```text
Browser ──► middleware.js (Edge)       refreshes the Supabase session cookie,
                │                      sends signed-out users to /login
                ▼
         Server component (page.js)    requireViewer() checks the role, then
                │                      reads Supabase as the signed-in user
                ▼
         Client component (*.jsx)      writes to Supabase from the browser
                                       (inserts, updates, uploads, RPCs)
                │
                ▼
         Supabase Postgres             RLS policies, triggers and functions
                                       decide what is actually allowed
```

1. **`middleware.js`** runs on `/courses`, `/admin`, `/profile`, `/certificates` and `/login`. It refreshes the session and redirects signed-out users to `/login` (and signed-in users away from it). It doesn't look at roles. `/` and `/api/*` aren't covered. It is Edge middleware on purpose; see [Deployment](deployment.md#why-middlewarejs-and-not-proxyjs).
2. **Server components** load data with the server client (`lib/supabase/server.js`), as the signed-in user. Guards in `lib/auth.js`:
   - `requireViewer(allowed?)` sends people without a profile to `/login` and people whose role isn't allowed to `/courses`.
   - `requireSelfOrReports(personId)` lets a person see their own profile, and managers and admins see anyone's.
   - `requireApiViewer(allowed)` is the API version (401 or 403).
3. **Client components** make changes directly with the browser client (`lib/supabase/client.js`). Errors are turned into readable text by `friendlyDbError` (`lib/db.js`). Training records (reading, attempts) are the exception: they go only through database functions such as `start_attempt` and `submit_attempt`.
4. **The database** enforces who may read and write what, stamps who did things, issues certificates, counts attempts, writes the audit log and sends alert emails. See [Data model](data-model.md).

The only server endpoint is `POST /api/admin/question-suggestions`, which holds the OpenRouter key.

## Roles

Defined in `lib/roles.js` (labels and helpers) and in the database (`profiles.role`, a text column with a check constraint).

| Role | Helper flags | Can |
|---|---|---|
| `learner` | none | Take their courses; see their own results and certificates. Default for every sign-up. |
| `manager` | `canViewReports` | Learner, plus read-only Dashboard, People, Insights and everyone's profiles; private watchlists |
| `admin` | `canViewReports`, `isAdmin` | Manager, plus courses, decks, questions, training groups, assignments, archiving, approving more attempts, changing roles (except super admin) |
| `super_admin` | all of the above, `isSuperAdmin` | Admin, plus deleting courses with no training records, and granting or removing super admin |

Every role can be assigned courses and counts toward compliance. Nobody can change their own role in the app, and admins can't change a super admin's role. The database enforces the role rules with the `prevent_profile_privilege_escalation` trigger.

## Folder layout

```text
app/
  page.js                           / → /courses or /login
  login/                            sign in and sign up
  courses/                          learner course list (required and optional)
    [id]/load-course.js             shared course loader (404, archived check)
    [id]/read/                      PDF reader, decks, reading checkpoints, timer
    [id]/quiz/                      assessment, grading, results
  certificates/[id]/                certificate preview, PDF download and print
  profile/[id]/                     person's training, role, groups, attempts, certificates
    attempts/[attemptId]/           review of one past attempt
  admin/
    page.js                         compliance Dashboard (+ watchlists)
    people/                         People directory
    insights/                       Insights and attempt log
    training-groups/                training groups, members, group assignments
    courses/                        course list
    courses/new/                    create a course
    courses/[id]/                   course Overview: details, assignments, decks, archive/delete, history
    courses/[id]/questions/         course question bank and AI suggestions
    questions/                      question editor components (+ legacy redirect route)
    useAdminMutation.js             admin form save/notice helper
  api/admin/question-suggestions/   the OpenRouter endpoint
  styles/                           admin.css and learner.css (imported by globals.css)
  error.js, loading.js              error boundary and default skeleton
components/                         shared UI (TopNav, MultiPicker, MemberList, Skeleton, …)
hooks/useMutation.js                busy/error state for browser writes
lib/                                logic, mostly pure functions with *.test.js beside them
  supabase/                         browser and server clients
supabase/
  setup.sql, requested-changes.sql  base schema
  migrations/NNN_*.sql              numbered migrations, each with an .undo.sql
  seed.sql                          the DEMO-101 sample course
  tests/access-rules.mjs            database permission tests (npm run test:db)
scripts/wp-import/                  one-off WordPress/LearnDash course import
public/
  certificates/                     certificate template PDF and fonts
  sample-course.pdf                 the sample course's PDF
middleware.js                       session refresh and sign-in redirect
wrangler.jsonc, open-next.config.ts Cloudflare Worker and OpenNext config
```

## The `lib/` modules

Most rules live in small, pure, unit-tested modules. If you're changing behaviour, start here.

| Module | Holds |
|---|---|
| `roles.js` | Role names, labels, `isAdmin`, `canViewReports`, `assignableRoles` |
| `auth.js` | Page and API guards (`requireViewer`, `requireSelfOrReports`, `requireApiViewer`) |
| `assessment.js` | Option shuffling, the results-screen shape of a graded attempt (`attemptResult`; grading itself is in the database), answer summaries and question-type performance, the 60/40 question mix (`MANDATORY_SHARE`, `MIN_ASSESSMENT_QUESTIONS`) |
| `attempts.js` | The attempt limit as the UI sees it (`MAX_ATTEMPTS = 3`, `attemptAllowance`). Mirrors the database's `attempts_remaining()`. |
| `compliance.js` | Who must do what, who is compliant, group summaries |
| `attempt-stats.js` | Per-person stats for People and Insights (On track / Needs attention / Not started) |
| `certificates.js` | `CERTIFICATE_TEMPLATE` (text positions, fonts, colours) and the field values |
| `certificate-pdf.js` | Draws a certificate onto the template with pdf-lib |
| `course-materials.js` | Deck helpers: bucket name, 50 MB limit, upload paths, titles from file names, reordering |
| `question-suggestions.js` | The OpenRouter prompt, response parsing and validation |
| `question-images.js` | Question image upload and safe cleanup |
| `storage.js` | `removeStoredFiles`, best-effort deletion of stored files |
| `audit.js` | Turns `audit_log` rows into sentences for course History |
| `queries.js` | Shared Supabase queries: a person's assignments, starting a reading session (`start_reading`), everyone's profiles, a course's decks |
| `db.js` | `must`, `mustFind` (404 on missing rows), `fetchAll` (pages past the 1,000-row limit), `friendlyDbError` |
| `people.js`, `picker-items.js` | Name and email display; items for `MultiPicker` |
| `format.js`, `routes.js` | Date and number formatting; URL builders for every page |

## UI conventions

- **Server pages, client islands.** `page.js` loads data on the server and hands it to one client component (`*Client.jsx`) that handles interaction.
- **Writes** go through `hooks/useMutation.js` (busy label, friendly errors, optional `router.refresh()`). Admin screens use `app/admin/useAdminMutation.js`, which adds success messages and ready-made `Notice`s.
- **Loading states:** every route segment has a `loading.js` that renders a skeleton from `components/Skeleton.jsx`.
- **Errors:** `lib/db.js` `must()` throws on failed loads, and `app/error.js` shows "Something went wrong" with a retry. Missing rows and bad ids give a 404.
- **People pickers:** `components/MultiPicker.jsx` searches by name or email, shows the first 50 matches, can select all matches, and accepts a pasted list of emails. `components/MemberList.jsx` pages long lists.
- **Dates** render in UTC on the server and switch to the viewer's local time after hydration (`components/LocalDate.jsx`).
- **Heavy browser libraries** (pdf.js, pdf-lib) are loaded lazily, and the certificate viewer uses `next/dynamic` with `ssr: false`, so they stay out of the Worker bundle.

## Environment banner

`components/EnvironmentBanner.jsx` reads `NEXT_PUBLIC_APP_ENV`. Anything except `production` (or unset) shows a red strip, "{ENV} environment · Test site with test data…", prefixes the tab title with `[ENV]`, and tells search engines not to index the site. Production must leave it unset. It's a build-time variable, so changing it needs a rebuild.
