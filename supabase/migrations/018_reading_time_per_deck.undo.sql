-- Undo 018 · Minimum reading time per PDF deck. read_seconds goes back to being the time for
-- the whole course. The per-course times from before 018 are not restored (see the backup).

begin;

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
drop function if exists public.course_min_reading_seconds(uuid);
comment on column public.courses.read_seconds is null;

commit;
