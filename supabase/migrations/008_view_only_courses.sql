-- 008 · Reading-only courses
-- A reading-only course has no test: finishing the reading completes it and issues the
-- certificate. The database issues it only once the course's minimum reading time has
-- passed since the reading session started, and learners can't move that start time.
-- Requires 004 and 006. Undo: supabase/migrations/008_view_only_courses.undo.sql

begin;

alter table public.courses add column if not exists view_only boolean not null default false;

alter table public.certificates
  add column if not exists reading_session_id uuid references public.reading_sessions(id) on delete set null;

-- Learners create and update their own reading sessions, so the database sets started_at.
-- Direct database work (imports, tests) has no signed-in user and keeps its own values.
create or replace function public.protect_reading_started_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.started_at := case when tg_op = 'INSERT' then now() else old.started_at end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_reading_started_at on public.reading_sessions;
create trigger protect_reading_started_at
  before insert or update on public.reading_sessions
  for each row execute function public.protect_reading_started_at();

-- Finishing the reading of a reading-only course issues its certificate, unless the person
-- already has one. Finishing too early is refused, so the learner sees why.
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

drop trigger if exists issue_reading_certificate on public.reading_sessions;
create trigger issue_reading_certificate
  after insert or update of checkpoint_passed on public.reading_sessions
  for each row execute function public.issue_reading_certificate();

commit;
