# Security and record integrity

How the portal protects data, and what's still open.

## What protects what

- **Row-level security** on every table is the real access control. The anon key in the browser can only do what the policies allow for the signed-in user. See [Data model](data-model.md).
- **Database functions** do everything that decides a training record: picking questions, checking reading answers, finishing the reading, grading and saving attempts (migration 011). Learners can't write reading sessions, attempts or attempt questions directly.
- **Page guards** (`lib/auth.js`) and hidden buttons only control what people see.
- **Triggers** stamp who did things (archiving, group changes, assignments), keep the audit log append-only, prevent role escalation, set reading start times and issue certificates.
- **Foreign keys** with `ON DELETE RESTRICT` stop anyone deleting courses or people that have training records.
- **Secrets**: the OpenRouter key exists only on the server (the Worker). The Resend key exists only in Supabase Vault. No service-role key is used by the app.
- **Tests**: `npm run test:db` checks all of this as real learner, manager, admin and super admin users.

## What the database enforces

- **Grading.** `submit_attempt` scores the attempt, decides pass or fail (passing score and every mandatory question right), and stamps the submission time. The browser only sends the chosen options.
- **Answers stay hidden.** `start_attempt` and `start_reading` send questions without correct answers or explanations. A reading answer is checked by `answer_reading_question`, which says right or wrong without revealing the right option. Assessment answers come back only after submitting, and the questions of an unsubmitted attempt can't be read by anyone.
- **Reading before the test.** `start_attempt` refuses until the person has finished the reading. `finish_reading` refuses until every checkpoint in that session is answered correctly and the course's minimum reading time has passed since the session started. The browser can't set or change the start time.
- **Fixed question sets.** An attempt's questions, and a reading session's checkpoints, are chosen once and stored. Reloading the page resumes the same set, so people can't redraw until they get easy questions.
- **Records can't be edited.** Attempts, attempt questions and reading sessions can't be inserted or updated by learners. Certificates are only issued by the database, one per person per course, and nobody can edit or delete them.
- **Attempt limit.** No new attempt once 3 have failed since the last pass or admin approval.
- **Archived courses.** No new reading or attempts.
- **Roles.** Only admins change roles; only super admins grant or remove super admin.
- **Audit log.** Append-only, admins only.
- **Privacy.** Watchlists are private to their creator; managers can't see training groups or change anything.
- **Invite-only sign-up.** `handle_new_user` refuses any new account whose email isn't in `invites`, so it also covers sign-ups sent straight to Supabase. Only admins add or withdraw invites. Direct database sessions (the SQL Editor) are trusted, which is how the first invite gets in.
- **Archived people.** A restrictive policy on every table refuses anyone whose profile is archived, the role checks treat them as having no role, and the reading and assessment functions refuse them. Their records stay. Their Supabase sign-in still works, but everything behind it is closed; they land on `/deactivated`.
- **Course PDFs need a sign-in.** The `course-pdfs` bucket is private. Signed-in, unarchived people can read the files, and the app gives out signed links that expire (8 hours for reading, 1 hour for the admin *Open* button, 15 minutes for AI suggestions).

## Still open

| Gap | Impact | Options |
|---|---|---|
| **Opening every deck is checked in the browser only.** The database knows about checkpoints and time, not which decks were opened. | Someone could finish the reading without opening a deck that has no checkpoints. | Put at least one checkpoint in every deck. |
| **The minimum reading time is wall-clock time since the session started**, not time spent reading. The on-screen timer pauses for checkpoints and restarts on reload; the database only checks that enough time has passed. | Someone could start reading, leave, and come back later. | Acceptable for now. A server-side heartbeat would be needed to measure active time. |
| **Wrong reading answers can be retried without limit.** | With 4 options, guessing gets through a checkpoint. | This is the intended experience (they're learning aids); the assessment is what counts. |
| **People can change their own name and profile email through the API.** The `profiles_update_own` policy allows any column except `role` (which a trigger guards). There is no screen for it, and name changes aren't in the audit log. | A certificate copies the name at the moment it is issued, so someone could rename themselves first. The profile email is display-only (sign-in uses the auth email), but it is what admins see and where admin alerts are sent. Left as is on 2026-11-13. | Limit the policy to no columns (or a trigger that rejects changes to `full_name` and `email` unless an admin makes them), and add name changes to the audit log. |
| **Any signed-in person can open any course PDF**, including a hidden course's, if they know its path in the bucket (the path contains a random id). | Low: sign-up is invite-only and paths aren't listed to learners. | Tie the storage policy to the decks the person can see. |
| **A signed PDF link works for anyone until it expires** (up to 8 hours). | A learner could forward a link. | Shorter links, refreshed by the reader. |
| **Question images are public.** | Anyone with an image's URL can see it, without signing in. | Make the bucket private and sign the links; past attempts store the public address, so their review pages need the same treatment. |
| **Refusing an uninvited sign-up isn't covered by `npm run test:db`**: the test database user can't act as Supabase Auth. | A regression would go unnoticed by the automated tests. | Manual case A8 in [TESTING.md](../TESTING.md) covers it; run it after any change to `handle_new_user`. |

## History

Before migration 011, the browser graded assessments and saved the results itself, learners could edit their own attempts afterwards (which could issue or backdate a certificate), and the question functions sent correct answers to the browser. Migration 011 closed these gaps. Its undo file restores that behaviour, so only use it together with the older app code.
