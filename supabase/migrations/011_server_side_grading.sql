-- 011 · Server-side grading and reading checks
-- Learners used to grade their own assessments in the browser, save the result themselves,
-- and could edit their attempts and reading sessions afterwards. The browser also received
-- every correct answer before answering. Now the database does all of it:
--
--   start_reading(course)                 opens a reading session and picks its checkpoint questions
--   answer_reading_question(session, …)   checks one checkpoint answer
--   finish_reading(session)               needs every checkpoint answered and the minimum reading time
--   start_attempt(course)                 needs a finished reading; picks and stores the questions
--   submit_attempt(attempt, answers)      grades, saves, and only then returns the correct answers
--
-- Learners can no longer insert or update reading sessions, attempts or attempt questions
-- directly, and get_quiz_questions / get_reading_questions (which returned the answers) are gone.
--
-- Deploy together with the app code that calls these functions: the previous app version
-- can't save reading or attempts once this has run.
-- Undo: supabase/migrations/011_server_side_grading.undo.sql

begin;

-- ── Which checkpoint questions each reading session asks ─────────────────
create table if not exists public.reading_session_questions (
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answered_at timestamptz,
  primary key (session_id, question_id)
);
alter table public.reading_session_questions enable row level security;
-- No policies: only the functions below read and write it.

-- ── No more direct writes by learners ─────────────────────────────────────
drop policy if exists "reading_insert_own" on public.reading_sessions;
drop policy if exists "reading_update_own" on public.reading_sessions;
drop policy if exists "attempts_insert_own" on public.quiz_attempts;
drop policy if exists "attempts_update_own" on public.quiz_attempts;
drop policy if exists "attempt_q_insert_own" on public.attempt_questions;

-- Questions of an attempt still in progress include the correct answers, so nobody reads
-- them until the attempt is submitted. This also keeps unanswered rows out of reports.
drop policy if exists "attempt_q_select_own_or_reports" on public.attempt_questions;
create policy "attempt_q_select_own_or_reports" on public.attempt_questions for select to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_questions.attempt_id
        and qa.status = 'completed'
        and (qa.user_id = (select auth.uid()) or public.can_view_reports())
    )
  );

drop function if exists public.get_quiz_questions(uuid);
drop function if exists public.get_reading_questions(uuid, int);

-- ── Shared checks ─────────────────────────────────────────────────────────
-- The signed-in user, or an error.
create or replace function public.current_learner()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to continue';
  end if;
  return (select auth.uid());
end;
$$;

-- A course a learner may work on now: exists, visible (admins may preview hidden ones)
-- and not archived.
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

-- ── Reading ───────────────────────────────────────────────────────────────
-- A session's checkpoint questions, without their answers.
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

