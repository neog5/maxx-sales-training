# Data model

The database is the source of truth for permissions. Everything below is the state after `setup.sql`, `requested-changes.sql` and migrations 001–010 have all run. All tables are in `public` with row-level security (RLS) on.

There are no Postgres enum types. Roles, question types and attempt statuses are `text` columns with check constraints.

## Shorthand used below

| Term | Meaning | Database helper |
|---|---|---|
| **admin** | `admin` or `super_admin` | `is_admin()` |
| **reports** | `manager`, `admin` or `super_admin` | `can_view_reports()` |
| **super admin** | `super_admin` only | `is_super_admin()` |
| **own** | the row's `user_id` is the signed-in user | `auth.uid()` |

## Entity overview

```text
auth.users ─1:1─ profiles ─┬─< reading_sessions >─┬─< reading_session_questions
                           ├─< quiz_attempts ─────┼─< attempt_questions
                           ├─< certificates ──────┤
                           ├─< attempt_unlocks ───┤
                           ├─< group_members >── groups
                           ├─< course_assignments (to a group OR a person)
                           └─< view_groups ─< view_group_members
courses ─┬─< course_materials ─< questions (reading)
         ├─< questions (main test)
         └─< course_assignments
audit_log (append-only, written by triggers)
```

## Tables

### People

**`profiles`**: one row per sign-up, created by the `handle_new_user` trigger.

| Column | Notes |
|---|---|
| `id` | = `auth.users.id` (deleted with the auth user) |
| `full_name` | From the sign-up form, or the email if blank |
| `role` | `learner` (default), `manager`, `admin`, `super_admin` |
| `email` | Copied from `auth.users` and kept in sync by trigger |
| `region`, `created_at` | `region` is unused by the UI |

RLS: read your own, or everyone if reports. Update your own (except `role`), or anyone's if admin. Role changes are checked by the `prevent_profile_privilege_escalation` trigger: only admins may change roles, and only a super admin may grant or remove `super_admin`. Sessions without a signed-in user (SQL Editor, service role) skip the check.

### Courses and content

**`courses`**

| Column | Notes |
|---|---|
| `code` | Unique, stored upper-case, e.g. `DEMO-101` |
| `title`, `description` | |
| `pass_threshold` | 0–100, default 80 |
| `read_seconds` | Minimum reading time, default 60 |
| `is_active` | "Visible to learners" |
| `view_only` | "Reading only": no test; finishing the reading issues the certificate |
| `archived_at`, `archived_by` | Set by the `stamp_course_archive` trigger. The app only sends `archived_at`; the database overwrites it with `now()` and the real user. |

RLS: everyone can read active courses; admins read all. Admins insert and update. Only super admins delete. Archived courses are **not** hidden by RLS (the app filters `archived_at` itself), but the database blocks new reading sessions and attempts on them.

**`course_materials`**: a course's PDF "decks", read in `position` order. Columns: `course_id`, `position`, `title`, `pdf_url`. Readable by anyone who can see the course; admin-only writes. Deleting a deck deletes its reading questions.

**`questions`**: the question bank.

| Column | Notes |
|---|---|
| `question_type` | `main_test` (the assessment) or `reading_test` (a checkpoint inside the reader) |
| `material_id`, `page_number` | Reading questions must have both (the page is within that deck); main-test questions must have neither |
| `question_text`, `image_url` | Image optional |
| `options`, `correct_index` | `options` is a JSON array of at least 2 strings |
| `explanation` | Shown after answering |
| `is_mandatory` | Main test only: always included, and must be answered correctly to pass |
| `is_active` | Inactive questions are never served |

RLS: **admins only**. Learners and managers never read this table. They get questions, without answers, through `start_reading` and `start_attempt`.

### Training records

These are compliance records. Their foreign keys to `profiles` and `courses` use `ON DELETE RESTRICT`, so the database refuses to delete a course or person that has any.

