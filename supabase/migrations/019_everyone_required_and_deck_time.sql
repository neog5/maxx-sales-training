-- 019 · Required-for-everyone courses, and a minimum reading time per deck
-- 1. A course open to everyone can now also be REQUIRED for everyone
--    (courses.everyone_required). It then counts in every active person's required courses
--    and compliance, without being given to each group. It only applies while
--    audience = 'everyone'; the app clears it when the course is given to chosen people again.
-- 2. A PDF deck can have its own minimum reading time (course_materials.read_seconds). When it's
--    empty the deck uses the course's read_seconds, as before. The least time a reading session
--    must last is the sum of every PDF deck's time.
-- Requires 015 and 018. Undo: supabase/migrations/019_everyone_required_and_deck_time.undo.sql

begin;

alter table public.courses
  add column if not exists everyone_required boolean not null default false;
comment on column public.courses.everyone_required is
  'When audience = everyone: true makes the course required for every active person, false leaves it optional.';

alter table public.course_materials
  add column if not exists read_seconds int;
alter table public.course_materials drop constraint if exists course_materials_read_seconds_check;
alter table public.course_materials add constraint course_materials_read_seconds_check
  check (read_seconds is null or (read_seconds >= 0 and kind = 'pdf'));
comment on column public.course_materials.read_seconds is
  'Minimum reading time for this PDF deck, in seconds. Empty = the course''s read_seconds.';

-- The least time a reading session must last: every PDF deck's own time, or the course's.
create or replace function public.course_min_reading_seconds(p_course_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce(m.read_seconds, c.read_seconds)), 0)::int
  from public.courses c
  join public.course_materials m on m.course_id = c.id and m.kind = 'pdf'
  where c.id = p_course_id;
$$;
revoke all on function public.course_min_reading_seconds(uuid) from public, anon, authenticated;

-- As in 015, plus courses open to everyone and required for everyone.
create or replace function public.required_courses()
returns table (user_id uuid, course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct pairs.user_id, pairs.course_id
  from (
    select ca.user_id, ca.course_id from public.course_assignments ca where ca.user_id is not null and ca.required
    union all
    select gm.user_id, ca.course_id
    from public.course_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
    where ca.required
    union all
    select everyone.id, required_course.id
    from public.courses required_course
    cross join public.profiles everyone
    where required_course.audience = 'everyone' and required_course.everyone_required
  ) pairs
  join public.courses c on c.id = pairs.course_id
  join public.profiles p on p.id = pairs.user_id
  where c.is_active and c.archived_at is null
    and p.archived_at is null
    and (public.can_view_reports() or (pairs.user_id = (select auth.uid()) and public.is_active_user()));
$$;

commit;

notify pgrst, 'reload schema';
