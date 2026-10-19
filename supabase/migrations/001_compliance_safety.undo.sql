-- Undo 001 · Compliance safety. Run 002's undo first if 002 was applied.
-- Restores the previous roles, policies and cascading foreign keys.
-- WARNING: drops the audit log and archive columns (their data is lost).

begin;

drop trigger if exists audit_courses on public.courses;
drop trigger if exists audit_profiles on public.profiles;
drop function if exists public.audit_change();
drop table if exists public.audit_log;
drop function if exists public.prevent_audit_log_changes();

alter table public.quiz_attempts drop constraint if exists quiz_attempts_course_id_fkey;
alter table public.quiz_attempts
  add constraint quiz_attempts_course_id_fkey foreign key (course_id) references public.courses(id) on delete cascade;
alter table public.quiz_attempts drop constraint if exists quiz_attempts_user_id_fkey;
alter table public.quiz_attempts
  add constraint quiz_attempts_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.reading_sessions drop constraint if exists reading_sessions_course_id_fkey;
alter table public.reading_sessions
  add constraint reading_sessions_course_id_fkey foreign key (course_id) references public.courses(id) on delete cascade;
alter table public.reading_sessions drop constraint if exists reading_sessions_user_id_fkey;
alter table public.reading_sessions
  add constraint reading_sessions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

drop policy if exists "reading_insert_own" on public.reading_sessions;
create policy "reading_insert_own" on public.reading_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "courses_insert_admin" on public.courses;
drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_delete_super_admin" on public.courses;
create policy "courses_write_admin" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists stamp_course_archive on public.courses;
drop function if exists public.stamp_course_archive();
alter table public.courses drop column if exists archived_by;
alter table public.courses drop column if exists archived_at;

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

drop policy if exists "profiles_select_own_or_reports" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using ((id = auth.uid()) or public.is_admin());
drop policy if exists "attempts_select_own_or_reports" on public.quiz_attempts;
create policy "attempts_select_own_or_admin" on public.quiz_attempts for select to authenticated
  using ((user_id = auth.uid()) or public.is_admin());
drop policy if exists "reading_select_own_or_reports" on public.reading_sessions;
create policy "reading_select_own_or_admin" on public.reading_sessions for select to authenticated
  using ((user_id = auth.uid()) or public.is_admin());
drop policy if exists "attempt_q_select_own_or_reports" on public.attempt_questions;
create policy "attempt_q_select_own_or_admin" on public.attempt_questions for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.quiz_attempts qa
    where qa.id = attempt_questions.attempt_id and qa.user_id = auth.uid()
  ));

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
drop function if exists public.prevent_profile_privilege_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'rep');
  return new;
end;
$$;

drop function if exists public.can_view_reports();
drop function if exists public.is_super_admin();

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'admin' where role = 'super_admin';
update public.profiles set role = 'rep' where role in ('learner', 'manager');
alter table public.profiles alter column role set default 'rep';
alter table public.profiles add constraint profiles_role_check check (role in ('rep', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

commit;
