# Guide for admins

Admins run the training: courses, questions, who has to do what, and helping people who get stuck. Everything in the [manager guide](managers.md) (Dashboard, watchlists, People, Insights) is available to you too.

Click **Admin** in the top bar. The tabs are **Dashboard**, **People**, **Training groups**, **Courses** and **Insights**.

## Courses

### Add a course

1. **Courses → + Add course**.
2. Fill in:
   - **Course code**, a short unique code such as `KNEE-101`;
   - **Title** and **Description**;
   - **Training PDFs**: one or more, up to 50 MB each, read in the order you add them;
   - **Reading only**: tick this for courses with no test, where finishing the reading earns the certificate;
   - **Passing score** (default 80%);
   - **Minimum reading time** in seconds (default 60);
   - **Make this course available to learners**.
3. For a tested course with a PDF, choose how many questions to have AI suggest: 3–10 reading questions and 5–30 test questions. Suggestions need the first PDF to be **5 MB or smaller**; compress it if it isn't.
4. Click **Create course…**. You land on the course's **Questions** tab, and suggestions start automatically.

### Course overview

Open a course from **Courses** to manage it:

- **Course details**: change the title, description, passing score, reading time, reading only, and **Visible to learners**. Hidden courses disappear for learners and stop counting toward compliance, but nothing is archived.
- **Who must complete this course**: assign it to training groups, or to individual people (search, or paste a list of emails).
- **Reading decks**: add more PDFs, rename them, change their order with ↑ ↓, or remove one. Removing a deck deletes its reading questions; past results are kept.
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

Training groups are how you assign courses to many people at once, such as *Titan Distributors* or *Normal Distributors*.

1. **Training groups → New training group**, then **Add**.
2. Add **Members** by searching names or emails, or paste a list of emails. Anyone not found is listed so you can check them. People can be in several groups.
3. Add **Required courses**. Everyone in the group must now complete them, including people who join later.

Removing someone from a group, or deleting a group, removes those requirements but keeps their results. **View compliance** opens the Dashboard for that group.

Groups are different from **watchlists**: groups decide what people must complete; watchlists are private lists for keeping an eye on people.

## People and profiles

Open anyone's profile from the Dashboard or People. As an admin you can:

- **Change their role** and click **Save role**:
  - Learner;
  - Manager (read-only access to the management pages);
  - Admin.

  Only a super admin can make someone a super admin. You can't change your own role.
- **Add or remove training groups** for that person.
- **Assign extra courses** just to them, or remove an individual assignment.
- **Approve more attempts.** When someone fails a course 3 times it locks, and you get an email. Their profile shows it under **Locked assessments**. Click **Allow 3 more attempts**.
- See their certificates and **Review** any attempt.

## Emails you'll receive

Every admin is emailed:

- when someone new signs up (check they should have access, and add them to the right groups);
- when someone uses their last attempt on a course (approve more from their profile when ready).

## Super admins

Super admins can do everything an admin can, and also:

- make or remove other super admins;
- delete courses that have no training records.
