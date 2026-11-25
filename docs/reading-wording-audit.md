# "Reading" wording audit (videos)

Status: **fixed** (25 Nov 2026). The decisions are at the end. The tables below are the original audit; line numbers are as they were before the fix.

## The issue

Since migration 014, a course's first step can contain PDF decks, videos, or both. The app still calls that whole step **"Reading"**. All materials are treated as "reading", and every deck as a PDF. For a video-only course this reads wrong: "Continue reading", "Reading complete", "Read the course", "Reading only".

The behaviour is right. Only the names and wording assume every material is a PDF. The one exception is the minimum time label, which is also a rule question (see the end).

Line numbers are as of commit `344847b`.

## 1. Learners see these (highest priority)

| Where | Text now | Note |
|---|---|---|
| `app/courses/CourseCard.jsx:37` | "Continue reading" (tile button) | |
| `app/courses/CourseCard.jsx:51`, `:53` | Step "Read the course" | |
| `app/courses/CourseCard.jsx:72` | Badge "Reading only" | |
| `app/courses/CourseCard.jsx:89` | "Read again" | |
| `app/courses/[id]/read/ReadingGateClient.jsx:196` | Step header "1 Reading → 2 Assessment/Certificate" | |
| `components/Skeleton.jsx:253` | Same step header in the loading skeleton | |
| `ReadingGateClient.jsx:187`, `:266` | "Reading complete" (bottom bar and tick label) | |
| `ReadingGateClient.jsx:241` | Progress card status "Reading" / "Reading complete" | |
| `ReadingGateClient.jsx:182`, `:184` | "Finish the reading [and open every video] to …" | "The reading" means PDF time, checkpoints and decks. Fine for PDFs, unclear as a step name |
| `ReadingGateClient.jsx:105` | "We couldn't start your reading session…" | |
| `ReadingGateClient.jsx:133` | "We couldn't save your reading progress…" | |
| `ReadingGateClient.jsx:173` | "Keep reading · N s left" | Only shows when there's a PDF, so fine |
| `ReadingGateClient.jsx` (below the reader) | "← Previous", "2 of 5", "Next: <title> →", "Last one" | Added 25 Nov 2026, replaces "Next video/deck: …". Neutral wording, works for decks and videos |
| `app/courses/[id]/read/ReadingProgressCard.jsx:33` | "Reading time" row | Only shows with a PDF, so fine |
| `ReadingProgressCard.jsx:34` | "Reading questions" row | PDF-only by design, so fine |
| `app/courses/[id]/read/CheckpointCard.jsx:23`, `:26`, `:90` | "Continue reading", "Reading question · …", "All reading questions answered" | PDF checkpoints only, so fine |
| `ReadingGateClient.jsx:208` | `aria-label="Course decks"` on the tab bar | Screen readers say "decks" for videos too |
| `docs/user-guide/learners.md:30–39` | "Step 1: Reading", "Read the course PDF in the portal" | |
| `docs/user-guide/README.md:14–18` | Glossary: "Reading only", "Deck" | |

## 2. Admins see these

| Where | Text now | Note |
|---|---|---|
| `app/admin/courses/new/CourseFormClient.jsx:166` | "Reading only: no test, the certificate is issued when the reading is finished" | |
| `app/admin/courses/page.js:51` | "Reading only" in the course list | |
| `CourseFormClient.jsx:169`, `app/admin/courses/[id]/CourseAdminClient.jsx:118` | "Minimum reading time (seconds)" | Doesn't say that it's ignored for video-only courses (see the end) |
| `app/admin/courses/[id]/CourseAdminClient.jsx:139` | "Every reading session, attempt and answer is kept." | |
| `CourseAdminClient.jsx:154` | "…its questions, its assignments and its PDF decks" (delete course) | Videos are deleted too, but not mentioned |
| `app/admin/courses/[id]/CourseMaterialsClient.jsx:138` | Section title "Reading materials" | |
| `lib/audit.js:6`, `:9` | History labels "reading time", "reading only" | |
| `lib/audit.js:30–31` | "Added/Removed reading deck" | Videos already say "video" |
| `docs/user-guide/admins.md:60–76` | "Reading only", "Minimum reading time", "finishing the reading" | |

Admin wording that is correct and stays: "Reading test" questions, "reading questions" and "Reading recommendations". These are PDF checkpoint questions, and videos can't have them.

## 3. Database error messages that can reach people

| Message | Where it shows |
|---|---|
| "Finish the reading before starting the assessment" (`start_attempt`) | Quiz page, if opened too early |
| "The minimum reading time for this course is not complete yet" | Mapped to friendlier text in `ReadingGateClient.jsx:131` |
| "This video is not part of your reading session" | Only on a bad request |

Changing these needs a migration that redefines the functions, building on 014, 015 and later versions.

## 4. Internal names (probably leave)

These aren't shown to anyone. Renaming them means a migration, plus app and test changes, for no visible gain:

- Tables and columns: `reading_sessions`, `checkpoint_passed`, `reading_session_questions`, `reading_session_videos.watched_at`, `courses.read_seconds`, `courses.view_only`, `questions.question_type = 'reading_test'`
- Functions: `start_reading`, `finish_reading`, `mark_video_watched` (now records *opened*), `watched_videos` in its payload, `issue_reading_certificate`
- Route `/courses/[id]/read` and `routes.read`, the files `ReadingGateClient.jsx` and `ReadingProgressCard.jsx`, CSS classes `reading-*`, `deck-*` and `course-decks*`, and the variable names `readingComplete` and `readingDone`

If any of these are renamed, the route is the one people could notice, in bookmarks and links in emails.

## Decisions (25 Nov 2026)

1. **Step name: "Course material".** Course tiles say "Go through the course material" and "Continue course". The finished state is "Course material complete", and "Read again" is now "Review material". Wording that only ever applies to PDFs stays: "Keep reading", "Reading time", reading questions, and the hints shown above a PDF.
2. **"Reading only" is now "No assessment"**, for learners, admins, the history log and the guides.
3. **Minimum time.** The field is now labelled "Minimum reading time for PDF decks (seconds)". It stays visible; the admin guide says it's ignored for video-only courses.
4. **Route.** `/courses/[id]/read` is unchanged.
5. **Database messages.** Mapped in the app, no migration. "Finish the reading…" from `start_attempt` now shows "Finish the course material before starting the assessment." The other two were already replaced by app text.

Internal names (section 4) are unchanged.
