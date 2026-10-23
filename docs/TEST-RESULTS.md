# Test results

**Runs:** 2026-10-19 (super admin) and 2026-10-22 (admin, manager, learner) · branch `overhaul` · local dev server against the dev Supabase project
**Signed in as:** Het Patel Maxx (super admin), Het Patel 2 (admin), John Doe (manager), Jane Smith (learner), in the Claude desktop in-app browser. The A cases were run by hand by Het.
**Test cases:** [TESTING.md](TESTING.md)

## Summary

| | Result |
|---|---|
| Logic tests (`npm test`) | ✅ 19 / 19 |
| Database access tests (`npm run test:db`) | ✅ 9 / 9 groups, 50+ checks, no data left behind |
| Production build (`npm run build`) | ✅ |
| Browser test cases run | ✅ 47 passed · 0 failed (all cases) |

All throwaway test data (the courses `QA-TEST` and `QA-ARCHIVED`, the training groups "QA test group" and "QA learner group", the watchlist and every assignment) was deleted afterwards. Each change was recorded in the audit log. Jane Smith's passed DEMO-101 attempt from E2 was kept, because attempts are training records and can't be deleted.

## Browser results

| ID | Result | Notes |
|---|---|---|
| A1 | ✅ | Lands on Courses; profile menu shows "Learner" |
| A2 | ✅ | Redirected to Courses; no Admin link in the top bar |
| A3 | ✅ | Tabs: Dashboard, People, Insights only |
| A4 | ✅ | Super admin sees Dashboard, People, Training groups, Courses, Insights |
| A5 | ✅ | 	Saves; "Super admin" isn't offered |
| A6 | ✅ | Admin's profile offers Learner / Manager / Admin / Super admin |
| A7 | ✅ | No role editor on your own profile |
| B1 | ✅ | Checked by Het: with a PDF attached and 2 reading / 4 main, the form blocks creation ("Value must be greater than or equal to 3") |
| B2 | ✅ | Created a course without a PDF; landed on its Questions tab |
| B3 | ✅ | 0 reading / 2 main generated 2 suggestions in about 2 minutes (no True/False required); not added |
| B4 | ✅ | Generate button disabled at 0 / 0 |
| B5 | ✅ | Title and passing score saved; History shows "Updated title, passing score" |
| B6 | ✅ | Archived; list shows "Archived Oct 19, 2026 by Het Patel Maxx"; History shows "Archived the course" |
| B7 | ✅ | Details, assignments and Questions read-only while archived |
| B8 | ✅ | As Jane: archived `QA-ARCHIVED` isn't listed; its read and quiz links both show "This course has been archived and can no longer be started" |
| B9 | ✅ | Restored; History shows "Restored the course from the archive" |
| B10 | ✅ | As Het Patel 2 (admin): no Delete course section, even on an empty course |
| B11 | ✅ | FPKT (35 records): Delete disabled with "archive it instead" |
| B12 | ✅ | Deleted the empty test course after typing its code |
| B13 | ✅ | `/admin/questions?course=…` redirects to the course's Questions tab |
| C1 | ✅ | Created "QA test group" |
| C2 | ✅ | Search "het" matched 4 people (including by email) |
| C3 | ✅ | Added 4 at once |
| C4 | ✅ | Pasted a real email (in capitals) and a fake one: the real one matched, the fake one was reported |
| C5 | ✅ | "Select all 4" |
| C6 | ✅ | Removed a member |
| C7 | ✅ | Assigned 2 courses; Dashboard counts matched the real attempts (John Doe 1/2: passed DEMO-101) |
| C8 | ✅ | Course page: assigned a training group and one person; both appear in History |
| C9 | ✅ | Profile lists each course with its source; a hidden course is correctly not required |
| C10 | ✅ | One-off course on a profile: 1/2 → 2/3; removing it went back to 1/2 |
| C11 | ✅ | Deleted the group; its memberships and assignments were removed and audited |
| D1 | ✅ | Everyone + training-group cards; completed / assigned per person |
| D2 | ✅ | Clicking a group card filters the table |
| D3 | ✅ | Status buttons filter correctly |
| D4 | ✅ | Search by email ("hettrips") finds John Doe |
| D5 | ✅ | As manager: downloaded `compliance-everyone-2026-10-23.csv` with 6 rows and the right completed/assigned/status values |
| D6 | ✅ | As John (manager): only the Everyone card; no training groups in cards, filter or table; tabs Dashboard, People, Insights; admin-only URLs redirect to Courses |
| D7 | ✅ | Created a watchlist from the Dashboard; editor opened inline |
| D8 | ✅ | Added a person; pill showed 0/1 and filtered the table |
| D9 | ✅ | Clicking the pill again shows everyone |
| D10 | ✅ | Renamed, then deleted |
| D11 | ✅ | Het Patel 2's watchlists ("Test list", "Test list 2") aren't visible to John |
| D12 | ✅ | As John: Jane's profile shows her required course and status, but no training-group name, role editor, pickers or remove buttons |
| E1 | ✅ | As Jane: DEMO-101 under Required courses (0 of 1); other live courses under Other available courses; archived course absent |
| E2 | ✅ | Started DEMO-101, passed 3 page checkpoints, waited out the 30 s reading time, then passed the quiz (7/7, 4/4 mandatory). Courses page shows "1 of 1 complete · Passed 100%" |
| E3 | ✅ | Own profile: "Compliant", training group listed, nothing editable; other people's profiles and `/admin` redirect back |
| F1 | ✅ | Dashboard, Training groups and a course page at 375 px wide: no sideways scrolling |

**How the confirmation pop-ups were handled:** the in-app browser automatically dismisses the browser's "Are you sure?" pop-ups. For archive, restore, delete and watchlist delete, the page was made to answer "OK" (and to type the course code for course delete), which is what a person would do. The pop-up wording was checked.

## Fixed during this run

- Picker checkboxes, "Remove" buttons and Dashboard cards had no accessible names for screen readers. They now read like "John Doe (hettrips@gmail.com)", "Remove John Doe" and "Titan Distributors: 3 of 5 compliant".

## Observations (not fixed)

1. **Group cards count a member's whole compliance**, not just that group's courses. Example: Maxx Employees has no courses of its own but showed "0/1" because its one member had courses from another group. This is consistent ("how compliant are the people in this group?"), but it may be read the other way.
2. **The watchlist editor stays open** after you click the pill to show everyone again. It's harmless, but closing it at the same time may feel tidier.
3. **Phone-width top bar** (existing before this work): the logo crowds the Courses / Admin switcher at 375 px.
4. **AI suggestions take about 2 minutes** on the free OpenRouter model. See issue #7 for moving off OpenRouter.
5. **Dates are shown in UTC**, so in US evenings they read as the next day (an archive done on Oct 22 showed "Oct 23"; the CSV filename too). This avoids page-load glitches; showing local time would need a small client-side change.
6. **A manager's CSV has an empty Groups column**, because managers can't see training groups. It could be dropped from their export.
7. **DEMO-101 has a mandatory test question** ("This is one you HAVE to get right!…") that looks like leftover test content. Consider removing it before real use.
8. **The reading timer pauses while a checkpoint question is open.** This looks intentional, but learners may wonder why it stopped.

## Still to test by hand

Nothing. Every case in [TESTING.md](TESTING.md) has been run.
