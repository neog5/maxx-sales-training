# Guide for admins

Admins run the training: courses, questions, who can see and has to do what, and helping people who get stuck. You can also take courses yourself; everything in the [learner guide](learners.md) applies to you too.

Click **Admin** in the top bar. The tabs are **Dashboard**, **People**, **Training groups**, **Courses** and **Insights**.

## Dashboard

Shows who has completed their required training.

- The **Everyone** card shows how many people are compliant out of those with training assigned, and there is a card per training group.
- The table lists each person with **Completed** (courses passed out of courses required) and **Status**:
  - **Compliant**: every required course passed;
  - **Not compliant**: something outstanding (the courses are listed under the status);
  - **Nothing assigned**: no required courses.
- Narrow it down with the search box (name or email), the group menu, and the status buttons.
- **Export CSV** downloads exactly the rows you're looking at.

### Watchlists

Watchlists let you follow a team, such as "My team". Only you can see them, and they don't change what anyone can see or has to complete.

1. On the Dashboard, under **☆ Watchlists**, click **+ Create a watchlist…** and give it a name.
2. Add people by searching their name or email, or paste a list of emails.
3. Click the watchlist to filter the Dashboard to those people. Click it again to show everyone.
4. Use **✎** to rename it, change who's on it, or delete it.

## Insights

Overall numbers (people, attempts, pass rate, average score), the people with the lowest pass rates, how people do on different kinds of questions, and a log of every attempt. Click **Review** to see exactly what someone answered.

## Who can see a course

Some courses must never reach a competing distributor, so **a new course is hidden from everyone except admins** until you decide who gets it. Each course has one of three settings under **Who can see this course**:

| Setting | Who sees it |
|---|---|
| **Only the groups and people you give it to** (the default) | Admins, plus the training groups and people listed under **Given to**. Nobody else can find or open it. |
| **Everyone with an account** | Every learner, including every distributor group. You're asked to confirm before a course is opened up like this. |
| **Nobody yet (draft)** | Admins only, even if it's been given to groups. Use it while you set a course up. |

Giving a course to a group or person is either:

- **Required**: they must complete it, and it counts toward compliance;
- **Optional**: they can see and take it, but it isn't required.

For example, a Titan-only course is set to *Only the groups and people you give it to*, given to *Titan Distributors* as required, and never shows up for *Normal Distributors*.

The **Courses** list shows each course's setting in the **Who can see it** column, so a course open to everyone stands out.

## Courses

### Add a course

