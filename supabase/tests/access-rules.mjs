// Database access-rule tests. They run as real signed-in users (learner, manager, admin,
// super admin) against the Supabase database in SUPABASE_DB_URL, inside one transaction
// that is always rolled back, so they leave no data behind. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

// Values already in the environment win over .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the environment.
}
const url = process.env.SUPABASE_DB_URL;
const client = url ? new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } }) : null;
const users = { learner: randomUUID(), manager: randomUUID(), admin: randomUUID(), superAdmin: randomUUID(), other: randomUUID() };
const ids = { course: randomUUID(), emptyCourse: randomUUID(), group: randomUUID() };

// Runs SQL as a signed-in user. Errors come back as { error } and roll back only this step.
async function as(userId, sql, params = []) {
  await client.query("savepoint step");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    const result = await client.query(sql, params);
    await client.query("reset role");
    await client.query("release savepoint step");
    return { rows: result.rows, count: result.rowCount };
  } catch (error) {
    await client.query("rollback to savepoint step");
    return { error: error.message };
  }
}

// Runs SQL as the database owner with no signed-in user (like the SQL Editor).
async function asOwner(sql, params = []) {
  await client.query("savepoint step");
  try {
    await client.query("select set_config('request.jwt.claims', '', true)");
    const result = await client.query(sql, params);
    await client.query("release savepoint step");
    return { rows: result.rows, count: result.rowCount };
  } catch (error) {
    await client.query("rollback to savepoint step");
    return { error: error.message };
  }
}

// Calls a database function as a user and returns its single value, or { error }.
async function call(userId, sql, params = []) {
  const result = await as(userId, `select ${sql} as value`, params);
  return result.error ? result : result.rows[0].value;
}

// A course with `optional` main-test questions (and `mandatory` mandatory ones), and
// `reading` checkpoint questions on one deck. Every question's correct answer is option 0.
async function makeCourse({ mandatory = 0, optional = 0, reading = 0, readSeconds = 0, viewOnly = false } = {}) {
  const course = (await asOwner("insert into public.courses (code, title, read_seconds, view_only) values ($1, 'Fixture', $2, $3) returning id",
    [`TEST-${randomUUID().slice(0, 6)}`, readSeconds, viewOnly])).rows[0].id;
  const deck = (await asOwner("insert into public.course_materials (course_id, position, title, pdf_url) values ($1, 1, 'Deck', '/deck.pdf') returning id", [course])).rows[0].id;
  const insert = "insert into public.questions (course_id, material_id, question_type, page_number, is_mandatory, question_text, options, correct_index, explanation) values ($1, $2, $3, $4, $5, 'Q', '[\"right\",\"wrong\"]', 0, 'Because')";
  for (let i = 0; i < mandatory; i++) await asOwner(insert, [course, null, "main_test", null, true]);
  for (let i = 0; i < optional; i++) await asOwner(insert, [course, null, "main_test", null, false]);
  for (let i = 0; i < reading; i++) await asOwner(insert, [course, deck, "reading_test", i + 1, false]);
  return course;
}

// Finishes the reading of a course with no checkpoints and no minimum time.
async function finishReading(userId, course) {
  const { session_id: session } = await call(userId, "public.start_reading($1)", [course]);
  return call(userId, "public.finish_reading($1)", [session]);
}

// Answers every question of an attempt: option 0 (right) unless `wrong(question)` says otherwise.
function answers(questions, wrong = () => false) {
  return JSON.stringify(Object.fromEntries(questions.map((question) => [question.id, wrong(question) ? 1 : 0])));
}

