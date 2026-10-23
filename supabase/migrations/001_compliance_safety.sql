-- 001 · Compliance safety
-- Roles (learner / manager / admin / super_admin), course archiving, an append-only
-- audit log, and foreign keys that stop training records from being deleted.
-- Apply once to an existing database (after setup.sql and requested-changes.sql).
-- Undo: supabase/migrations/001_compliance_safety.undo.sql

begin;

-- ── Roles ──────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'learner' where role = 'rep';
alter table public.profiles alter column role set default 'learner';
alter table public.profiles
  add constraint profiles_role_check check (role in ('learner', 'manager', 'admin', 'super_admin'));

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin'
  );
$$;

-- Managers, admins and super admins can read everyone's training records.
create or replace function public.can_view_reports()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin', 'super_admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'learner');
  return new;
end;
$$;

-- Only admins change roles, and only super admins grant or revoke super admin.
-- Direct database sessions (no signed-in user, e.g. the SQL editor) are trusted.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    if not public.is_admin() then
      raise exception 'Only an admin can change profile roles';
    end if;
    if (old.role = 'super_admin' or new.role = 'super_admin') and not public.is_super_admin() then
      raise exception 'Only a super admin can grant or remove super admin access';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- Reporting access for managers.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_reports" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_view_reports());

drop policy if exists "attempts_select_own_or_admin" on public.quiz_attempts;
create policy "attempts_select_own_or_reports" on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());

drop policy if exists "reading_select_own_or_admin" on public.reading_sessions;
create policy "reading_select_own_or_reports" on public.reading_sessions for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());

drop policy if exists "attempt_q_select_own_or_admin" on public.attempt_questions;
create policy "attempt_q_select_own_or_reports" on public.attempt_questions for select to authenticated
  using (
    public.can_view_reports()
    or exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_questions.attempt_id and qa.user_id = (select auth.uid())
    )
  );

-- ── Course archiving ───────────────────────────────────────────────────────
alter table public.courses
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id);

-- The server stamps who archived a course and when; clients cannot forge either.
create or replace function public.stamp_course_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    new.archived_at := now();
    new.archived_by := (select auth.uid());
  elsif new.archived_at is null then
    new.archived_by := null;
  else
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_course_archive on public.courses;
create trigger stamp_course_archive
  before update on public.courses
  for each row execute function public.stamp_course_archive();

-- Admins create and edit (including archive); only super admins delete.
drop policy if exists "courses_write_admin" on public.courses;
drop policy if exists "courses_insert_admin" on public.courses;
drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;
create policy "courses_insert_admin" on public.courses for insert to authenticated
  with check (public.is_admin());
create policy "courses_update_admin" on public.courses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "courses_delete_super_admin" on public.courses for delete to authenticated
  using (public.is_super_admin());

-- Learners cannot start new reading sessions or attempts on archived courses.
drop policy if exists "reading_insert_own" on public.reading_sessions;
create policy "reading_insert_own" on public.reading_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
  );

drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
  );

create or replace function public.get_quiz_questions(p_course_id uuid)
returns setof public.questions
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select q as question
    from public.questions q
    join public.courses c on c.id = q.course_id
    where q.course_id = p_course_id
      and c.is_active
      and c.archived_at is null
      and q.question_type = 'main_test'
      and q.is_active
  ),
  counts as (
    select count(*) filter (where (question).is_mandatory)::int as mandatory_count
    from eligible
  ),
  target as (
    select greatest(5, round(mandatory_count / 0.6)::int) as question_count
    from counts
  ),
  mandatory_questions as (
    select question, random() as random_order
    from eligible
    where (question).is_mandatory
  ),
  optional_questions as (
    select question, random() as random_order
    from eligible
    where not (question).is_mandatory
    order by random()
    limit greatest(0, (select question_count from target) - (select mandatory_count from counts))
  ),
  selected as (
    select * from mandatory_questions
    union all
    select * from optional_questions
  )
  select (question).*
  from selected
  order by random_order;
$$;

-- ── Records cannot be deleted ──────────────────────────────────────────────
-- Deleting a course or person used to cascade into their attempts and reading
-- sessions. RESTRICT makes the database refuse instead.
alter table public.quiz_attempts drop constraint if exists quiz_attempts_course_id_fkey;
alter table public.quiz_attempts
  add constraint quiz_attempts_course_id_fkey foreign key (course_id) references public.courses(id) on delete restrict;
alter table public.quiz_attempts drop constraint if exists quiz_attempts_user_id_fkey;
alter table public.quiz_attempts
  add constraint quiz_attempts_user_id_fkey foreign key (user_id) references public.profiles(id) on delete restrict;
alter table public.reading_sessions drop constraint if exists reading_sessions_course_id_fkey;
alter table public.reading_sessions
  add constraint reading_sessions_course_id_fkey foreign key (course_id) references public.courses(id) on delete restrict;
alter table public.reading_sessions drop constraint if exists reading_sessions_user_id_fkey;
alter table public.reading_sessions
  add constraint reading_sessions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete restrict;

-- ── Audit log ──────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log for select to authenticated
  using (public.is_admin());
-- No insert/update/delete policies: rows are written only by the triggers below.

create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The audit log is append-only';
end;
$$;

drop trigger if exists prevent_audit_log_changes on public.audit_log;
create trigger prevent_audit_log_changes
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_changes();

-- One trigger function records changes to every audited table.
create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_entity text := case tg_table_name
    when 'courses' then 'course'
    when 'profiles' then 'profile'
    when 'groups' then 'group'
    when 'group_members' then 'group_member'
    when 'course_assignments' then 'course_assignment'
    else tg_table_name end;
  v_action text := v_entity || '.' || lower(tg_op);
  v_entity_id uuid := (v_row->>'id')::uuid;
  v_details jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', v_old->key, 'to', value)), '{}'::jsonb)
      into v_details
      from jsonb_each(v_row)
      where v_old->key is distinct from value;
    if v_details = '{}'::jsonb then
      return new;
    end if;
    if tg_table_name = 'courses' and v_details ? 'archived_at' then
      v_action := case when new.archived_at is null then 'course.unarchived' else 'course.archived' end;
    elsif tg_table_name = 'profiles' then
      if not v_details ? 'role' then
        return new;
      end if;
      v_action := 'profile.role_changed';
    end if;
  else
    v_details := v_row;
  end if;

  if tg_table_name = 'group_members' then
    v_entity_id := (v_row->>'group_id')::uuid;
  end if;

  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, details)
  values (
    v_actor,
    (select full_name from public.profiles where id = v_actor),
    v_action,
    v_entity,
    v_entity_id,
    v_details
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_courses on public.courses;
create trigger audit_courses
  after insert or update or delete on public.courses
  for each row execute function public.audit_change();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after update on public.profiles
  for each row execute function public.audit_change();

commit;
