-- 015 · Who can see a course
-- Some courses must never reach competing distributor groups, so courses are now hidden by
-- default. A course's `audience` is either:
--   'assigned' (the default): only admins and the people and groups it is given to can see it;
--   'everyone': every signed-in person can see it (an admin has to choose this on purpose).
-- `is_active` stays as the on/off switch: a course that isn't active is hidden from everyone
-- but admins, whatever its audience.
--
-- Giving a course to a group or person (course_assignments) is now either required (counts
-- toward their requirements, as before) or optional (`required = false`: they can see and
-- take it, but it isn't required).
--
-- The database enforces this, not just the app: the course row, its decks and videos, the
-- stored files, and starting or continuing a reading session or an assessment.
-- People keep seeing the title of a course they have their own history in (a reading session,
-- an attempt or a certificate), so their profile still makes sense after access is taken away,
-- but they can no longer open it.
--
-- Every existing course becomes 'assigned', so only people it is already given to keep it.
-- Requires 002, 006, 011, 012, 013 and 014. Undo: supabase/migrations/015_course_audience.undo.sql

begin;

-- ── Columns ───────────────────────────────────────────────────────────────
alter table public.courses
  add column if not exists audience text not null default 'assigned';
alter table public.courses drop constraint if exists courses_audience_check;
alter table public.courses
  add constraint courses_audience_check check (audience in ('assigned', 'everyone'));

alter table public.course_assignments
  add column if not exists required boolean not null default true;

-- ── Access checks ─────────────────────────────────────────────────────────
-- True when the signed-in person may open the course: admins always; others only when the
-- course is switched on and is for everyone, or given to them directly or through a group.
create or replace function public.can_open_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (
    public.is_active_user() and exists (
      select 1 from public.courses c
      where c.id = p_course_id and c.is_active
        and (
          c.audience = 'everyone'
          or exists (
            select 1 from public.course_assignments ca
            where ca.course_id = c.id
              and (ca.user_id = (select auth.uid())
                or ca.group_id in (select gm.group_id from public.group_members gm where gm.user_id = (select auth.uid())))
          )
        )
    )
  );
$$;

-- True when the signed-in person may see the course row: anyone who can open it, plus anyone
-- with their own history in it.
create or replace function public.can_see_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_open_course(p_course_id) or (
    public.is_active_user() and (
      exists (select 1 from public.reading_sessions r where r.course_id = p_course_id and r.user_id = (select auth.uid()))
      or exists (select 1 from public.quiz_attempts a where a.course_id = p_course_id and a.user_id = (select auth.uid()))
      or exists (select 1 from public.certificates ce where ce.course_id = p_course_id and ce.user_id = (select auth.uid()))
    )
  );
$$;

-- `can_open` on a course row, for the app: select("id, title, can_open").
create or replace function public.can_open(public.courses)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_open_course($1.id);
$$;

revoke all on function public.can_open_course(uuid) from public, anon;
revoke all on function public.can_see_course(uuid) from public, anon;
revoke all on function public.can_open(public.courses) from public, anon;
grant execute on function public.can_open_course(uuid) to authenticated;
grant execute on function public.can_see_course(uuid) to authenticated;
grant execute on function public.can_open(public.courses) to authenticated;

-- ── Row rules ─────────────────────────────────────────────────────────────
drop policy if exists "courses_select_all" on public.courses;
drop policy if exists "courses_select_active_or_admin" on public.courses;
drop policy if exists "courses_select_allowed" on public.courses;
create policy "courses_select_allowed" on public.courses for select to authenticated
  using (public.can_see_course(id));

drop policy if exists "course_materials_select_visible_course" on public.course_materials;
drop policy if exists "course_materials_select_allowed" on public.course_materials;
create policy "course_materials_select_allowed" on public.course_materials for select to authenticated
  using (public.can_open_course(course_id));

-- ── Stored files ──────────────────────────────────────────────────────────
-- A file can be read (and so signed) only by someone who can open a course that uses it.
drop policy if exists "course_pdfs_read_signed_in" on storage.objects;
drop policy if exists "course_pdfs_read_allowed" on storage.objects;
create policy "course_pdfs_read_allowed" on storage.objects for select to authenticated
  using (
    bucket_id = 'course-pdfs' and exists (
      select 1 from public.course_materials m
      where m.kind = 'pdf'
        and right(m.pdf_url, length(objects.name) + 13) = '/course-pdfs/' || objects.name
        and public.can_open_course(m.course_id)
    )
  );

drop policy if exists "course_videos_read_signed_in" on storage.objects;
drop policy if exists "course_videos_read_allowed" on storage.objects;
create policy "course_videos_read_allowed" on storage.objects for select to authenticated
  using (
    bucket_id = 'course-videos' and exists (
      select 1 from public.course_materials m
      where m.kind = 'video' and m.video_path = objects.name and public.can_open_course(m.course_id)
    )
  );

-- course-videos had no admin read rule because the signed-in rule covered admins.
drop policy if exists "course_videos_admin_select" on storage.objects;
create policy "course_videos_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'course-videos' and public.is_admin());

-- ── Reading and assessments ───────────────────────────────────────────────
-- As in 011, but the course must be one this person can open.
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
  if not found or not public.can_open_course(p_course_id) then
    raise exception 'This course is not available';
  end if;
  if v_course.archived_at is not null then
    raise exception 'This course has been archived';
  end if;
  return v_course;
end;
$$;

revoke all on function public.open_course(uuid) from public, anon, authenticated;

-- ── Required courses ──────────────────────────────────────────────────────
-- As in 012, but optional assignments don't count.
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

-- ── Audit ─────────────────────────────────────────────────────────────────
-- As in 012, plus: switching an assignment between required and optional is logged, with the
-- course and target, so it shows in the course's history.
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
    when 'invites' then 'invite'
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
      if v_details ? 'archived_at' then
        v_action := case when new.archived_at is null then 'profile.unarchived' else 'profile.archived' end;
      elsif v_details ? 'role' then
        v_action := 'profile.role_changed';
      else
        return new;
      end if;
    elsif tg_table_name = 'course_assignments' then
      v_details := v_details || jsonb_build_object('course_id', new.course_id, 'group_id', new.group_id, 'user_id', new.user_id);
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

drop trigger if exists audit_course_assignments on public.course_assignments;
create trigger audit_course_assignments after insert or update or delete on public.course_assignments
  for each row execute function public.audit_change();

notify pgrst, 'reload schema';

commit;