before(async () => {
  if (!client) return;
  await client.connect();
  await client.query("begin");
  // Optionally try migrations that aren't on the database yet, inside this transaction
  // (rolled back with everything else): TEST_MIGRATIONS=path/to/NNN.sql,… npm run test:db
  for (const file of (process.env.TEST_MIGRATIONS || "").split(",").filter(Boolean)) {
    await client.query(readFileSync(file, "utf8").replace(/^\s*(begin|commit);\s*$/gim, ""));
  }
  for (const [name, id] of Object.entries(users)) {
    await client.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${name}.${id.slice(0, 8)}@test.invalid`, { full_name: `Test ${name}` }]);
  }
  await client.query("update public.profiles set role = 'manager' where id = $1", [users.manager]);
  await client.query("update public.profiles set role = 'admin' where id = $1", [users.admin]);
  await client.query("update public.profiles set role = 'super_admin' where id = $1", [users.superAdmin]);
  await client.query("insert into public.courses (id, code, title) values ($1, $2, 'Test course'), ($3, $4, 'Empty test course')",
    [ids.course, `TEST-${ids.course.slice(0, 6)}`, ids.emptyCourse, `TEST-${ids.emptyCourse.slice(0, 6)}`]);
  await client.query("insert into public.quiz_attempts (user_id, course_id, status, score, passed) values ($1, $2, 'completed', 90, true)", [users.learner, ids.course]);
  await client.query("insert into public.groups (id, name) values ($1, $2)", [ids.group, `Test group ${ids.group.slice(0, 6)}`]);
});

after(async () => {
  if (!client) return;
  await client.query("rollback");
  await client.end();
});

const skip = client ? false : "SUPABASE_DB_URL is not set";

test("new sign-ups become learners and get their email on the profile", { skip }, async () => {
  const { rows } = await asOwner("select role, email from public.profiles where id = $1", [users.other]);
  assert.equal(rows[0].role, "learner");
  assert.match(rows[0].email, /@test\.invalid$/);
});

test("roles: only admins change roles, only super admins grant super admin", { skip }, async () => {
  assert.match((await as(users.learner, "update public.profiles set role = 'admin' where id = $1", [users.learner])).error, /Only an admin/);
  assert.match((await as(users.admin, "update public.profiles set role = 'super_admin' where id = $1", [users.other])).error, /super admin/);
  assert.equal((await as(users.admin, "update public.profiles set role = 'manager' where id = $1 returning role", [users.other])).rows[0].role, "manager");
  assert.equal((await as(users.superAdmin, "update public.profiles set role = 'super_admin' where id = $1 returning role", [users.other])).rows[0].role, "super_admin");
  await asOwner("update public.profiles set role = 'learner' where id = $1", [users.other]);
});

test("visibility: learners see only themselves; managers read everyone but edit nothing", { skip }, async () => {
  assert.equal((await as(users.learner, "select count(*)::int as n from public.profiles")).rows[0].n, 1);
  assert.ok((await as(users.manager, "select count(*)::int as n from public.profiles")).rows[0].n >= 5);
  assert.equal((await as(users.manager, "select count(*)::int as n from public.quiz_attempts where course_id = $1", [ids.course])).rows[0].n, 1);
  assert.equal((await as(users.manager, "update public.courses set title = 'x' where id = $1", [ids.course])).count, 0);
});

test("archiving stamps the real actor and blocks new starts", { skip }, async () => {
  const { rows } = await as(users.admin, "update public.courses set archived_at = now(), archived_by = $2 where id = $1 returning archived_by", [ids.course, users.learner]);
  assert.equal(rows[0].archived_by, users.admin);
  assert.match((await call(users.learner, "public.start_reading($1)", [ids.course])).error, /archived/);
  assert.match((await call(users.learner, "public.start_attempt($1)", [ids.course])).error, /archived/);
  const audit = await as(users.admin, "select action, actor_id from public.audit_log where entity_id = $1 order by id desc limit 1", [ids.course]);
  assert.deepEqual(audit.rows[0], { action: "course.archived", actor_id: users.admin });
  await as(users.admin, "update public.courses set archived_at = null where id = $1", [ids.course]);
});

test("deleting: admins can't, super admins only when there are no records", { skip }, async () => {
  assert.equal((await as(users.admin, "delete from public.courses where id = $1", [ids.emptyCourse])).count, 0);
  assert.match((await as(users.superAdmin, "delete from public.courses where id = $1", [ids.course])).error, /foreign key/);
  assert.equal((await as(users.superAdmin, "delete from public.courses where id = $1", [ids.emptyCourse])).count, 1);
  assert.match((await asOwner("delete from auth.users where id = $1", [users.learner])).error, /foreign key/);
});

test("the audit log is append-only and admin-only", { skip }, async () => {
  assert.match((await asOwner("delete from public.audit_log where entity_id = $1", [ids.course])).error, /append-only/);
  assert.ok((await as(users.learner, "insert into public.audit_log (action, entity_type) values ('x', 'y')")).error);
  assert.equal((await as(users.manager, "select count(*)::int as n from public.audit_log")).rows[0].n, 0);
});

test("training groups: admin-only, assignments need one target, actors are stamped", { skip }, async () => {
  const added = await as(users.admin, "insert into public.group_members (group_id, user_id, added_by) values ($1, $2, $3) returning added_by", [ids.group, users.learner, users.learner]);
  assert.equal(added.rows[0].added_by, users.admin);
  assert.equal((await as(users.admin, "insert into public.course_assignments (course_id, group_id) values ($1, $2)", [ids.course, ids.group])).count, 1);
  assert.match((await as(users.admin, "insert into public.course_assignments (course_id, group_id, user_id) values ($1, $2, $3)", [ids.course, ids.group, users.learner])).error, /one_target/);
  assert.match((await as(users.manager, "insert into public.group_members (group_id, user_id) values ($1, $2)", [ids.group, users.manager])).error, /row-level security/);
  assert.match((await as(users.learner, "insert into public.course_assignments (course_id, user_id) values ($1, $2)", [ids.course, users.learner])).error, /row-level security/);
});

test("managers can't see training groups but get expanded required courses", { skip }, async () => {
  assert.equal((await as(users.manager, "select count(*)::int as n from public.groups where id = $1", [ids.group])).rows[0].n, 0);
  assert.equal((await as(users.manager, "select count(*)::int as n from public.course_assignments where group_id = $1", [ids.group])).rows[0].n, 0);
  assert.equal((await as(users.manager, "select count(*)::int as n from public.required_courses() where user_id = $1", [users.learner])).rows[0].n, 1);
  assert.equal((await as(users.learner, "select count(*)::int as n from public.groups where id = $1", [ids.group])).rows[0].n, 1);
  assert.equal((await as(users.learner, "select count(distinct user_id)::int as n from public.required_courses()")).rows[0].n, 1);
});

test("watchlists are private to their creator", { skip }, async () => {
  assert.match((await as(users.manager, "insert into public.view_groups (name, owner_id) values ('Team', $1)", [users.admin])).error, /row-level security/);
  const created = await as(users.manager, "insert into public.view_groups (name) values ('Team') returning id, owner_id");
  assert.equal(created.rows[0].owner_id, users.manager);
  const watchlist = created.rows[0].id;
  assert.ok(!(await as(users.manager, "insert into public.view_group_members (view_group_id, user_id) values ($1, $2)", [watchlist, users.learner])).error);
  assert.equal((await as(users.admin, "select count(*)::int as n from public.view_groups where id = $1", [watchlist])).rows[0].n, 0);
  assert.equal((await as(users.superAdmin, "select count(*)::int as n from public.view_group_members where view_group_id = $1", [watchlist])).rows[0].n, 0);
  assert.match((await as(users.admin, "insert into public.view_group_members (view_group_id, user_id) values ($1, $2)", [watchlist, users.admin])).error, /row-level security/);
  assert.match((await as(users.learner, "insert into public.view_groups (name) values ('Mine')")).error, /row-level security/);
});

test("reading decks: everyone reads them, only admins change them, reading questions use their own course's deck", { skip }, async () => {
  const added = await as(users.admin, "insert into public.course_materials (course_id, position, title, pdf_url) values ($1, 1, 'Deck one', '/one.pdf') returning id", [ids.course]);
  const deckId = added.rows[0].id;
  assert.equal((await as(users.learner, "select count(*)::int as n from public.course_materials where course_id = $1", [ids.course])).rows[0].n, 1);
  assert.match((await as(users.learner, "insert into public.course_materials (course_id, position, title, pdf_url) values ($1, 2, 'x', '/x.pdf')", [ids.course])).error, /row-level security/);
  assert.equal((await as(users.manager, "update public.course_materials set title = 'x' where id = $1", [deckId])).count, 0);
  const audit = await as(users.admin, "select action from public.audit_log where entity_type = 'course_materials' and details->>'course_id' = $1", [ids.course]);
  assert.deepEqual(audit.rows.map((row) => row.action), ["course_materials.insert"]);

  const question = "insert into public.questions (course_id, material_id, question_type, page_number, question_text, options, correct_index, explanation) values ($1, $2, $3, $4, 'Q', '[\"a\",\"b\"]', 0, 'E')";
  assert.match((await as(users.admin, question, [ids.course, null, "reading_test", 1])).error, /questions_material_reading_check/);
  assert.match((await as(users.admin, question, [ids.course, deckId, "main_test", null])).error, /questions_material_reading_check/);
  const other = await asOwner("insert into public.courses (code, title) values ($1, 'Other') returning id", [`TEST-${randomUUID().slice(0, 6)}`]);
  assert.match((await as(users.admin, question, [other.rows[0].id, deckId, "reading_test", 1])).error, /its own course/);
  assert.equal((await as(users.admin, question, [ids.course, deckId, "reading_test", 1])).count, 1);
  const reading = await call(users.learner, "public.start_reading($1)", [ids.course]);
  assert.deepEqual(reading.questions.map((q) => q.material_id), [deckId]);

  // Removing a deck removes its reading questions.
  assert.equal((await as(users.admin, "delete from public.course_materials where id = $1", [deckId])).count, 1);
  assert.equal((await asOwner("select count(*)::int as n from public.questions where course_id = $1 and question_type = 'reading_test'", [ids.course])).rows[0].n, 0);
});

test("attempt limit: three failed attempts, then an admin must approve more", { skip }, async () => {
  const course = await makeCourse({ optional: 5 });
  await finishReading(users.other, course);
  const attempt = async (passed) => {
    const started = await call(users.other, "public.start_attempt($1)", [course]);
    if (started.error) return started;
    return call(users.other, "public.submit_attempt($1, $2)", [started.attempt_id, answers(started.questions, () => !passed)]);
  };
  const left = async () => (await as(users.other, "select public.attempts_remaining($1, $2) as n", [users.other, course])).rows[0].n;

  assert.equal(await left(), 3);
  for (const expected of [2, 1, 0]) assert.equal((await attempt(false)).attempts_left, expected);
  assert.match((await attempt(true)).error, /no attempts left/);
  assert.match((await as(users.other, "insert into public.quiz_attempts (user_id, course_id, status, score, passed) values ($1, $2, 'completed', 100, true)", [users.other, course])).error, /row-level security/);

  // Learners and managers can't approve themselves or others; admins can, and it's audited.
  assert.match((await as(users.other, "insert into public.attempt_unlocks (user_id, course_id, granted_by) values ($1, $2, $1)", [users.other, course])).error, /row-level security/);
  assert.match((await as(users.manager, "insert into public.attempt_unlocks (user_id, course_id, granted_by) values ($1, $2, $3)", [users.other, course, users.manager])).error, /row-level security/);
  assert.match((await as(users.admin, "insert into public.attempt_unlocks (user_id, course_id, granted_by) values ($1, $2, $3)", [users.other, course, users.manager])).error, /row-level security/);
  assert.equal((await as(users.admin, "insert into public.attempt_unlocks (user_id, course_id, granted_by, granted_at) values ($1, $2, $3, clock_timestamp())", [users.other, course, users.admin])).count, 1); // one transaction, so now() is frozen
  assert.equal(await left(), 3);
  const audit = await as(users.admin, "select action, actor_id from public.audit_log where entity_type = 'attempt_unlocks' and details->>'course_id' = $1", [course]);
  assert.deepEqual(audit.rows, [{ action: "attempt_unlocks.insert", actor_id: users.admin }]);

  // Passing resets the count; others can't read someone's allowance.
  assert.equal((await attempt(false)).attempts_left, 2);
  assert.equal((await attempt(true)).attempts_left, 3);
  assert.equal((await as(users.learner, "select public.attempts_remaining($1, $2) as n", [users.other, course])).rows[0].n, null);
  assert.equal((await as(users.manager, "select public.attempts_remaining($1, $2) as n", [users.other, course])).rows[0].n, 3);
});

test("reading-only courses: finishing the reading issues one certificate, only after the reading time", { skip }, async () => {
  const course = await makeCourse({ viewOnly: true, readSeconds: 600 });
  const certificates = async (courseId) => (await asOwner("select count(*)::int as n, max(reading_session_id::text) as session from public.certificates where user_id = $1 and course_id = $2", [users.other, courseId])).rows[0];
  const { session_id: session } = await call(users.other, "public.start_reading($1)", [course]);

  // Too early, and learners can't backdate their session or mark it finished themselves.
  assert.match((await call(users.other, "public.finish_reading($1)", [session])).error, /minimum reading time/);
  assert.equal((await as(users.other, "update public.reading_sessions set started_at = now() - interval '1 day', checkpoint_passed = true where id = $1", [session])).count, 0);
  assert.match((await as(users.other, "insert into public.reading_sessions (user_id, course_id, checkpoint_passed) values ($1, $2, true)", [users.other, course])).error, /row-level security/);
  assert.equal((await certificates(course)).n, 0);

  // Once the time has passed, finishing issues the certificate, once.
  await asOwner("update public.reading_sessions set started_at = now() - interval '1 day' where id = $1", [session]);
  const finished = await call(users.other, "public.finish_reading($1)", [session]);
  assert.deepEqual(await certificates(course), { n: 1, session });
  assert.ok(finished.certificate_id);
  await asOwner("update public.courses set read_seconds = 0 where id = $1", [course]);
  await finishReading(users.other, course);
  assert.equal((await certificates(course)).n, 1);

  // Courses with a test still need the test.
  const tested = await makeCourse({ optional: 5 });
  await finishReading(users.other, tested);
  assert.equal((await certificates(tested)).n, 0);
});

test("reading checkpoints: the database picks them, checks answers, and won't finish until all are right", { skip }, async () => {
  const course = await makeCourse({ reading: 4 });
  const reading = await call(users.learner, "public.start_reading($1)", [course]);
  assert.equal(reading.questions.length, 3);
  assert.ok(reading.questions.every((q) => !("correct_index" in q) && !("explanation" in q)));
  const again = await call(users.learner, "public.start_reading($1)", [course]);
  assert.equal(again.session_id, reading.session_id);
  assert.deepEqual(again.questions.map((q) => q.id), reading.questions.map((q) => q.id));

  const answer = (userId, questionId, index) => call(userId, "public.answer_reading_question($1, $2, $3)", [reading.session_id, questionId, index]);
  const [first, ...rest] = reading.questions;
  assert.deepEqual(await answer(users.learner, first.id, 1), { correct: false, explanation: "Because" });
  assert.match((await answer(users.other, first.id, 0)).error, /not part of your reading session/);
  const unasked = (await asOwner("select id from public.questions where course_id = $1 and question_type = 'reading_test' and not (id = any($2::uuid[]))", [course, reading.questions.map((q) => q.id)])).rows[0].id;
  assert.match((await answer(users.learner, unasked, 0)).error, /not part of your reading session/);

  assert.deepEqual(await answer(users.learner, first.id, 0), { correct: true, explanation: "Because" });
  assert.match((await call(users.learner, "public.finish_reading($1)", [reading.session_id])).error, /Answer every reading question/);
  assert.match((await call(users.learner, "public.start_attempt($1)", [course])).error, /Finish the reading/);
  for (const question of rest) assert.equal((await answer(users.learner, question.id, 0)).correct, true);
  assert.ok(!(await call(users.learner, "public.finish_reading($1)", [reading.session_id])).error);
  assert.equal((await as(users.learner, "select checkpoint_passed from public.reading_sessions where id = $1", [reading.session_id])).rows[0].checkpoint_passed, true);
});

test("assessments: the database grades them and hides answers until submitted", { skip }, async () => {
  const course = await makeCourse({ mandatory: 1, optional: 6 });
  assert.match((await call(users.learner, "public.start_attempt($1)", [course])).error, /Finish the reading/);
  await finishReading(users.learner, course);

  // Every mandatory question plus random others: max(5, round(1 / 0.6)) = 5 questions, no answers.
  const started = await call(users.learner, "public.start_attempt($1)", [course]);
  assert.equal(started.questions.length, 5);
  assert.equal(started.questions.filter((q) => q.is_mandatory).length, 1);
  assert.ok(started.questions.every((q) => !("correct_index" in q) && !("explanation" in q)));
  assert.equal((await call(users.learner, "public.start_attempt($1)", [course])).attempt_id, started.attempt_id);

  // Nobody can read an unsubmitted attempt's questions, or write attempts directly.
  const snapshots = "select count(*)::int as n from public.attempt_questions where attempt_id = $1";
  assert.equal((await as(users.learner, snapshots, [started.attempt_id])).rows[0].n, 0);
  assert.equal((await as(users.manager, snapshots, [started.attempt_id])).rows[0].n, 0);
  assert.equal((await as(users.learner, "update public.quiz_attempts set status = 'completed', passed = true, score = 100 where id = $1", [started.attempt_id])).count, 0);
  assert.match((await as(users.learner, "insert into public.attempt_questions (attempt_id, question_text, options, correct_index, explanation) values ($1, 'Q', '[\"a\",\"b\"]', 0, 'E')", [started.attempt_id])).error, /row-level security/);
  assert.match((await call(users.other, "public.submit_attempt($1, $2)", [started.attempt_id, answers(started.questions)])).error, /Attempt not found/);

  // Every question needs a valid answer.
  const submit = (attempt, given) => call(users.learner, "public.submit_attempt($1, $2)", [attempt, given]);
  const every = (value) => JSON.stringify(Object.fromEntries(started.questions.map((q) => [q.id, value])));
  assert.match((await submit(started.attempt_id, answers(started.questions.slice(1)))).error, /Answer every question/);
  assert.match((await submit(started.attempt_id, every(2))).error, /Answer every question/);
  assert.match((await submit(started.attempt_id, every("0"))).error, /Answer every question/);
  assert.match((await submit(started.attempt_id, every(0.5))).error, /Answer every question/);

  // 4 of 5 right is 80%, but the mandatory question was wrong, so it fails.
  const failed = await submit(started.attempt_id, answers(started.questions, (q) => q.is_mandatory));
  assert.deepEqual([failed.score, failed.passed, failed.mandatory_correct_count, failed.certificate_id], [80, false, 0, null]);
  assert.ok(failed.questions.every((q) => q.correct_index === 0 && q.explanation === "Because"));
  assert.match((await submit(started.attempt_id, answers(started.questions))).error, /already been submitted/);
  assert.equal((await as(users.learner, snapshots, [started.attempt_id])).rows[0].n, 5);

  // All right passes and issues the certificate, dated by the server.
  const retake = await call(users.learner, "public.start_attempt($1)", [course]);
  assert.notEqual(retake.attempt_id, started.attempt_id);
  const passed = await submit(retake.attempt_id, answers(retake.questions));
  assert.deepEqual([passed.score, passed.passed], [100, true]);
  const certificate = (await asOwner("select c.id, c.issued_at = a.submitted_at as dated from public.certificates c join public.quiz_attempts a on a.id = c.attempt_id where c.user_id = $1 and c.course_id = $2", [users.learner, course])).rows[0];
  assert.deepEqual(certificate, { id: passed.certificate_id, dated: true });
});

test("invites: admin-only, and a sign-up uses its invite and joins the invite's group", { skip }, async (t) => {
  const email = `invited.${randomUUID().slice(0, 8)}@test.invalid`;
  assert.match((await as(users.learner, "insert into public.invites (email) values ($1)", [email])).error, /row-level security/);
  assert.match((await as(users.manager, "insert into public.invites (email) values ($1)", [email])).error, /row-level security/);
  assert.match((await as(users.admin, "insert into public.invites (email) values ($1)", [email.toUpperCase()])).error, /check constraint/);
  const invite = (await as(users.admin, "insert into public.invites (email, group_id, invited_by) values ($1, $2, $3) returning id, invited_by", [email, ids.group, users.learner])).rows[0];
  assert.equal(invite.invited_by, users.admin);
  assert.equal((await as(users.learner, "select count(*)::int as n from public.invites")).rows[0].n, 0);

  // Supabase Auth connects as its own role; without an invite it can't create the account.
  const authSignUp = async (address) => {
    await client.query("savepoint signup");
    try {
      await client.query("set local session authorization supabase_auth_admin");
    } catch (error) {
      await client.query("rollback to savepoint signup");
      return { unsupported: error.message };
    }
    try {
      const id = randomUUID();
      await client.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, address, { full_name: "Invited" }]);
      await client.query("reset session authorization");
      await client.query("release savepoint signup");
      return { id };
    } catch (error) {
      await client.query("rollback to savepoint signup");
      return { error: error.message };
    }
  };
  const uninvited = await authSignUp(`stranger.${randomUUID().slice(0, 8)}@test.invalid`);
  let invitedId;
  if (uninvited.unsupported) {
    // This database user can't act as Supabase Auth; sign up as the owner instead.
    t.diagnostic(`Refusing uninvited sign-ups was not checked: ${uninvited.unsupported}`);
    invitedId = randomUUID();
    await asOwner("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [invitedId, email, { full_name: "Invited" }]);
  } else {
    assert.match(uninvited.error, /has not been invited/);
    invitedId = (await authSignUp(email)).id;
    assert.ok(invitedId, "an invited email can sign up");
  }

  const used = (await asOwner("select accepted_by, accepted_at from public.invites where id = $1", [invite.id])).rows[0];
  assert.equal(used.accepted_by, invitedId);
  assert.ok(used.accepted_at);
  assert.equal((await asOwner("select added_by from public.group_members where group_id = $1 and user_id = $2", [ids.group, invitedId])).rows[0].added_by, users.admin);
  // A used invite is a record: it can't be withdrawn. An unused one can.
  assert.equal((await as(users.admin, "delete from public.invites where id = $1", [invite.id])).count, 0);
  const spare = (await as(users.admin, "insert into public.invites (email) values ($1) returning id", [`spare.${randomUUID().slice(0, 8)}@test.invalid`])).rows[0].id;
  assert.equal((await as(users.admin, "delete from public.invites where id = $1", [spare])).count, 1);
});

test("archived people lose all access, keep their records, and can be restored", { skip }, async () => {
  const course = await makeCourse({ optional: 5 });
  await asOwner("insert into public.course_assignments (course_id, user_id) values ($1, $2)", [course, users.other]);
  const archive = (actor, target, value = "now()") => as(actor, `update public.profiles set archived_at = ${value} where id = $1 returning archived_at, archived_by`, [target]);

  assert.match((await archive(users.learner, users.learner)).error, /Only an admin/);
  assert.equal((await archive(users.manager, users.other)).count, 0);
  assert.match((await archive(users.admin, users.admin)).error, /cannot archive yourself/);
  assert.match((await archive(users.admin, users.superAdmin)).error, /Only a super admin/);

  const archived = (await archive(users.admin, users.other, "'2000-01-01'")).rows[0];
  assert.equal(archived.archived_by, users.admin);
  assert.ok(new Date(archived.archived_at) > new Date("2020-01-01"), "the database sets the time");

  // The archived person sees only their own profile row, and nothing else works.
  assert.equal((await as(users.other, "select count(*)::int as n from public.profiles")).rows[0].n, 1);
  assert.equal((await as(users.other, "select count(*)::int as n from public.courses")).rows[0].n, 0);
  assert.equal((await as(users.other, "select count(*)::int as n from public.quiz_attempts")).rows[0].n, 0);
  assert.equal((await as(users.other, "select count(*)::int as n from public.required_courses()")).rows[0].n, 0);
  assert.match((await call(users.other, "public.start_reading($1)", [course])).error, /deactivated/);
  assert.equal((await as(users.other, "update public.profiles set full_name = 'Back again' where id = $1", [users.other])).count, 0);
  assert.equal((await archive(users.other, users.other, "null")).count, 0);
  // They no longer count towards compliance, but their records are still there for admins.
  assert.equal((await as(users.admin, "select count(*)::int as n from public.required_courses() where user_id = $1", [users.other])).rows[0].n, 0);
  assert.ok((await as(users.admin, "select count(*)::int as n from public.quiz_attempts where user_id = $1", [users.other])).rows[0].n > 0);
  assert.equal((await as(users.admin, "select action from public.audit_log where entity_id = $1 order by id desc limit 1", [users.other])).rows[0].action, "profile.archived");

  // An archived admin holds no role.
  await asOwner("update public.profiles set archived_at = now() where id = $1", [users.admin]);
  assert.equal((await as(users.admin, "select count(*)::int as n from public.profiles")).rows[0].n, 1);
  assert.match((await as(users.admin, "insert into public.invites (email) values ('x@test.invalid')")).error, /row-level security/);
  await asOwner("update public.profiles set archived_at = null where id = $1", [users.admin]);

  const restored = (await archive(users.admin, users.other, "null")).rows[0];
  assert.equal(restored.archived_at, null);
  assert.equal(restored.archived_by, null);
  assert.equal((await as(users.other, "select count(*)::int as n from public.required_courses()")).rows[0].n, 1);
});

test("course PDFs: signed-in people can read the files, archived people and visitors can't", { skip }, async () => {
  assert.equal((await asOwner("select public from storage.buckets where id = 'course-pdfs'")).rows[0].public, false);
  const visible = (userId) => as(userId, "select count(*)::int as n from storage.objects where bucket_id = 'course-pdfs'");
  const total = (await asOwner("select count(*)::int as n from storage.objects where bucket_id = 'course-pdfs'")).rows[0].n;
  assert.equal((await visible(users.learner)).rows[0].n, total);
  await asOwner("update public.profiles set archived_at = now() where id = $1", [users.learner]);
  assert.equal((await visible(users.learner)).rows[0].n, 0);
  await asOwner("update public.profiles set archived_at = null where id = $1", [users.learner]);
});
