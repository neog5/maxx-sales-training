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

## Still open

| Gap | Impact | Options |
|---|---|---|
| **Opening every deck is checked in the browser only.** The database knows about checkpoints and time, not which decks were opened. | Someone could finish the reading without opening a deck that has no checkpoints. | Put at least one checkpoint in every deck. |
| **The minimum reading time is wall-clock time since the session started**, not time spent reading. The on-screen timer pauses for checkpoints and restarts on reload; the database only checks that enough time has passed. | Someone could start reading, leave, and come back later. | Acceptable for now. A server-side heartbeat would be needed to measure active time. |
| **Wrong reading answers can be retried without limit.** | With 4 options, guessing gets through a checkpoint. | This is the intended experience (they're learning aids); the assessment is what counts. |
| **Course PDFs and question images are public.** | Anyone with a file's URL can read it, without signing in. | If course material is confidential, make the buckets private and use signed URLs. AI suggestions would then need a signed URL too. |

## History

Before migration 011, the browser graded assessments and saved the results itself, learners could edit their own attempts afterwards (which could issue or backdate a certificate), and the question functions sent correct answers to the browser. Migration 011 closed these gaps. Its undo file restores that behaviour, so only use it together with the older app code.
