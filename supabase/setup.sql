-- Rep Training Portal database setup
-- Run once in the Supabase SQL editor for a new project, then run seed.sql.

begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'rep' check (role in ('rep', 'admin')),
  region text,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  pdf_url text,
  pass_threshold int not null default 80 check (pass_threshold between 0 and 100),
  read_seconds int not null default 60 check (read_seconds >= 0),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  question_type text not null default 'main_test' check (question_type in ('main_test', 'reading_test')),
  page_number int,
  question_text text not null,
  image_url text,
  is_mandatory boolean not null default false,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_index int not null check (correct_index >= 0),
  explanation text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint questions_page_number_check check (
    (question_type = 'main_test' and page_number is null)
    or (question_type = 'reading_test' and page_number > 0)
  ),
  constraint questions_mandatory_main_test_check check (
    not is_mandatory or question_type = 'main_test'
  ),
  constraint questions_correct_index_check check (correct_index < jsonb_array_length(options))
);

create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  checkpoint_passed boolean not null default false
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int check (score between 0 and 100),
  passed boolean,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  fail_streak int not null default 0 check (fail_streak >= 0)
);

create table public.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  question_text text not null,
  image_url text,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_index int not null check (correct_index >= 0 and correct_index < jsonb_array_length(options)),
  explanation text not null,
  selected_index int,
  is_correct boolean
);

create index questions_course_type_active_idx on public.questions (course_id, question_type, is_active);
create index reading_sessions_user_course_idx on public.reading_sessions (user_id, course_id);
create index quiz_attempts_user_course_submitted_idx on public.quiz_attempts (user_id, course_id, submitted_at desc);
create index attempt_questions_attempt_idx on public.attempt_questions (attempt_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.questions enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_questions enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change profile roles';
  end if;
  return new;
end;
$$;

create trigger prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

create policy "courses_select_active_or_admin" on public.courses for select to authenticated
  using (is_active or public.is_admin());
create policy "courses_insert_admin" on public.courses for insert to authenticated
  with check (public.is_admin());
create policy "courses_update_admin" on public.courses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "courses_delete_admin" on public.courses for delete to authenticated
  using (public.is_admin());

create policy "questions_admin_all" on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "reading_select_own_or_admin" on public.reading_sessions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "reading_insert_own" on public.reading_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "reading_update_own" on public.reading_sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "attempts_select_own_or_admin" on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "attempts_update_own" on public.quiz_attempts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "attempt_q_select_own_or_admin" on public.attempt_questions for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id and qa.user_id = (select auth.uid())
    )
  );
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
      and q.question_type = 'main_test'
      and q.is_active
  ),
  counts as (
    select count(*) filter (where (question).is_mandatory)::int as mandatory_count
    from eligible
  ),
  target as (
    -- Mandatory questions make up approximately 60% of the assessment. The
    -- five-question floor retains the minimum assessment size.
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'User'), 'rep');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-pdfs', 'course-pdfs', true, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "course_pdfs_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-pdfs' and public.is_admin());
create policy "course_pdfs_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'course-pdfs' and public.is_admin())
  with check (bucket_id = 'course-pdfs' and public.is_admin());
create policy "course_pdfs_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-pdfs' and public.is_admin());

create policy "question_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin())
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

commit;