-- Reuses the person's unfinished session for the course, or starts one, and picks up to
-- three checkpoint questions for it the first time. Reusing keeps the same questions.
create or replace function public.start_reading(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
  v_course public.courses%rowtype := public.open_course(p_course_id);
  v_session uuid;
begin
  select id into v_session
  from public.reading_sessions
  where user_id = v_user and course_id = v_course.id and not checkpoint_passed
  order by started_at desc
  limit 1
  for update;

  if v_session is null then
    insert into public.reading_sessions (user_id, course_id) values (v_user, v_course.id)
    returning id into v_session;
  end if;

  if not exists (select 1 from public.reading_session_questions where session_id = v_session) then
    insert into public.reading_session_questions (session_id, question_id)
    select v_session, q.id
    from public.questions q
    where q.course_id = v_course.id and q.question_type = 'reading_test' and q.is_active
    order by random()
    limit 3;
  end if;

  return public.reading_session_payload(v_session);
end;
$$;

-- Checks one checkpoint answer. Wrong answers can be retried; the correct option is not
-- revealed.
create or replace function public.answer_reading_question(p_session_id uuid, p_question_id uuid, p_selected_index int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
  v_question public.questions%rowtype;
  v_correct boolean;
begin
  if not exists (
    select 1 from public.reading_sessions rs
    join public.reading_session_questions rsq on rsq.session_id = rs.id
    where rs.id = p_session_id and rs.user_id = v_user and not rs.checkpoint_passed
      and rsq.question_id = p_question_id
  ) then
    raise exception 'This reading question is not part of your reading session';
  end if;

  select * into v_question from public.questions where id = p_question_id;
  v_correct := p_selected_index is not distinct from v_question.correct_index;
  if v_correct then
    update public.reading_session_questions
    set answered_at = coalesce(answered_at, now())
    where session_id = p_session_id and question_id = p_question_id;
  end if;

  return jsonb_build_object('correct', v_correct, 'explanation', v_question.explanation);
end;
$$;

-- Finishes the reading once every checkpoint is answered and the course's minimum reading
-- time has passed since the session started. Reading-only courses then get their
-- certificate (issue_reading_certificate trigger). Returns the certificate id, if any.
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
    -- A few seconds' grace: the reader's timer starts just before the session is saved.
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

-- ── Assessment ────────────────────────────────────────────────────────────
-- Starts an attempt, or resumes the one in progress (same questions, so reloading doesn't
-- give a new set). Every mandatory question plus random others, about 60% mandatory with
-- at least five questions. Returns the questions without answers, or no attempt when the
-- course has no questions.
create or replace function public.start_attempt(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
  v_course public.courses%rowtype := public.open_course(p_course_id);
  v_attempt uuid;
  v_left int;
begin
  if v_course.view_only then
    raise exception 'This course has no assessment';
  end if;
  if not exists (
    select 1 from public.reading_sessions
    where user_id = v_user and course_id = v_course.id and checkpoint_passed
  ) then
    raise exception 'Finish the reading before starting the assessment';
  end if;

  -- One attempt at a time per person and course.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || v_course.id::text, 0));

  v_left := public.attempts_remaining(v_user, v_course.id);
  if v_left <= 0 then
    raise exception 'You have no attempts left for this course';
  end if;

  select id into v_attempt from public.quiz_attempts
  where user_id = v_user and course_id = v_course.id and status = 'in_progress'
  order by started_at desc
  limit 1;

  if v_attempt is null then
    if not exists (
      select 1 from public.questions
      where course_id = v_course.id and question_type = 'main_test' and is_active
    ) then
      return jsonb_build_object('attempt_id', null, 'attempts_left', v_left, 'questions', '[]'::jsonb);
    end if;

    insert into public.quiz_attempts (user_id, course_id, status)
    values (v_user, v_course.id, 'in_progress')
    returning id into v_attempt;

    with eligible as (
      select q.*, random() as random_order
      from public.questions q
      where q.course_id = v_course.id and q.question_type = 'main_test' and q.is_active
    ),
    counts as (
      select count(*) filter (where is_mandatory)::int as mandatory_count from eligible
    ),
    target as (
      select greatest(5, round(mandatory_count / 0.6)::int) as question_count from counts
    ),
    optional_questions as (
      select * from eligible
      where not is_mandatory
      order by random_order
      limit greatest(0, (select question_count from target) - (select mandatory_count from counts))
    ),
    selected as (
      select * from eligible where is_mandatory
      union all
      select * from optional_questions
    )
    insert into public.attempt_questions
      (attempt_id, position, question_id, question_text, image_url, is_mandatory, options, correct_index, explanation)
    select v_attempt, (row_number() over (order by random_order))::int - 1,
      id, question_text, image_url, is_mandatory, options, correct_index, explanation
    from selected;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'attempts_left', v_left,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', aq.id,
        'question_text', aq.question_text,
        'image_url', aq.image_url,
        'is_mandatory', aq.is_mandatory,
        'options', aq.options
      ) order by aq.position), '[]'::jsonb)
      from public.attempt_questions aq
      where aq.attempt_id = v_attempt
    )
  );
end;
$$;

