-- Undo 011 · Server-side grading and reading checks
-- Puts back browser-side grading: learners write their own reading sessions and attempts
-- again, and the question functions return answers again. Deploy the matching older app
-- code with it. Attempts left "in_progress" by 011 stay; the older app ignores them.

begin;

drop trigger if exists alert_attempts_exhausted_on_submit on public.quiz_attempts;

drop function if exists public.submit_attempt(uuid, jsonb);
drop function if exists public.start_attempt(uuid);
drop function if exists public.finish_reading(uuid);
drop function if exists public.answer_reading_question(uuid, uuid, int);
drop function if exists public.start_reading(uuid);
drop function if exists public.reading_session_payload(uuid);
drop function if exists public.open_course(uuid);
drop function if exists public.current_learner();
drop table if exists public.reading_session_questions;

drop policy if exists "reading_insert_own" on public.reading_sessions;
create policy "reading_insert_own" on public.reading_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
  );
drop policy if exists "reading_update_own" on public.reading_sessions;
create policy "reading_update_own" on public.reading_sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.courses c where c.id = course_id and c.archived_at is null)
    and public.attempts_remaining(user_id, course_id) > 0
  );
drop policy if exists "attempts_update_own" on public.quiz_attempts;
create policy "attempts_update_own" on public.quiz_attempts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "attempt_q_select_own_or_reports" on public.attempt_questions;
create policy "attempt_q_select_own_or_reports" on public.attempt_questions for select to authenticated
  using (
    public.can_view_reports()
    or exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_questions.attempt_id and qa.user_id = (select auth.uid())
    )
  );
drop policy if exists "attempt_q_insert_own" on public.attempt_questions;
create policy "attempt_q_insert_own" on public.attempt_questions for insert to authenticated
  with check (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id and qa.user_id = (select auth.uid())
    )
  );

create or replace function public.get_quiz_questions(p_course_id uuid)
returns setof public.questions
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select q as question
    from public.questions q
    join public.courses c on c.id = q.course_id
    where q.course_id = p_course_id
      and c.is_active
      and c.archived_at is null
      and q.question_type = 'main_test'
      and q.is_active
  ),
  counts as (
    select count(*) filter (where (question).is_mandatory)::int as mandatory_count
    from eligible
  ),
  target as (
    select greatest(5, round(mandatory_count / 0.6)::int) as question_count
    from counts
  ),
  mandatory_questions as (
    select question, random() as random_order
    from eligible
    where (question).is_mandatory
  ),
  optional_questions as (
    select question, random() as random_order
    from eligible
    where not (question).is_mandatory
    order by random()
    limit greatest(0, (select question_count from target) - (select mandatory_count from counts))
  ),
  selected as (
    select * from mandatory_questions
    union all
    select * from optional_questions
  )
  select (question).*
  from selected
  order by random_order;
$$;

create or replace function public.get_reading_questions(p_course_id uuid, p_count int default 3)
returns setof public.questions
language sql
security definer
set search_path = ''
as $$
  select q.* from public.questions q
  join public.courses c on c.id = q.course_id
  where q.course_id = p_course_id
    and c.is_active
    and q.question_type = 'reading_test'
    and q.is_active
  order by random()
  limit greatest(0, least(coalesce(p_count, 3), 3));
$$;

revoke all on function public.get_quiz_questions(uuid) from public;
revoke all on function public.get_reading_questions(uuid, int) from public;
grant execute on function public.get_quiz_questions(uuid) to authenticated;
grant execute on function public.get_reading_questions(uuid, int) to authenticated;

commit;
