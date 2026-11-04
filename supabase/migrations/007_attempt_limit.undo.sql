-- Undo 007 · Attempt limit. Removes the three-attempt limit and admin approvals and brings
-- back the fail_streak column used by the old retry cooldown (existing rows start at 0).

begin;

drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
  );

drop function if exists public.attempts_remaining(uuid, uuid);
drop table if exists public.attempt_unlocks;

alter table public.quiz_attempts
  add column if not exists fail_streak int not null default 0 check (fail_streak >= 0);

commit;
