-- Undo 014 · Video course materials
-- Removes video materials and puts reading back to PDF-only, as after 013.
-- The course-videos bucket and its files are left in place: delete the bucket in the
-- Supabase dashboard afterwards (Storage → course-videos → Delete bucket).

begin;

-- Finishing goes back to: every checkpoint answered and the minimum reading time.
create or replace function public.finish_reading(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
  v_session public.reading_sessions%rowtype;
  v_course public.courses%rowtype;
begin
  select * into v_session from public.reading_sessions
  where id = p_session_id and user_id = v_user
  for update;
  if not found then
    raise exception 'Reading session not found';
  end if;
  v_course := public.open_course(v_session.course_id);

  if not v_session.checkpoint_passed then
    if exists (
      select 1 from public.reading_session_questions rsq
      join public.questions q on q.id = rsq.question_id
      where rsq.session_id = p_session_id and q.is_active and rsq.answered_at is null
    ) then
      raise exception 'Answer every reading question first';
    end if;
    if now() + interval '5 seconds' < v_session.started_at + make_interval(secs => v_course.read_seconds) then
      raise exception 'The minimum reading time for this course is not complete yet';
    end if;
    update public.reading_sessions
    set checkpoint_passed = true, completed_at = now()
    where id = p_session_id;
  end if;

  return jsonb_build_object('certificate_id',
    (select id from public.certificates where user_id = v_user and course_id = v_course.id));
end;
$$;

drop function if exists public.mark_video_watched(uuid, uuid);

create or replace function public.issue_reading_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses%rowtype;
begin
  if not new.checkpoint_passed or (tg_op = 'UPDATE' and old.checkpoint_passed) then
    return new;
  end if;
  select * into v_course from public.courses where id = new.course_id;
  if not v_course.view_only then
    return new;
  end if;
  if v_course.archived_at is not null then
    raise exception 'This course has been archived';
  end if;
  -- A few seconds' grace: the reader's timer starts just before the session is saved.
  if now() + interval '5 seconds' < new.started_at + make_interval(secs => v_course.read_seconds) then
    raise exception 'The minimum reading time for this course is not complete yet';
  end if;

  insert into public.certificates (certificate_number, user_id, course_id, reading_session_id, recipient_name, course_title, course_code, issued_at)
  select
    'MXO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.certificate_number_seq')::text, 6, '0'),
    new.user_id, v_course.id, new.id, p.full_name, v_course.title, v_course.code, now()
  from public.profiles p
  where p.id = new.user_id
    and not exists (select 1 from public.certificates ce where ce.user_id = new.user_id and ce.course_id = new.course_id)
  on conflict (user_id, course_id) do nothing;
  return new;
end;
$$;
revoke all on function public.issue_reading_certificate() from public, anon, authenticated;

create or replace function public.reading_session_payload(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session_id', p_session_id,
    'questions', coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'material_id', q.material_id,
      'page_number', q.page_number,
      'question_text', q.question_text,
      'image_url', q.image_url,
      'options', q.options,
      'answered', rsq.answered_at is not null
    ) order by q.page_number, q.id), '[]'::jsonb)
  )
  from public.reading_session_questions rsq
  join public.questions q on q.id = rsq.question_id
  where rsq.session_id = p_session_id and q.is_active;
$$;
revoke all on function public.reading_session_payload(uuid) from public, anon, authenticated;

drop table if exists public.reading_session_videos;

create or replace function public.check_question_material()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.material_id is not null and not exists (
    select 1 from public.course_materials m where m.id = new.material_id and m.course_id = new.course_id
  ) then
    raise exception 'A reading question must use a deck from its own course';
  end if;
  return new;
end;
$$;

-- Video rows go (they have no reading questions), then the columns.
delete from public.course_materials where kind = 'video';
alter table public.course_materials drop constraint if exists course_materials_kind_check;
alter table public.course_materials alter column pdf_url set not null;
alter table public.course_materials
  drop column if exists duration_seconds,
  drop column if exists video_path,
  drop column if exists kind;

drop policy if exists "course_videos_read_signed_in" on storage.objects;
drop policy if exists "course_videos_admin_insert" on storage.objects;
drop policy if exists "course_videos_admin_update" on storage.objects;
drop policy if exists "course_videos_admin_delete" on storage.objects;
-- Supabase blocks deleting storage buckets from SQL, so the course-videos bucket stays.
-- Delete it in the dashboard (Storage → course-videos → Delete bucket), which also removes its files.

commit;
