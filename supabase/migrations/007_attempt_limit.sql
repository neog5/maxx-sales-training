-- 007 · Attempt limit
-- Replaces the escalating retry cooldown (fail_streak) with a simple rule: three failed
-- attempts per course, then an admin must approve more. Each approval gives a fresh three.
-- Passing the course also resets the count. lib/attempts.js mirrors this rule for the UI.
-- Undo: supabase/migrations/007_attempt_limit.undo.sql

begin;

alter table public.quiz_attempts drop column if exists fail_streak;

create table if not exists public.attempt_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);
create index if not exists attempt_unlocks_user_course_idx on public.attempt_unlocks (user_id, course_id, granted_at desc);

alter table public.attempt_unlocks enable row level security;
drop policy if exists "attempt_unlocks_select_own_or_reports" on public.attempt_unlocks;
create policy "attempt_unlocks_select_own_or_reports" on public.attempt_unlocks for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());
drop policy if exists "attempt_unlocks_admin_insert" on public.attempt_unlocks;
create policy "attempt_unlocks_admin_insert" on public.attempt_unlocks for insert to authenticated
  with check (public.is_admin() and granted_by = (select auth.uid()));
-- No update or delete: approvals are a permanent record.

drop trigger if exists audit_attempt_unlocks on public.attempt_unlocks;
create trigger audit_attempt_unlocks after insert on public.attempt_unlocks
  for each row execute function public.audit_change();

-- Attempts left for a person on a course. Returns null when asked about someone else
-- by a viewer who cannot see reports.
create or replace function public.attempts_remaining(p_user_id uuid, p_course_id uuid)
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when p_user_id is distinct from (select auth.uid()) and not public.can_view_reports() then null
    else greatest(0, 3 - (
      select count(*)::int
      from public.quiz_attempts qa
      where qa.user_id = p_user_id
        and qa.course_id = p_course_id
        and qa.status = 'completed'
        and not qa.passed
        and qa.submitted_at > greatest(
          coalesce((select max(u.granted_at) from public.attempt_unlocks u
                    where u.user_id = p_user_id and u.course_id = p_course_id), '-infinity'),
          coalesce((select max(p.submitted_at) from public.quiz_attempts p
                    where p.user_id = p_user_id and p.course_id = p_course_id
                      and p.status = 'completed' and p.passed), '-infinity')
        )
    ))
  end;
$$;

-- Learners cannot save an attempt once they are out of attempts.
drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
    and public.attempts_remaining(user_id, course_id) > 0
  );

commit;
