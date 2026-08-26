-- Apply this migration to an existing portal database.

begin;

alter table public.questions
  add column if not exists image_url text,
  add column if not exists is_mandatory boolean not null default false;

alter table public.questions
  drop constraint if exists questions_mandatory_main_test_check;
alter table public.questions
  add constraint questions_mandatory_main_test_check
  check (not is_mandatory or question_type = 'main_test');

alter table public.attempt_questions
  add column if not exists image_url text;

drop function if exists public.get_quiz_questions(uuid, int);

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

revoke all on function public.get_quiz_questions(uuid) from public;
grant execute on function public.get_quiz_questions(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question_images_admin_insert" on storage.objects;
drop policy if exists "question_images_admin_update" on storage.objects;
drop policy if exists "question_images_admin_delete" on storage.objects;
create policy "question_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin())
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

commit;
