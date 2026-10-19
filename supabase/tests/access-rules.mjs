// Database access-rule tests. They run as real signed-in users (learner, manager, admin,
// super admin) against the Supabase database in SUPABASE_DB_URL, inside one transaction
// that is always rolled back, so they leave no data behind. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

function databaseUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  try {
    const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("SUPABASE_DB_URL="));
    return line?.slice("SUPABASE_DB_URL=".length).trim().replace(/^"|"$/g, "");
  } catch {
    return undefined;
  }
}

const url = databaseUrl();
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

async function asOwner(sql, params = []) {
  await client.query("savepoint step");
  try {
    const result = await client.query(sql, params);
    await client.query("release savepoint step");
    return { rows: result.rows, count: result.rowCount };
  } catch (error) {
    await client.query("rollback to savepoint step");
    return { error: error.message };
  }
}

before(async () => {
  if (!client) return;
  await client.connect();
  await client.query("begin");
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
  assert.match((await as(users.learner, "insert into public.reading_sessions (user_id, course_id) values ($1, $2)", [users.learner, ids.course])).error, /row-level security/);
  assert.equal((await as(users.learner, "select count(*)::int as n from public.get_quiz_questions($1)", [ids.course])).rows[0].n, 0);
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
