# Video course materials: plan

Status: **built** on `dev` (24 Nov 2026), migration 014 applied to the dev database. Prod still needs the 2 GB global upload limit and migration 014. Decisions below were agreed 12–24 Nov 2026.

Courses can use videos as reading material alongside PDF decks or instead of them.

## Decisions

| Topic | Decision |
|---|---|
| Hosting (now) | **Supabase Storage** (Pro plan), in a new **private** `course-videos` bucket. Videos are plain MP4 files played with the browser's own player. Learners get short-lived signed links, and the storage rules reuse the same admin and course-visibility checks as the rest of the app. No second provider, extra keys or CORS setup are needed. |
| Hosting (later) | **Cloudflare Stream** if we need quality that adapts to the connection or automatic captions. The app keeps the video source behind one helper, so a move only affects uploads and playback links. |
| Ruled out | **Cloudflare R2**: worked, but it's a second provider now that Supabase is paid. **Microsoft 365 / Stream on SharePoint**: viewers must be signed in to our M365 tenant, and there's no player API to tell when a video has been watched to the end. **YouTube unlisted**: anyone with the link can watch. **Google Drive**: no player API. |
| Course makeup | A course can have any mix of materials: PDFs only, videos only, or both, in the admin-set order. |
| Checkpoints | **None for videos.** Reading checkpoint questions stay PDF-only. Admins can't add a reading question to a video, and the database blocks it. Main test questions are unaffected: they belong to the course, not to a material. |
| Skipping | **Allowed**, both forward and back, so learners don't have to rewatch sections. |
| Minimum time | **None for videos.** A video counts as watched once the learner reaches the end, whether by playing or skipping. PDFs keep their minimum reading time. A course mixing PDFs and videos needs the PDFs' time plus every video watched. |
| Captions | **Not built yet.** Possible later: an admin attaches a `.vtt` file, or captions come automatically with Stream. |
| Certificates | Every video reached to the end, plus the existing PDF rules (checkpoints answered and minimum time met) if the course has PDFs. Tested courses still need the main test passed. |
| AI question suggestions | **Not available for videos for now**, including main test questions. See below. |

## Upload rules for MP4s

- MP4 with H.264 video and AAC audio, and the "fast start" option on so playback can begin before the whole file downloads. HandBrake's "Web" presets do all three.
- Recommended 720p, to keep files small and playback smooth on phones and hospital Wi-Fi.
- The app checks the file type and size before upload. The cap is 2 GB per file.
- Uploads use Supabase's resumable upload, so a dropped connection doesn't restart a large file.

## Deferred: AI question suggestions for videos

The suggestions feature currently sends the PDF to OpenRouter and asks for questions tied to page numbers (`lib/question-suggestions.js`). For videos we don't know yet whether transcripts are available, so for now:

- Only PDF materials can be picked in the suggestions launcher. For a video-only course the launcher is turned off with a short note, and admins write main test questions by hand.
- The API route rejects video materials.

**When the AI provider changes**, revisit this. Options:
1. Send the captions/transcript text and ask for main test questions. This is cheap, but misses anything that's only shown on screen.
2. Use a model that accepts video input directly. This covers on-screen content such as surgical steps.
3. Use both: the transcript plus frames sampled at intervals.

## Build steps

1. **Storage setup.** In the Supabase dashboard (Storage settings), raise the project's global file size limit to at least 2 GB. This is a one-time step per project: **done for the current project (24 Nov 2026); still needed for prod.** It requires the Owner or Administrator role in the Supabase organisation. A migration then creates the private `course-videos` bucket (2 GB limit, `video/mp4` only) and its storage rules: admins can upload and delete; signed-in people who aren't archived can read, as with course PDFs.
2. **Schema migration.** Add the following to `course_materials`:
   - `kind` (`pdf` | `video`, default `pdf`)
   - `video_path` (the object path in `course-videos`)
   - `duration_seconds`

   Make `pdf_url` nullable, with a check constraint that each row has the field its kind needs. Extend the existing `check_question_material` trigger so a reading question can only point at a PDF material. Write an undo file.
3. **Upload and playback.**
   - Admins upload straight from the browser to Supabase Storage with a resumable upload. The file never goes through our server.
   - The reading page creates a signed playback link valid for a few hours. The bucket's read rule only allows it for learners who can see the course.
4. **Server-side completion.** The reading session records each video the learner reaches the end of. `finish_reading` requires every video to be reached to the end. The minimum-time check counts only PDF materials, so a video-only course has no time requirement.
5. **Learner player.** Build a `VideoReader` next to `PdfReader`, using the browser's `<video>` player. It:
   - reports the furthest second reached, and when the learner reaches the end
   - offers speeds up to 2×
6. **Admin.** The materials list gets "Add video" next to "Add PDF". The upload reads the duration in the browser before saving and shows a progress bar. The question editor's material picker lists PDFs only.
7. **Cleanup.** Deleting a video material deletes its video file, as decks do now.
8. **Docs and tests.** Update the data model, features, security and user-guide docs. Add access-rule tests for the new columns and unit tests for the video-completion logic.

## Cost

- **Supabase Pro** (Nov 2026): includes 100 GB of file storage, then about $0.021 per GB per month. That's roughly 150 hours of 720p video. Data sent to viewers (egress) includes 250 GB uncached plus 250 GB cached, then $0.09 per GB uncached or $0.03 per GB cached.
- **Usage estimate:** 720p runs about 0.7 GB per hour watched. For example, 10 hours of video watched once by 50 reps comes to about 350 GB, so roughly $0–10 over the included amount. The egress allowance is shared with the database and the rest of the project, so watch the usage page after launch.
- **Cloudflare Stream (later):** about $5 per 1,000 minutes stored and $1 per 1,000 minutes watched (Nov 2026).
