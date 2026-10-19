# Test results

**Run:** 2026-10-19 · branch `overhaul` · local dev server against the dev Supabase project
**Signed in as:** super admin (Het Patel Maxx), in the Claude desktop in-app browser
**Test cases:** [TESTING.md](TESTING.md)

## Summary

| | Result |
|---|---|
| Logic tests (`npm test`) | ✅ 19 / 19 |
| Database access tests (`npm run test:db`) | ✅ 9 / 9 groups, 50+ checks, no data left behind |
| Production build (`npm run build`) | ✅ |
| Browser test cases run | ✅ 35 passed · 0 failed |
| Browser test cases not run | ⏭ 13 (need a learner, manager or admin sign-in, a PDF upload, or a file download) |

All throwaway test data (the course `QA-TEST`, the training group "QA test group", the watchlist and every assignment) was deleted afterwards. Each change was recorded in the audit log.

## Browser results

| ID | Result | Notes |
|---|---|---|
| A1 | ⏭ | Needs a new sign-up |
| A2 | ⏭ | Needs a learner sign-in |
| A3 | ⏭ | Needs a manager sign-in (layout also covered by the manager preview with sample data) |
| A4 | ✅ | Super admin sees Dashboard, People, Training groups, Courses, Insights |
| A5 | ⏭ | Needs an admin sign-in |
| A6 | ✅ | Admin's profile offers Learner / Manager / Admin / Super admin |
| A7 | ✅ | No role editor on your own profile |
| B1 | ⏭ | Needs a PDF upload (the in-app browser can't pick files) |
| B2 | ✅ | Created a course without a PDF; landed on its Questions tab |
| B3 | ✅ | 0 reading / 2 main generated 2 suggestions in about 2 minutes (no True/False required); not added |
| B4 | ✅ | Generate button disabled at 0 / 0 |
| B5 | ✅ | Title and passing score saved; History shows "Updated title, passing score" |
| B6 | ✅ | Archived; list shows "Archived Oct 19, 2026 by Het Patel Maxx"; History shows "Archived the course" |
| B7 | ✅ | Details, assignments and Questions read-only while archived |
| B8 | ⏭ | Needs a learner sign-in |
| B9 | ✅ | Restored; History shows "Restored the course from the archive" |
| B10 | ⏭ | Needs an admin sign-in (the database test confirms admins can't delete) |
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
| D5 | ⏭ | CSV download not clicked (downloads need your go-ahead); CSV content is covered by a logic test |
| D6 | ⏭ | Needs a manager sign-in |
| D7 | ✅ | Created a watchlist from the Dashboard; editor opened inline |
| D8 | ✅ | Added a person; pill showed 0/1 and filtered the table |
| D9 | ✅ | Clicking the pill again shows everyone |
| D10 | ✅ | Renamed, then deleted |
| D11 | ⏭ | Needs two different sign-ins (the database test confirms watchlists are private) |
| D12 | ⏭ | Needs a manager sign-in |
| E1–E3 | ⏭ | Needs a learner sign-in |
| F1 | ✅ | Dashboard, Training groups and a course page at 375 px wide: no sideways scrolling |

**How the confirmation pop-ups were handled:** the in-app browser automatically dismisses the browser's "Are you sure?" pop-ups. For archive, restore, delete and watchlist delete, the page was made to answer "OK" (and to type the course code for course delete), which is what a person would do. The pop-up wording was checked.

## Fixed during this run

- Picker checkboxes, "Remove" buttons and Dashboard cards had no accessible names for screen readers. They now read like "John Doe (hettrips@gmail.com)", "Remove John Doe" and "Titan Distributors: 3 of 5 compliant".

## Observations (not fixed)

1. **Group cards count a member's whole compliance**, not just that group's courses. Example: Maxx Employees has no courses of its own but showed "0/1" because its one member had courses from another group. This is consistent ("how compliant are the people in this group?"), but it may be read the other way.
2. **The watchlist editor stays open** after you click the pill to show everyone again. It's harmless, but closing it at the same time may feel tidier.
3. **Phone-width top bar** (existing before this work): the logo crowds the Courses / Admin switcher at 375 px.
4. **AI suggestions take about 2 minutes** on the free OpenRouter model. See issue #7 for moving off OpenRouter.

## Still to test by hand

A1, A2, A3, A5, B1, B8, B10, D5, D6, D11, D12, E1–E3. These need sign-ins as other roles, a PDF upload or a file download. Steps are in [TESTING.md](TESTING.md).
