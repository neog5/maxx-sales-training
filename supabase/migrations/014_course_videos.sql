-- 014 · Video course materials
-- A course's reading materials can now be videos as well as PDF decks, in any mix, including
-- video-only courses. Videos live in a new private course-videos bucket (MP4, up to 2 GB) and
-- are played through short-lived signed links, like the PDFs since 013.
--
-- Videos have no checkpoint questions and no minimum time: a video counts as watched once the
-- learner reaches its end (skipping ahead is allowed). finish_reading now needs every video
-- watched, and only applies the course's minimum reading time when the course has a PDF.
--
-- The project's global upload limit (Supabase dashboard → Storage → Settings) must be at least
-- 2 GB for the bucket limit to take effect.
-- Requires 006, 011, 012 and 013. Undo: supabase/migrations/014_course_videos.undo.sql

begin;

-- ── Bucket ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-videos', 'course-videos', false, 2147483648, array['video/mp4'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Admins upload, replace and delete; signed-in people who aren't archived can watch (as with course-pdfs).
drop policy if exists "course_videos_read_signed_in" on storage.objects;
create policy "course_videos_read_signed_in" on storage.objects for select to authenticated
  using (bucket_id = 'course-videos' and (select public.is_active_user()));
drop policy if exists "course_videos_admin_insert" on storage.objects;
create policy "course_videos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-videos' and public.is_admin());
drop policy if exists "course_videos_admin_update" on storage.objects;
create policy "course_videos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'course-videos' and public.is_admin())
  with check (bucket_id = 'course-videos' and public.is_admin());
drop policy if exists "course_videos_admin_delete" on storage.objects;
create policy "course_videos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-videos' and public.is_admin());

-- ── Materials: PDF or video ───────────────────────────────────────────────
alter table public.course_materials
  add column if not exists kind text not null default 'pdf',
  add column if not exists video_path text,
  add column if not exists duration_seconds int;
alter table public.course_materials alter column pdf_url drop not null;

alter table public.course_materials drop constraint if exists course_materials_kind_check;
alter table public.course_materials add constraint course_materials_kind_check check (
  (kind = 'pdf' and pdf_url is not null and video_path is null and duration_seconds is null)
  or (kind = 'video' and video_path is not null and pdf_url is null
      and (duration_seconds is null or duration_seconds > 0))
);

-- ── Reading questions only go on PDFs ─────────────────────────────────────
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
  if new.material_id is not null and exists (
    select 1 from public.course_materials m where m.id = new.material_id and m.kind <> 'pdf'
  ) then
    raise exception 'Reading questions can only go on a PDF deck, not a video';
  end if;
  return new;
end;
$$;

-- ── Which videos each reading session has watched to the end ──────────────
create table if not exists public.reading_session_videos (
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  material_id uuid not null references public.course_materials(id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (session_id, material_id)
);
alter table public.reading_session_videos enable row level security;
-- No policies: only the functions below read and write it.

-- A session's checkpoint questions (without answers) and the videos already watched.
create or replace function public.reading_session_payload(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session_id', p_session_id,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'material_id', q.material_id,
        'page_number', q.page_number,
        'question_text', q.question_text,
        'image_url', q.image_url,
        'options', q.options,
        'answered', rsq.answered_at is not null
      ) order by q.page_number, q.id)
      from public.reading_session_questions rsq
      join public.questions q on q.id = rsq.question_id
      where rsq.session_id = p_session_id and q.is_active
    ), '[]'::jsonb),
    'watched_videos', coalesce((
      select jsonb_agg(rsv.material_id order by rsv.watched_at)
      from public.reading_session_videos rsv
      where rsv.session_id = p_session_id
    ), '[]'::jsonb)
  );
$$;

-- Records that the learner reached the end of one of the course's videos.
create or replace function public.mark_video_watched(p_session_id uuid, p_material_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
begin
  if not exists (
    select 1 from public.reading_sessions rs
    join public.course_materials m on m.course_id = rs.course_id
    where rs.id = p_session_id and rs.user_id = v_user and not rs.checkpoint_passed
      and m.id = p_material_id and m.kind = 'video'
  ) then
    raise exception 'This video is not part of your reading session';
  end if;

  insert into public.reading_session_videos (session_id, material_id)
  values (p_session_id, p_material_id)
  on conflict do nothing;

  return public.reading_session_payload(p_session_id);
end;
$$;

-- Finishes the reading once every checkpoint is answered, every video has been watched to
-- the end and, when the course has a PDF, its minimum reading time has passed since the
-- session started. Reading-only courses then get their certificate
-- (issue_reading_certificate trigger). Returns the certificate id, if any.
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
    if exists (
      select 1 from public.course_materials m
      where m.course_id = v_course.id and m.kind = 'video'
        and not exists (
          select 1 from public.reading_session_videos rsv
          where rsv.session_id = p_session_id and rsv.material_id = m.id
        )
    ) then
      raise exception 'Watch every video to the end first';
    end if;
    -- Videos have no minimum time, so a video-only course skips this check.
    -- A few seconds' grace: the reader's timer starts just before the session is saved.
    if exists (select 1 from public.course_materials m where m.course_id = v_course.id and m.kind = 'pdf')
      and now() + interval '5 seconds' < v_session.started_at + make_interval(secs => v_course.read_seconds) then
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

-- Reading-only courses get their certificate when the reading is finished (from 008). The
-- minimum reading time now only applies when the course has a PDF, matching finish_reading.
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
  -- Videos have no minimum time, so a video-only course skips this check.
  -- A few seconds' grace: the reader's timer starts just before the session is saved.
  if exists (select 1 from public.course_materials m where m.course_id = v_course.id and m.kind = 'pdf')
    and now() + interval '5 seconds' < new.started_at + make_interval(secs => v_course.read_seconds) then
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
revoke all on function public.reading_session_payload(uuid) from public, anon, authenticated;
revoke all on function public.mark_video_watched(uuid, uuid) from public, anon;
revoke all on function public.finish_reading(uuid) from public, anon;
grant execute on function public.mark_video_watched(uuid, uuid) to authenticated;
grant execute on function public.finish_reading(uuid) to authenticated;

commit;
