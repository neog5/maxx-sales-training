# Testing

How the training portal is tested: what runs automatically, and the manual test cases to walk through before a release.

## Automated tests

| Command | What it checks | Needs |
|---|---|---|
| `npm test` | Logic tests: grading, compliance status, role permissions, question-suggestion validation, CSV export | Nothing |
| `npm run test:db` | Database access rules, run as real signed-in learner / manager / admin / super admin users | `SUPABASE_DB_URL` in `.env.local` |
| `npm run build` | The app compiles | `.env.local` |
| `npm run check` | `npm test` + `npm run build` | `.env.local` |

`npm run test:db` creates its own test users and courses inside one database transaction and always rolls it back, so it leaves nothing behind. It covers:

- New sign-ups become learners, with their email copied to the profile.
- Only admins change roles; only super admins grant or remove super admin.
- Learners see only themselves; managers read everyone's records but can't edit anything.
- Archiving stamps the real actor (it can't be forged), blocks new reading sessions and quiz attempts, and is written to the audit log.
- Admins can't delete courses; super admins can, but only courses with no training records. People with records can't be deleted.
- The audit log is append-only and readable only by admins.
- Training groups and assignments are admin-only; each assignment targets exactly one group or person; the actor is stamped.
- Managers can't see training groups or how courses are assigned, but get accurate required courses through `required_courses()`.
- Watchlists are private to their creator; nobody else, not even a super admin, can see or change them.

## Manual test cases

Run against the dev site or `npm run dev`. You need four accounts, one per role: **super admin**, **admin**, **manager**, **learner**. Set roles from each person's profile page (signed in as the super admin).

Result key: ✅ pass · ❌ fail · ⏭ not run.

### A. Sign-in and roles

| ID | As | Steps | Expected |
|---|---|---|---|
| A1 | New user | Sign up with a new email | Lands on Courses; profile menu shows "Learner" |
| A2 | Learner | Open `/admin` | Redirected to Courses; no Admin link in the top bar |
| A3 | Manager | Open the top-bar "Team" link | Tabs: Dashboard, People, Insights only |
| A4 | Admin | Open Admin | Tabs: Dashboard, People, Training groups, Courses, Insights |
| A5 | Admin | Open a learner's profile → change role to Manager | Saves; "Super admin" isn't offered |
| A6 | Super admin | Open an admin's profile → role options | "Super admin" is offered |
| A7 | Any | Open your own profile | No role editor for yourself |

### B. Courses

| ID | As | Steps | Expected |
|---|---|---|---|
| B1 | Admin | Courses → Add course; attach a PDF; set suggestions to 2 reading / 4 main | Blocked: a new course needs 3–10 reading and 5–30 main |
| B2 | Admin | Same with 3 reading / 5 main | Course created; lands on the course's Questions tab and suggestions start |
| B3 | Admin | Questions tab → "Generate" with 0 reading / 2 main | Allowed; 2 suggestions appear (no True/False required) |
| B4 | Admin | Questions tab → set both counts to 0 | Generate button is disabled |
| B5 | Admin | Overview → edit title, passing score, "Visible to learners" → Save | Saved; History shows "Updated title, passing score, visibility" |
| B6 | Admin | Overview → Archive course → confirm | Course moves to "Archived courses" with "by <you>" and date; History shows "Archived the course" |
| B7 | Admin | Open the archived course | Details, assignments and Questions are read-only; Restore is offered |
| B8 | Learner | Open the archived course's read/quiz URL directly | "This course has been archived" page; past results still on profile |
| B9 | Admin | Restore the course | Back under current courses; learners see it again |
| B10 | Admin | Look for "Delete course" | Not shown (super admin only) |
| B11 | Super admin | Delete a course with attempts | Button disabled: "has training records… archive it instead" |
| B12 | Super admin | Delete a brand-new course with no records; type the code | Deleted; gone from the list |
| B13 | Admin | Old link `/admin/questions?course=<id>` | Redirects to that course's Questions tab |

### C. Training groups and assignments

| ID | As | Steps | Expected |
|---|---|---|---|
| C1 | Admin | Training groups → create "Test group" | Appears in the list, selected |
| C2 | Admin | Add people: type part of a name | Matching people listed with emails |
| C3 | Admin | Tick 3 people → "Add 3" | All three appear under Members |
| C4 | Admin | "Or paste a list of emails" → paste 2 real emails + 1 fake | The 2 are selected; the fake is reported as not found |
| C5 | Admin | Search for a word that matches many people → "Select all N" | All matches selected |
| C6 | Admin | Remove one member | Removed from the list |
| C7 | Admin | Assign 2 courses to the group | Both chips show; the group card on the Dashboard counts them |
| C8 | Admin | Course Overview → assign a training group and one individual person | Both show under "Who must complete this course" |
| C9 | Admin | Profile of a member → Required training | Lists the group's courses (labelled "Test group") and the individual one (labelled "Assigned individually") |
| C10 | Admin | Profile → "Assign extra courses to this person" | Course added as an individual assignment |
| C11 | Admin | Delete "Test group" | Gone; its members no longer need its courses |

### D. Dashboard and watchlists

| ID | As | Steps | Expected |
|---|---|---|---|
| D1 | Admin | Open Dashboard | Cards: Everyone + each training group with compliant/assessed counts; table shows completed/assigned per person |
| D2 | Admin | Click a training-group card | Table filters to that group; counts on the status buttons update |
| D3 | Admin | Status buttons: Not compliant / Compliant / Nothing assigned | Table filters correctly |
| D4 | Admin | Search by name, then by email | Both find the person |
| D5 | Admin | Export CSV | File downloads with Name, Role, Groups, Completed, Assigned, Status for the filtered rows |
| D6 | Manager | Dashboard | Only the "Everyone" card; no training groups anywhere; no Groups column |
| D7 | Manager | ☆ Watchlists → "+ Create a watchlist…" → name "My team" | Pill appears, selected; editor opens below |
| D8 | Manager | Editor → add people (search and paste) | Pill count updates; table filters to them |
| D9 | Manager | Click the pill again | Back to everyone |
| D10 | Manager | ✎ → rename, then Delete | Renamed, then removed |
| D11 | Admin | Look at the Dashboard after D7 | The manager's watchlist is not visible |
| D12 | Manager | Open a learner's profile | Required courses and status shown; no training-group names; no editing |

### E. Learner experience

| ID | As | Steps | Expected |
|---|---|---|---|
| E1 | Learner | Courses page | "Required courses" lists assigned courses; other live courses under "Other available courses" |
| E2 | Learner | Start a required course → read → pass checkpoints → pass the quiz | Course shows Passed; Dashboard shows them compliant once all required courses are passed |
| E3 | Learner | Own profile | Required training with ✓ for passed courses; own training groups listed |

### F. Layout

| ID | As | Steps | Expected |
|---|---|---|---|
| F1 | Admin | Dashboard, a course page and Training groups at phone width | No sideways scrolling; group cards two per row; pickers usable |

## Results

See [TEST-RESULTS.md](TEST-RESULTS.md) for the latest run.