1. **Courses → + Add course**.
2. Fill in:
   - **Course code**, a short unique code such as `KNEE-101`;
   - **Title** and **Description**;
   - **Training PDFs**: one or more, up to 50 MB each, read in the order you add them;
   - **No assessment**: tick this for courses with no test, where finishing the course material earns the certificate;
   - **Passing score** (default 80%);
   - **Minimum reading time for PDF decks** in seconds (default 60; ignored if the course only has videos);
   - **Who can see this course** (see [above](#who-can-see-a-course); leave it on *Only the groups and people you give it to* unless the course is safe for everyone).
3. For a tested course with a PDF, choose how many questions to have AI suggest: 3–10 reading questions and 5–30 test questions. Suggestions need the first PDF to be **5 MB or smaller**; compress it if it isn't.
4. Click **Create course…**. You land on the course's **Questions** tab, and suggestions start automatically.
5. On the course's **Overview**, give it to the right training groups or people. Until you do, only admins can see it.

### Course overview

Open a course from **Courses** to manage it:

- **Course details**: change the title, description, passing score, minimum reading time and no assessment.
- **Who can see this course**: pick one of the three settings; it saves straight away. Under **Given to**, add training groups or individual people (search, or paste a list of emails). **Add new ones as** chooses whether they're added as Required or Optional, and each one has its own Required / Optional menu you can change later.
- **Course material**: add PDFs or videos, rename them, change their order with ↑ ↓, or remove one. Removing a deck deletes its reading questions; past results are kept.
  - **Videos** must be MP4, up to 2 GB; 720p keeps them small and smooth on phones (HandBrake's "Web" presets work well). The upload shows its progress and survives short connection drops; keep the page open until it finishes.
  - Learners can skip ahead and play at up to 2×. A video counts as done as soon as they open it. Videos have no reading questions and no minimum time; the course's minimum reading time only applies when it also has a PDF.
  - A course can be videos only. AI suggestions use PDFs, so write a video-only course's test questions by hand.
- **History**: who changed what on this course, and when.

### Questions

The **Questions** tab is the course's question bank. There are two kinds:

- **Main test**: questions for the assessment.
- **Reading test**: questions that pop up while reading, at a chosen page of a chosen deck.

For each question you set:

- the question text, and an optional image;
- two or more answers, one of them correct;
- an explanation, which people see after answering.

Tick **Mandatory** on a test question to include it in every assessment. People must get every mandatory question right to pass, whatever their score.

**How the assessment is built.** Each attempt includes every mandatory question, plus random others, so that about 60% are mandatory, with at least 5 questions in total. If there aren't enough non-mandatory questions, a notice tells you how many to add.

**AI suggestions.** Choose a deck and how many reading and test questions you want, then **Generate recommendations**. It can take a few minutes. Check every suggestion carefully, untick the ones you don't want, and click **Add N selected questions**. Suggested questions are never mandatory; edit them afterwards to change that.

Each person gets 3 random reading questions per reading session.

### Archive, restore and delete

- **Archive** a course you no longer use. Learners can't start it, it stops counting toward compliance, and every result and certificate is kept. Archived courses are read-only. **Restore** brings it back.
- **Delete** is only for super admins, and only for courses nobody has started (for example, one created by mistake). You'll be asked to type the course code. Anything with training records can only be archived.

## Training groups

Training groups are how you give courses to many people at once, such as *Titan Distributors* or *Normal Distributors*.

1. **Training groups → New training group**, then **Add**.
2. Add **Members** by searching names or emails, or paste a list of emails. Anyone not found is listed so you can check them. People can be in several groups.
3. Add **Courses**, as Required or Optional. Everyone in the group can now see them, and must complete the required ones, including people who join later.

Removing someone from a group, or deleting a group, takes those courses away from them (unless they get them another way) but keeps their results. **View compliance** opens the Dashboard for that group.

Groups are different from **watchlists**: groups decide what people can see and must complete; watchlists are private lists for keeping an eye on people.

## People and profiles

### Invite people

Only people you invite can create an account.

1. Open **People** and click **Invite people**.
2. Paste their email addresses. Optionally pick a training group they should join when they sign up.
3. Click **Send invites**. Each person must sign up with exactly the address you invited.

The list under the form shows invites nobody has used yet. Click **Withdraw** to cancel one.

### People list

**People** lists everyone in the portal with their recent results. Search and filter by role and status:

- **On track**: their latest attempt was a pass;
- **Needs attention**: their latest attempt was a fail;
- **Not started**: no attempts yet.

This is about recent results, not required training: use the Dashboard for compliance. Click **View** to open someone's profile.

### Profiles

Open anyone's profile from the Dashboard or People. As an admin you can:

- **Change their role** and click **Save role**:
  - Learner;
  - Admin.

  Only a super admin can make someone a super admin. You can't change your own role.
- **Add or remove training groups** for that person.
- **Give courses** just to them, as Required or Optional, switch one between the two, or remove it. Their optional courses are listed under **Optional courses**.
- **Approve more attempts.** When someone fails a course 3 times it locks, and you get an email. Their profile shows it under **Locked assessments**. Click **Allow 3 more attempts**.
- See their certificates and **Review** any attempt.
- **Archive person** when someone leaves. They lose access to the portal straight away and stop counting towards compliance, but their attempts, certificates and history are kept. Find them again on **People** by choosing the **Archived** status, and click **Restore person** to undo it. Only a super admin can archive an admin.

## Emails you'll receive

Every admin is emailed:

- when someone new signs up (check they should have access, and add them to the right groups);
- when someone uses their last attempt on a course (approve more from their profile when ready).

## Super admins

Super admins can do everything an admin can, and also:

- make or remove other super admins;
- delete courses that have no training records.
