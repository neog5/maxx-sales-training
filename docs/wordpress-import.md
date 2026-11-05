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

## Courses with a quiz

All questions are imported as main test questions with the placeholder explanation *"Review the course material for this topic."* The quiz draws 5 questions at random from each pool.

| Code | Course | Reading material | Questions | Status |
| --- | --- | --- | --- | --- |
| KNEE-PRIMARY-TECH | Freedom Primary Knee Technique | PDF (MXO-MP00005 R11) | 12 | Ready |
| KNEE-PARTIAL-TECH | Freedom Partial Knee Technique | PDF (MXO-MP00054 R01) | 8 | Ready |
| KNEE-REVISION-TECH | Revision Knee Surgical Technique | PDF (MXO-MP00023 R07, 5.8 MB) | 20 | Ready |
| KNEE-KNOWLEDGE | Freedom Knee Knowledge Base | Google Slides (PDF from PowerPoint) | 18 | Ready |
| KNEE-ANATOMY | Knee Anatomy and Kinematics | Google Slides (PDF from PowerPoint) | 13 (14 minus 1 duplicate) | Ready |
| HIP-ANATOMY | Hip Anatomy | Google Slides (PDF from PowerPoint) | 8 | Ready |
| HIP-KNOWLEDGE | Libertas Hip Knowledge Base | Google Slides (PDF from PowerPoint) | 8 | Ready |

The codes are proposals; change them in `scripts/wp-import/build-manifest.mjs` before the first import, since the import uses the code to match courses.

Knee Anatomy question 266 is an exact copy of question 265, so it is skipped. Hip Anatomy and Knee Anatomy also share two identical intro questions (body planes, "medial"); those stay, because they are in different courses.

## Reading-only courses (no quiz)

These had no quiz in WordPress, only a Cognito Forms acknowledgement. They are imported as reading-only courses: there is no test, and finishing the reading issues the certificate (migration 008). The descriptions are placeholders, since WordPress had none worth keeping.

| WP ID | Code | Course | Reading material | Status |
| --- | --- | --- | --- | --- |
| 348 | HIP-CUP-TECH | Libertas Acetabular Cup Surgical Technique | PDF (MXO_LH00004 R03) | Ready |
| 352 | HIP-HA-STEM-TECH | Libertas HA Uncemented Stem | PDF (MXO_LH00007 R03) | Ready |
| 356 | HIP-TR-STEM-TECH | Libertas TR Stem Surgical Technique | PDF (MXO_LH00019 R01) | Ready |
| 169 | KNEE-PCK-TECH | Freedom Primary PCK Technique | PDF (MXO-MP00067 R02) | Ready |
| 185 | TERRITORY-MAP | Sales Territory Map | Map image (15 Apr 2025), turned into a one-page PDF | Ready |
| 175 | MECH-PROPERTIES | Mechanical Properties and Wear | Google Slides | Needs slides PDF |
| 207 | COMPLAINT-HANDLING | Complaint Handling | Google Slides | Needs slides PDF |
| 180 | TRAVEL-EXPENSE | Employee Travel & Expense | Google Slides | Needs slides PDF |
| 328 | HOSPITAL-PROTOCOL | Hospital Protocol | 4 decks: Aseptic Techniques, Bloodborne Pathogens, HIPAA, OR Protocols | Needs 4 slides PDFs |
| 337 | SAFETY | Safety | 3 decks: Electrical Safety, Fire Safety, National Patient Safety Goals | Needs 3 slides PDFs |

Business Conduct Standards (WP 202) is not imported: its only lesson was the acknowledgement form, so there is nothing to read.

Any of these can become a tested course later: untick "Reading only" on its admin page and add questions (the AI suggestions feature works from its PDF).

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

The first 4 were exported from PowerPoint to PDF on 2026-11-04 and imported. The rest are for the reading-only courses above.

## Loading the courses

Multi-deck courses need migration `006_course_materials.sql`. The loader also needs the project's service-role key (Supabase → Project Settings → API), added as `SUPABASE_SERVICE_ROLE_KEY=` in the env file you pass it. Keep that key out of git.

1. `node scripts/wp-import/build-manifest.mjs` to rebuild the manifest after downloading Slides PDFs. Each course says whether it is ready.
2. `node scripts/wp-import/load.mjs .env.local` for a dry run that shows what would be added.
3. `node scripts/wp-import/load.mjs .env.local --apply` to import. Add `--only KNEE-ANATOMY` to import a single course.

Courses are created hidden from learners; check each one, then tick "Visible to learners" on its admin page. Rerunning is safe: courses are matched by code, decks by title and questions by text, and nothing that already exists is changed. Courses that are still waiting for a Slides PDF are skipped.
