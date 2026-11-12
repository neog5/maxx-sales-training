# How the features work

How each part of the portal behaves and where its code lives. For what users see step by step, read the [user guides](../user-guide/README.md).

## Sign-up and sign-in

- `app/login/page.js` uses Supabase email and password auth. Sign-up sends `full_name` as user metadata. The `handle_new_user` trigger creates the profile as a `learner` and emails the admins.
- If Supabase returns no session (email confirmation is on), the page says "Check your email to confirm your account, then sign in."
- **Forgot password**: the sign-in page calls `resetPasswordForEmail` with `redirectTo` set to `/reset-password`. The browser client exchanges the link's code as it starts (PKCE, so the link works only in the browser that asked for it), and `app/reset-password/page.js` calls `updateUser({ password })`. Each Supabase project needs the redirect URL and its own SMTP server: see [Sign-in emails](operations.md#sign-in-emails-smtp).
- Sign-out is in the avatar menu (`components/TopNav.jsx`).
- Route protection is described in [Architecture](architecture.md#how-a-request-flows).

## Course list (`/courses`)

`app/courses/page.js` loads the active, unarchived courses, the person's completed attempts, reading sessions, certificates and `required_courses()`.

- **Required courses** are those in `required_courses()` for the person. Everything else visible is under **Other courses**, marked optional.
- `CourseCatalog.jsx` shows the tiles and filters them in the browser by code, title and description (every typed word must match).
- **Tile badge** (`app/courses/CourseCard.jsx`), first match wins: *Completed* (passed, or reading-only with certificate; also a big green tick), *Not passed yet*, *In progress* (has a reading session), *Not started*. The cover strip uses the same status colour: grey, orange, red or green.
- The tile's checklist shows *Read the course* → *Pass the assessment* → *Get your certificate*, ticked as each is done. Reading-only courses skip the assessment.
- One button goes to the next step: *Start course* / *Continue reading* (reading page, which creates or resumes the reading session), *Take assessment* / *Retake assessment*, *View certificate*.
- The tile doesn't know about the attempt limit: someone who is locked out still sees *Retake assessment* and finds out on the quiz page.

## Reading (`/courses/[id]/read`)

`ReadingGateClient.jsx` runs the reading step. `PdfReader.jsx` draws the PDF, `CheckpointCard.jsx` asks the questions, and `ReadingProgressCard.jsx` shows progress.

The database decides everything that counts (migration 011): the browser never sees the right answers.

1. On load `start_reading` reuses the person's unfinished reading session or starts one (the database sets `started_at`), and returns its checkpoint questions without answers: up to 3, picked at random the first time and kept for that session.
2. **Decks** are shown in `position` order, with tabs when there is more than one.
3. **PDF reader**: pdf.js renders every page; zoom 50–200%, page buttons, drag-to-pan when zoomed, *Open PDF ↗*. The page nearest the middle of the view is the current page.
4. **Checkpoints**: once the reader reaches a checkpoint's page in its deck, the question appears and the timer pauses until it's answered correctly. *Check answer* calls `answer_reading_question`, which says right or wrong and gives the explanation, without revealing the right option. Wrong answers can be retried without limit. Options are shuffled.
5. **Timer**: counts up to the course's `read_seconds` (paused during checkpoints; it keeps running in a background tab).
6. **Unlock**: the button turns into *Start assessment →* (or *Finish and get certificate →*) once the time is up, every checkpoint is answered, and every deck has been **opened**. Decks don't have to be scrolled to the end; only the checkpoints force scrolling.
7. **Finish** calls `finish_reading`, which refuses until every checkpoint is answered and the minimum time has passed since the session started. Then:
   - normal course: go to the quiz;
   - reading-only course: the database issues the certificate, and the app opens it.

Answered checkpoints are saved, so reloading the page keeps them. The on-screen timer and the opened decks are kept only in the browser and start again on reload. The database's time check is wall-clock time since the session started.

## Assessment (`/courses/[id]/quiz`)

`quiz/page.js` sends people back to the reader unless they have a finished reading session, and sends reading-only courses to the reader. `QuizClient.jsx` runs the test and `QuizResults.jsx` shows the result.

The database picks, stores and grades every attempt (migration 011); the browser only sends the chosen options.

- **Questions**: `start_attempt` (refused without a finished reading or with no attempts left) stores a new attempt with every mandatory question plus random others: at least 5 in total, aiming for roughly 60% mandatory and 40% other. It returns them without answers. Reloading resumes the same attempt and questions; every retake draws a fresh set. Options are shuffled in the browser.
- **Answering**: every question must be answered before *Submit assessment* is enabled.
- **Grading** (`submit_attempt`): score = correct ÷ total, rounded. **Pass** = score ≥ the course's passing score **and** every mandatory question correct. It saves the answers and result in one step, stamps the submission time and, on a pass, the certificate is issued. `attemptResult` in `lib/assessment.js` turns the reply into what the results screen shows.
- **Results**: score dial, Passed or Not passed, mandatory summary, and a review of every question with the right answer and explanation. *View certificate* on a pass, *Retake assessment* while attempts remain.

### Attempt limit

`MAX_ATTEMPTS = 3` (`lib/attempts.js`, database `attempts_remaining()`, migration 007).

- Failed attempts are counted from the later of the person's last **pass** and their last **admin approval**.
- After 3 failures the assessment is locked ("Assessment locked … Ask an admin to approve more attempts"), and every admin gets an email.
- An admin approves 3 more from the person's profile (*Locked assessments → Allow 3 more attempts*), which inserts an `attempt_unlocks` row.
- Passing also resets the count, so people can retake a passed course.

## Certificates (`/certificates/[id]`)

- Issued by the database the **first** time someone passes a course, or finishes the reading of a reading-only course. Retakes don't issue another. See [Data model](data-model.md#training-records).
- The page shows the certificate and offers **Download PDF** and **Open to print**. The PDF is built in the browser: `lib/certificate-pdf.js` draws the name, course title and completion date onto `public/certificates/template.pdf` using the layout in `CERTIFICATE_TEMPLATE` (`lib/certificates.js`). Text shrinks to fit. The date uses the viewer's time zone.
- The 2-year expiry date is shown but has no effect.
- To change the design, see [Operations](operations.md#changing-the-certificate-template).

## Compliance (`lib/compliance.js`)

- A person's **required courses** are their direct assignments plus their groups' assignments, counting only active, unarchived courses.
- A required course is **done** when the person has a passed attempt **or** a certificate for it (certificates cover reading-only courses).
- **Status**: *Nothing assigned* (no required courses), *Compliant* (all done), *Not compliant* (anything outstanding).
- Expiry is ignored. Archiving or hiding a course removes it from everyone's requirements immediately.

The People page uses a different, simpler measure (`lib/attempt-stats.js`): *On track*, *Needs attention* or *Not started*, based only on the person's most recent attempt in any course.

## Admin: courses

### Creating a course (`/admin/courses/new`, `CourseFormClient.jsx`)

- Fields: code (upper-cased), title, description, training PDFs (several, up to 50 MB each), *Reading only*, passing score (default 80), minimum reading time (default 60 s), *Make this course available to learners* (default on).
- With a PDF and not reading-only, you also choose how many questions to suggest: 3–10 reading and 5–30 main test (defaults 5 and 10). Suggestions use the first PDF, which must be 5 MiB or less with the free PDF parser.
- Save order: upload PDFs → insert course → insert decks. If anything fails, the course and uploads are removed again.
- You then land on the course's Questions tab, where suggestions start automatically.

### Course Overview (`/admin/courses/[id]`)

- **Course details**: title, description, passing score, reading time, reading only, *Visible to learners*.
- **Who must complete this course**: assign training groups, or individual people (search or paste emails).
- **Reading decks** (`CourseMaterialsClient.jsx`): add PDFs, rename, reorder with ↑ ↓, remove (which also deletes that deck's reading questions).
- **Archive / Restore**: archiving hides the course from learners, stops new reading and attempts, removes it from compliance, and keeps every record. Everything on an archived course is read-only.
- **Delete** (super admin only): only when there are no training records. You must type the course code. Stored PDFs and question images are removed too.
- **History**: the last 50 audit entries for the course, its decks, assignments and attempt approvals.

### Question bank (`/admin/courses/[id]/questions`)

- `QuestionBankClient.jsx` lists questions; `QuestionEditor.jsx` edits one.
- **Main test** questions make up the assessment. **Reading test** questions are checkpoints, tied to a deck and page.
- Each question: text, optional image (5 MB, JPEG/PNG/WebP/GIF), 2+ options with one correct, explanation, and *Mandatory* (main test only).
- A notice warns when there aren't enough optional questions for the 60/40 mix: the course needs `max(5, round(mandatory ÷ 0.6))` main-test questions in total.
- Images that are replaced or removed are deleted from storage, unless a past attempt or another question still uses them.

### AI question suggestions

UI: `SuggestionLauncher.jsx` and `SuggestionPanel.jsx`. Server: `app/api/admin/question-suggestions/route.js` and `lib/question-suggestions.js`.

1. An admin picks a deck and how many reading (0–10) and main (0–30) questions to suggest.
2. The route checks the caller is an admin, the deck belongs to the course, and the PDF URL is a public `course-pdfs` URL on our Supabase project. It then sends a HEAD request to check the size: 5 MiB at most with the free parser, 50 MB otherwise.
3. It asks OpenRouter with the `file-parser` plugin, passing the PDF **by URL**, so the Worker never downloads it. Model and engine come from `OPENROUTER_MODEL` / `OPENROUTER_PDF_ENGINE`.
4. The response must be JSON with exactly the requested counts. Each question is multiple choice (exactly 4 distinct options) or True/False, with an explanation. Reading questions also need a page number. Between 1 and 2 True/False questions are required when 5 or more are asked for. If the answer doesn't parse, the route asks the model once to repair it. Any invalid question rejects the whole set.
5. Limits: 180 s per model call, about 285 s in total (`maxDuration = 300`). One retry on a network error. Error codes: 413 PDF too large, 499 cancelled, 502 model failure, 503 not configured, 504 timed out.
6. The admin reviews the suggestions, unticks any they don't want, and adds the rest. Added questions aren't mandatory and have no image.

## Admin: people and groups

- **Training groups** (`/admin/training-groups`, `GroupsClient.jsx`): create, rename, delete groups; add or remove members (search or paste emails); assign courses to the whole group. *View compliance* opens the Dashboard filtered to that group. Managers can't see this page.
- **Dashboard** (`/admin`, `ComplianceDashboardClient.jsx`): a card for everyone plus one per training group (admins), then a table of each person's completed/assigned courses and status. Filter by search, group or watchlist, and status. `?group=` and `?status=` preselect them. **Export CSV** downloads the filtered rows: Name, Role, Groups (admins only), Completed, Assigned, Status.
- **Watchlists** (`WatchlistBar.jsx`): private lists of people that managers and admins make to follow a team. They only filter the Dashboard.
- **People** (`/admin/people`): everyone with search, role and status filters and sorting, attempts, average score and pass rate.
- **Insights** (`/admin/insights`): totals, the 6 people with the lowest pass rate, accuracy by question type (mandatory, image-based…), and the full attempt log with links to each attempt review.
- **Profile** (`/profile/[id]`): role editor (admins), required training with reasons and assignment controls, training groups, locked assessments with *Allow 3 more attempts*, certificates, stats and every attempt. **Attempt review** (`/profile/[id]/attempts/[attemptId]`) shows the frozen questions with the person's answers.

## Admin email alerts

The database emails every admin and super admin through Resend, from triggers, so emails go out whatever happens in the browser:

- **New sign-up: {name}**, when a profile is created.
- **Out of attempts: {name} · {course}**, on the failed attempt that uses someone's third try, with their latest score and a link to their profile.

A sending failure only logs a warning and never blocks the sign-up or attempt. Setup is in [Operations](operations.md#admin-email-alerts).

## WordPress import

Courses from the old LearnDash portal are being brought in with `scripts/wp-import/`. See [wordpress-import.md](../wordpress-import.md).