Learners can **read** their own records (reports roles read everyone's) but never write them directly. Only the [database functions](#database-functions) create and change them.

**`reading_sessions`**: one row each time someone starts reading a course, made by `start_reading`. `started_at` is set by the server (`protect_reading_started_at`); `checkpoint_passed` and `completed_at` are set by `finish_reading`. A person can have several per course, but only one unfinished at a time.

**`reading_session_questions`**: the (up to 3) checkpoint questions picked for a session, with `answered_at` once answered correctly. No one reads it directly.

**`quiz_attempts`**: one row per assessment attempt. `status` is `in_progress` from `start_attempt` until `submit_attempt` sets it to `completed` with `score` (0–100), `passed` and `submitted_at`. Every screen and report counts only completed attempts.

**`attempt_questions`**: a frozen copy of each question in an attempt (text, image, options, correct answer, explanation, mandatory flag), made when the attempt starts. `selected_index` and `is_correct` are filled in on submit. Editing or deleting a question later never changes past attempts. Readable only once the attempt is completed, because the rows contain the correct answers.

**`certificates`**: issued by the database, never by the app.

| Column | Notes |
|---|---|
| `certificate_number` | `MXO-<year>-<6 digits>`, from a global sequence that never resets |
| `recipient_name`, `course_title`, `course_code` | Copied at issue time, so later renames don't change the certificate |
| `attempt_id` or `reading_session_id` | What earned it |
| `issued_at`, `expires_at` | `expires_at` is always `issued_at + 2 years` (trigger). Shown only; compliance ignores it. |

One certificate per person per course (unique). Read your own (reports read all). No one can insert, edit or delete through the API.

**`attempt_unlocks`**: an admin's approval for three more attempts (`user_id`, `course_id`, `granted_by`, `granted_at`). Admins insert; read your own (reports read all).

### Groups and assignments

**`groups`**: central training groups such as *Titan Distributors*. Unique `name`, `description`, `created_by`. Readable by admins and by the group's members. Admin-only writes.

**`group_members`**: (`group_id`, `user_id`), with `added_by`. A person can be in many groups. Members can see their own memberships; admins see all.

**`course_assignments`**: makes a course required. Exactly one of `group_id` or `user_id` is set. Unique per course and target. Admin-only writes; people can see assignments that apply to them.

**`view_groups`** and **`view_group_members`**: private watchlists. Only the owner can see or change them (not even a super admin can see someone else's), and only managers and admins can create them. They never affect what anyone must complete.

### Audit

**`audit_log`**: append-only (`prevent_audit_log_changes` raises on update and delete). Written only by triggers. Admins can read it; managers can't.

| Logged | Action names |
|---|---|
| Courses created, changed, deleted, archived, restored | `course.insert`, `course.update` (with a from/to diff of changed columns), `course.delete`, `course.archived`, `course.unarchived` |
| Decks added or removed | `course_materials.insert`, `course_materials.delete` |
| Training groups, members, assignments | `group.*`, `group_member.*`, `course_assignment.*` |
| Role changes | `profile.role_changed` |
| Attempts approved | `attempt_unlocks.insert` |

Not logged: question edits, deck renames and reorders, certificates, watchlists, sign-ups and non-role profile edits. Each row stores `actor_id` and `actor_name` at the time.

Only course History (on the course Overview page, last 50 entries) shows the log in the app. Group, membership and role entries are recorded but no screen shows them yet; query the table directly.

## Database functions

Called by the app with `.rpc()`:

| Function | Returns | Used by |
|---|---|---|
| `start_reading(p_course_id)` | Reuses the person's unfinished reading session or starts one, and picks up to 3 random checkpoint questions for it the first time. Returns `{ session_id, questions }`, the questions **without answers**, each with `answered`. | Course card, Reader |
| `answer_reading_question(p_session_id, p_question_id, p_selected_index)` | `{ correct, explanation }`. Records a correct answer. Doesn't reveal the right option. | Reader |
| `finish_reading(p_session_id)` | Marks the reading finished, once every checkpoint is answered and `read_seconds` have passed since `started_at` (5 s grace). Returns `{ certificate_id }` (reading-only courses get one). | Reader |
| `start_attempt(p_course_id)` | Needs a finished reading and an attempt left. Resumes the in-progress attempt, or starts one. The set is every active mandatory main-test question, topped up with random optional ones to `max(5, round(mandatory ÷ 0.6))`, in random order. Returns `{ attempt_id, attempts_left, questions }`, the questions **without answers** (`attempt_id` is null when the course has no questions). | Quiz |
| `submit_attempt(p_attempt_id, p_answers)` | `p_answers` maps each attempt question id to the chosen option index, and every question needs a valid answer. Grades, completes the attempt and returns the score, pass/fail, counts, `attempts_left`, `certificate_id` and the questions with correct answers and explanations. | Quiz |
| `required_courses()` | `(user_id, course_id)` pairs everyone must complete: direct and group assignments combined, active unarchived courses only. Reports get everyone; others get only their own rows. Lets managers see accurate compliance without seeing groups. | Courses, Dashboard, Profile |

Used inside the database:

| Function | Does |
|---|---|
| `attempts_remaining(user, course)` | `3 − failed attempts` since the later of the last pass and the last admin approval (never below 0). Used by `start_attempt`, `submit_attempt` and the out-of-attempts email. `lib/attempts.js` mirrors it for the UI. |
| `issue_certificate(attempt)` | Issues a certificate for a passed, completed attempt unless one exists |
| `current_learner()`, `open_course(course)`, `reading_session_payload(session)` | Helpers for the reading and assessment functions: the signed-in user, the course if it can be worked on (visible, or an admin previewing, and not archived), and a session's questions without answers |
| `is_admin()`, `is_super_admin()`, `can_view_reports()` | Role checks for policies |
| `alert_setting`, `send_admin_alert`, `alert_profile_link`, `alert_html` | Admin email alerts; see [Operations](operations.md#admin-email-alerts) |

The reading and assessment functions are `security definer`: they run with the owner's rights, which is how they write records learners can't write themselves. Each one checks who is calling and that the session or attempt is theirs. See [Security](security.md).

## Triggers

| Table | Trigger | Does |
|---|---|---|
| `auth.users` | `on_auth_user_created` | Creates the profile as `learner` |
| `auth.users` | `on_auth_user_email_changed` | Copies the new email to the profile |
| `profiles` | `prevent_profile_privilege_escalation` | Enforces who may change roles |
| `profiles` | `audit_profiles` | Logs role changes |
| `profiles` | `alert_new_signup` | Emails admins "New sign-up: <name>" |
| `courses` | `stamp_course_archive` | Sets `archived_at`/`archived_by` from the server and real user |
| `courses`, `course_materials`, `groups`, `group_members`, `course_assignments`, `attempt_unlocks` | `audit_*` | Writes `audit_log` |
| `groups`, `group_members`, `course_assignments` | `stamp_actor` | Forces `created_by` / `added_by` / `assigned_by` to the real user |
| `questions` | `check_question_material` | A reading question's deck must belong to the same course |
| `quiz_attempts` | `issue_certificate_on_pass` | Issues the certificate on a passed, completed attempt |
| `quiz_attempts` | `alert_attempts_exhausted_on_submit` (and `alert_attempts_exhausted` for directly inserted attempts) | Emails admins "Out of attempts: <name> · <course>" when a failed attempt uses the last one |
| `reading_sessions` | `protect_reading_started_at` | Server-set start time that can't be changed later |
| `reading_sessions` | `issue_reading_certificate` | Reading-only courses: when the reading is marked finished, checks the course isn't archived and that `read_seconds` have passed since `started_at` (5 s grace), then issues the certificate |
| `certificates` | `set_certificate_expiry` | `expires_at = issued_at + 2 years` |
| `audit_log` | `prevent_audit_log_changes` | Refuses updates and deletes |

## What deletes do

- **Course** (super admin only): removes its decks, questions and assignments. Refused if it has any reading sessions, attempts, certificates or attempt approvals: archive it instead.
- **Person** (only possible from Supabase, not the app): refused if they have any training records, or ever archived a course.
- **Training group**: removes its memberships and group assignments. Nobody's records are touched.
- **Deck**: removes its reading questions. Past attempts are unaffected.
- **Question**: past attempts keep their snapshot copy.

## Storage

| Bucket | Public | Limit | Types | Path |
|---|---|---|---|---|
| `course-pdfs` | Yes | 50 MB | PDF | `{course code lowercase}/{uuid}-{file name}` |
| `question-images` | Yes | 5 MB | JPEG, PNG, WebP, GIF | `{course id}/{uuid}.{ext}` |

Anyone with a file's URL can read it. Only admins can upload, list or delete through the API. AI suggestions depend on `course-pdfs` staying public (OpenRouter fetches the PDF by URL).

## Changing the schema

Add a numbered migration `supabase/migrations/NNN_name.sql` with a matching `NNN_name.undo.sql`, update the list in [setup.md](setup.md), and add access-rule tests in `supabase/tests/access-rules.mjs` for any new policy. See [Operations](operations.md#database-changes).
