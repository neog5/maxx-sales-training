# WordPress course import

Courses are being moved from the old WordPress portal (maxxorthoportal.com, LearnDash LMS) into this app.
The export was taken on 2026-10-28 from LearnDash's REST API while signed in as an admin. Nothing in WordPress was changed.

## What WordPress had

- 18 courses, all published. Every course has 1–5 lessons and no topics.
- 130 questions, all single choice with exactly one correct answer. None have explanations or images.
- Every quiz has an 80% pass mark.
- No reading checkpoints. LearnDash has nothing equivalent, so none are imported (and none need placeholders).
- Most courses end with a Cognito Forms acknowledgement ("I have reviewed this content"). This app has no acknowledgement step.

## Working files (gitignored)

Everything downloaded lives in `tmp/wp-import/`:

| File | Contents |
| --- | --- |
| `quizzes.json` | The 7 quizzes attached to courses: 88 questions with their correct answer. Checksum-verified against the live export. |
| `files/` | The 7 PDFs hosted on WordPress and the sales territory map image, prefixed with the WordPress course ID. |
| `manifest.json` | What will be imported (built by `node scripts/wp-import/build-manifest.mjs`). |
| `review.csv` | One row per question with its correct answer, for a manual check. Opens in Excel. |

## Courses to import (have a quiz)

All questions are imported as main test questions with the placeholder explanation *"Review the course material for this topic."* The quiz draws 5 questions at random from each pool.

| Code | Course | Reading material | Questions | Status |
| --- | --- | --- | --- | --- |
| KNEE-PRIMARY-TECH | Freedom Primary Knee Technique | PDF (MXO-MP00005 R11) | 12 | Ready |
| KNEE-PARTIAL-TECH | Freedom Partial Knee Technique | PDF (MXO-MP00054 R01) | 8 | Ready |
| KNEE-REVISION-TECH | Revision Knee Surgical Technique | PDF (MXO-MP00023 R07, 5.8 MB) | 20 | Ready |
| KNEE-KNOWLEDGE | Freedom Knee Knowledge Base | Google Slides | 18 | Needs slides PDF |
| KNEE-ANATOMY | Knee Anatomy and Kinematics | Google Slides | 13 (14 minus 1 duplicate) | Needs slides PDF |
| HIP-ANATOMY | Hip Anatomy | Google Slides | 8 | Needs slides PDF |
| HIP-KNOWLEDGE | Libertas Hip Knowledge Base | Google Slides | 8 | Needs slides PDF |

The codes are proposals; change them in `scripts/wp-import/build-manifest.mjs` before the first import, since the import uses the code to match courses.

Knee Anatomy question 266 is an exact copy of question 265, so it is skipped. Hip Anatomy and Knee Anatomy also share two identical intro questions (body planes, "medial"); those stay, because they are in different courses.

## Courses not imported yet (no quiz)

These need test questions before they can be imported, because a course can only be passed through its test.

| WP ID | Course | Reading material | WordPress completion |
| --- | --- | --- | --- |
| 348 | Libertas Acetabular Cup Surgical Technique | PDF (MXO_LH00004 R03) — downloaded | Cognito form 371 |
| 352 | Libertas HA Uncemented Stem | PDF (MXO_LH00007 R03) — downloaded | Cognito form 372 |
| 356 | Libertas TR Stem Surgical Technique | PDF (MXO_LH00019 R01) — downloaded | Cognito form 373 |
| 169 | Primary PCK Tech | PDF (MXO-MP00067 R02) — downloaded | Cognito form 346 |
| 175 | Mechanical Properties and Wear | Google Slides | Cognito form 347 |
| 207 | Complaint Handling | Google Slides | Cognito form 351 |
| 180 | Employee Travel & Expense | Google Slides | Cognito form 348 |
| 328 | Hospital Protocol | 4 Google Slides decks: Aseptic Techniques, Bloodborne Pathogens, HIPAA, OR Protocols | Cognito form 365 |
| 337 | Safety | 3 Google Slides decks: Electrical Safety, Fire Safety, National Patient Safety Goals | Cognito form 366 |
| 185 | Sales Territory Map | One image (map dated 15 Apr 2025) — downloaded | Cognito form 349 |
| 202 | Business Conduct Standards | None. The lesson is only the acknowledgement form. | Cognito form 350 |

The 4 PDF courses can get draft questions from the existing AI suggestions feature once they are created in the app.

## Not imported

9 LearnDash quizzes are not attached to any course: "Basic Science" (4 quizzes, 2 questions in total), two leftover copies of the Knee Anatomy quiz (14 questions each), "Primary Knee Tech Quiz" (empty), and two one-question acknowledgements (Smart Sheet Process, Surgeon Database With Hospital). Learner progress and completions are not imported either.

## Google Slides to download

Published Slides links can't be exported to PDF, so each deck has to be downloaded from Google Drive (open the deck, **File → Download → PDF**). Save each one into `tmp/wp-import/files/` with the name shown.

