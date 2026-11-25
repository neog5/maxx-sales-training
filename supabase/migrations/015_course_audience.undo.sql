-- Undo 015 · Who can see a course
-- Every signed-in person can see every course and open any active one again, and every
-- assignment counts as required. Which courses were for everyone, and which assignments were
-- optional, is lost. Audit entries stay.

begin;

drop trigger if exists audit_course_assignments on public.course_assignments;
create trigger audit_course_assignments after insert or delete on public.course_assignments
  for each row execute function public.audit_change();

-- audit_change keeps the 015 version: its extra branch only runs for assignment updates,
-- which are no longer logged.

drop policy if exists "courses_select_allowed" on public.courses;
create policy "courses_select_all" on public.courses for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "course_materials_select_allowed" on public.course_materials;
create policy "course_materials_select_visible_course" on public.course_materials for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id));

drop policy if exists "course_pdfs_read_allowed" on storage.objects;
create policy "course_pdfs_read_signed_in" on storage.objects for select to authenticated
  using (bucket_id = 'course-pdfs' and (select public.is_active_user()));

drop policy if exists "course_videos_read_allowed" on storage.objects;
drop policy if exists "course_videos_admin_select" on storage.objects;
create policy "course_videos_read_signed_in" on storage.objects for select to authenticated
  using (bucket_id = 'course-videos' and (select public.is_active_user()));

create or replace function public.open_course(p_course_id uuid)
returns public.courses
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course public.courses%rowtype;
begin
  select * into v_course from public.courses where id = p_course_id;
  if not found or not (v_course.is_active or public.is_admin()) then
    raise exception 'This course is not available';
  end if;
  if v_course.archived_at is not null then
    raise exception 'This course has been archived';
  end if;
  return v_course;
end;
$$;
revoke all on function public.open_course(uuid) from public, anon, authenticated;

create or replace function public.required_courses()
returns table (user_id uuid, course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct pairs.user_id, pairs.course_id
  from (
    select ca.user_id, ca.course_id from public.course_assignments ca where ca.user_id is not null
    union all
    select gm.user_id, ca.course_id
    from public.course_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
  ) pairs
  join public.courses c on c.id = pairs.course_id
  join public.profiles p on p.id = pairs.user_id
  where c.is_active and c.archived_at is null
    and p.archived_at is null
    and (public.can_view_reports() or (pairs.user_id = (select auth.uid()) and public.is_active_user()));
$$;

drop function if exists public.can_open(public.courses);
drop function if exists public.can_see_course(uuid);
drop function if exists public.can_open_course(uuid);

alter table public.course_assignments drop column if exists required;
alter table public.courses drop constraint if exists courses_audience_check;
alter table public.courses drop column if exists audience;

notify pgrst, 'reload schema';

commit;
