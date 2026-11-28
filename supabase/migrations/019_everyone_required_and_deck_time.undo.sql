-- Undo 019 · Required-for-everyone courses and per-deck reading time.
-- Courses that were required for everyone go back to optional for everyone; per-deck times are
-- dropped, so every deck uses the course's time again.

begin;

-- As in 018.
create or replace function public.course_min_reading_seconds(p_course_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select c.read_seconds * (select count(*)::int from public.course_materials m where m.course_id = c.id and m.kind = 'pdf')
  from public.courses c
  where c.id = p_course_id;
$$;
revoke all on function public.course_min_reading_seconds(uuid) from public, anon, authenticated;

-- As in 015.
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
  ) pairs
  join public.courses c on c.id = pairs.course_id
  join public.profiles p on p.id = pairs.user_id
  where c.is_active and c.archived_at is null
    and p.archived_at is null
    and (public.can_view_reports() or (pairs.user_id = (select auth.uid()) and public.is_active_user()));
$$;

alter table public.course_materials drop constraint if exists course_materials_read_seconds_check;
alter table public.course_materials drop column if exists read_seconds;
alter table public.courses drop column if exists everyone_required;

commit;

notify pgrst, 'reload schema';