| Save as | Deck (published link) |
| --- | --- |
| `165-freedom-knee-knowledge-base.pdf` | [Freedom Knee Knowledge Base](https://docs.google.com/presentation/d/e/2PACX-1vTe0pu3cyZx0nJQ8XXx48fs76LmSFZ0mmUJ28CdIFW9R7kflMtZb_0rBysbtiGfXB7e0uZE0ll8HUB7/pub) |
| `161-knee-anatomy-and-kinematics.pdf` | [Knee Anatomy and Kinematics](https://docs.google.com/presentation/d/e/2PACX-1vSK8rC7rejVsBz0E9yFw-eYT1UgYSHvQx9gxVSUAdxp12RCdiGg6voqG9WnNz_Z2rlb8HAKPigTKNuD/pub) |
| `359-hip-anatomy.pdf` | [Hip Anatomy](https://docs.google.com/presentation/d/e/2PACX-1vQzoiBJKkUCVEk24NePUYSh7W4Lz64atMbx47C9Eesn3SEMqhZfx6J9PO5_7BW6vTQ_zQo7Fmap2ZNo/pub) |
| `379-libertas-hip-knowledge-base.pdf` | [Libertas Hip Knowledge Base](https://docs.google.com/presentation/d/e/2PACX-1vSzkZ7gqwAGkgDcmRyRQuGyN8vc5D05GeB3hGsLems0NpaS6semyddGwnbD8U3hlFq5JF03E4vTHJ9H/pub) |
| `175-mechanical-properties.pdf` | [Mechanical Properties and Wear](https://docs.google.com/presentation/d/e/2PACX-1vTiw6cf68duu0CKzQl1R8HS_j7eBBatZiLPvCZwT6rsvailU8IkNPPiQdLrV3DzMa8eZKw-yfu9uQh7/pub) |
| `207-complaint-handling.pdf` | [Complaint Handling](https://docs.google.com/presentation/d/e/2PACX-1vQu84aHJ8hXj3MEWDu8AS8XBUWhONUlc6UVhCBLs_1pvU-H1onGfIz8zYvgg0NNRNqvF8kMMN6Srz2L/pub) |
| `180-employee-travel-expense.pdf` | [Employee Travel & Expense](https://docs.google.com/presentation/d/e/2PACX-1vR27TI9K0rAA4UnN-2GaiMAcr2vbCpecqablJ7nkJFhrA1nq6LStxKKzqHaFVMEoJp-PjeoBEUN36Ry/pub) |
| `328-1-aseptic-techniques.pdf` | [Aseptic Techniques](https://docs.google.com/presentation/d/e/2PACX-1vSIc21bwI6lpfwWmJMT9o6AtnHtFzvPabMbI5z8-tW0UAkJIH7vyYjj-AihxdsiXBdt03a2xXvvk3wM/pub) |
| `328-2-bloodborne-pathogens.pdf` | [Bloodborne Pathogens](https://docs.google.com/presentation/d/e/2PACX-1vTGl258ccrF5fWGeUz1rMbz9wB5ogRfa5zRskCXVbHkTBJx3LiVKYVTsczq0VyePWWZnKNpgtJEnPDo/pub) |
| `328-3-hipaa.pdf` | [HIPAA](https://docs.google.com/presentation/d/e/2PACX-1vT3eKUoU44Fi7JNxRXWs8Vpphj5ZnZSSsQK6RuLwnRzy40qmqQCSf6XVlTA0CpjiAvXofm7Pa2F0_Y9/pub) |
| `328-4-or-protocols.pdf` | [OR Protocols](https://docs.google.com/presentation/d/e/2PACX-1vRYkWecHVbUoIYGYmTvGL39-V_y9m6YwE9zhIcJs-BK2_QmmkqZb8hjgV6aNtXfimCp9O8K3xX9OgnP/pub) |
| `337-1-electrical-safety.pdf` | [Electrical Safety](https://docs.google.com/presentation/d/e/2PACX-1vRRzp-7YftZScu8DJbtLz_WcFrmhCfbBfRfHieY4AgTM-gyKuADejmgoBbK-ESQ_zQhNCoXZK9bkb8b/pub) |
| `337-2-fire-safety.pdf` | [Fire Safety](https://docs.google.com/presentation/d/e/2PACX-1vSpHM2FSSlPXosa8XnLtpo1QjMtJUjUT3znHs3Kdl6OkglGtWr3ROparydGytNbRmLn0BgxuBUkWzVW/pub) |
| `337-3-national-patient-safety-goals.pdf` | [National Patient Safety Goals](https://docs.google.com/presentation/d/e/2PACX-1vQkheDCG_fS9eC0L6a5d9GpT4izzJNIVRlAHt9qo_fC_4VEGniGpcElGloPIkOl4fnbHdKGp_2G6U6L/pub) |

The first 4 are needed for the courses being imported now. The rest are for the courses parked above.

## Loading the courses

Multi-deck courses need migration `006_course_materials.sql`. The loader also needs the project's service-role key (Supabase → Project Settings → API), added as `SUPABASE_SERVICE_ROLE_KEY=` in the env file you pass it. Keep that key out of git.

1. `node scripts/wp-import/build-manifest.mjs` to rebuild the manifest after downloading Slides PDFs. Each course says whether it is ready.
2. `node scripts/wp-import/load.mjs .env.local` for a dry run that shows what would be added.
3. `node scripts/wp-import/load.mjs .env.local --apply` to import. Add `--only KNEE-ANATOMY` to import a single course.

Courses are created hidden from learners; check each one, then tick "Visible to learners" on its admin page. Rerunning is safe: courses are matched by code, decks by title and questions by text, and nothing that already exists is changed. Courses that are still waiting for a Slides PDF are skipped.