-- Grades and saves an attempt. p_answers maps each attempt question id to the chosen
-- option's index, e.g. {"<id>": 2}. Returns the result, the correct answers and
-- explanations, the certificate (on a pass) and the attempts left.
create or replace function public.submit_attempt(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_learner();
  v_attempt public.quiz_attempts%rowtype;
  v_course public.courses%rowtype;
  v_total int;
  v_correct int;
  v_mandatory int;
  v_mandatory_correct int;
  v_score int;
  v_passed boolean;
begin
  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then
    raise exception 'Attempt not found';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'This attempt has already been submitted';
  end if;
  v_course := public.open_course(v_attempt.course_id);
  if public.attempts_remaining(v_user, v_course.id) <= 0 then
    raise exception 'You have no attempts left for this course';
  end if;

  -- Every question needs a whole-number answer that is one of its options.
  if exists (
    select 1
    from public.attempt_questions aq
    cross join lateral (
      select case when jsonb_typeof(p_answers -> aq.id::text) = 'number'
        then (p_answers ->> aq.id::text)::numeric end as answer
    ) a
    where aq.attempt_id = p_attempt_id
      and (a.answer is null or a.answer <> trunc(a.answer)
           or a.answer not between 0 and jsonb_array_length(aq.options) - 1)
  ) then
    raise exception 'Answer every question before submitting';
  end if;

  update public.attempt_questions aq
  set selected_index = (p_answers ->> aq.id::text)::int,
      is_correct = (p_answers ->> aq.id::text)::int = aq.correct_index
  where aq.attempt_id = p_attempt_id;

  select count(*)::int,
         count(*) filter (where is_correct)::int,
         count(*) filter (where is_mandatory)::int,
         count(*) filter (where is_mandatory and is_correct)::int
  into v_total, v_correct, v_mandatory, v_mandatory_correct
  from public.attempt_questions where attempt_id = p_attempt_id;

  v_score := case when v_total > 0 then round(v_correct * 100.0 / v_total)::int else 0 end;
  v_passed := v_total > 0 and v_score >= v_course.pass_threshold and v_mandatory_correct = v_mandatory;

  -- Completing the attempt issues the certificate on a pass (issue_certificate_on_pass).
  -- clock_timestamp(), not now(): the attempt limit compares submission times with
  -- approvals, which must stay in order even inside one transaction.
  update public.quiz_attempts
  set status = 'completed', submitted_at = clock_timestamp(), score = v_score, passed = v_passed
  where id = p_attempt_id;

  return jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'total', v_total,
    'correct_count', v_correct,
    'mandatory_count', v_mandatory,
    'mandatory_correct_count', v_mandatory_correct,
    'attempts_left', public.attempts_remaining(v_user, v_course.id),
    'certificate_id', (select id from public.certificates where user_id = v_user and course_id = v_course.id),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', aq.id,
        'question_text', aq.question_text,
        'image_url', aq.image_url,
        'is_mandatory', aq.is_mandatory,
        'options', aq.options,
        'correct_index', aq.correct_index,
        'explanation', aq.explanation,
        'selected_index', aq.selected_index,
        'is_correct', aq.is_correct
      ) order by aq.position), '[]'::jsonb)
      from public.attempt_questions aq
      where aq.attempt_id = p_attempt_id
    )
  );
end;
$$;

-- Attempts are now completed by an update, so email admins when that update uses up the
-- last attempt (the insert trigger from 009 stays for attempts loaded directly).
drop trigger if exists alert_attempts_exhausted_on_submit on public.quiz_attempts;
create trigger alert_attempts_exhausted_on_submit after update of status on public.quiz_attempts
  for each row when (old.status is distinct from 'completed' and new.status = 'completed' and new.passed = false)
  execute function public.alert_attempts_exhausted();

-- ── Who may call what ─────────────────────────────────────────────────────
revoke all on function public.current_learner() from public, anon;
revoke all on function public.open_course(uuid) from public, anon, authenticated;
revoke all on function public.reading_session_payload(uuid) from public, anon, authenticated;
revoke all on function public.start_reading(uuid) from public, anon;
revoke all on function public.answer_reading_question(uuid, uuid, int) from public, anon;
revoke all on function public.finish_reading(uuid) from public, anon;
revoke all on function public.start_attempt(uuid) from public, anon;
revoke all on function public.submit_attempt(uuid, jsonb) from public, anon;
grant execute on function public.start_reading(uuid) to authenticated;
grant execute on function public.answer_reading_question(uuid, uuid, int) to authenticated;
grant execute on function public.finish_reading(uuid) to authenticated;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;

commit;
