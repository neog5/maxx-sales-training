-- 006 · Multi-deck courses
-- A course can have several reading decks (PDFs), read in order. Each course's existing
-- PDF becomes its first deck, and reading questions now say which deck their page is in.
-- courses.pdf_url is removed: course_materials is the only place a course's PDFs are listed.
-- Undo: supabase/migrations/006_course_materials.undo.sql (keeps only each course's first deck).

begin;

create table if not exists public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null check (position > 0),
  title text not null check (length(trim(title)) > 0),
  pdf_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists course_materials_course_idx on public.course_materials (course_id, position);

alter table public.course_materials enable row level security;
-- Anyone who can see the course can see its decks (the courses policy applies inside exists).
drop policy if exists "course_materials_select_visible_course" on public.course_materials;
create policy "course_materials_select_visible_course" on public.course_materials for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id));
drop policy if exists "course_materials_admin_insert" on public.course_materials;
create policy "course_materials_admin_insert" on public.course_materials for insert to authenticated
  with check (public.is_admin());
drop policy if exists "course_materials_admin_update" on public.course_materials;
create policy "course_materials_admin_update" on public.course_materials for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "course_materials_admin_delete" on public.course_materials;
create policy "course_materials_admin_delete" on public.course_materials for delete to authenticated
  using (public.is_admin());

-- Adding and removing decks shows in the course history. Renames and reordering are not recorded.
drop trigger if exists audit_course_materials on public.course_materials;
create trigger audit_course_materials after insert or delete on public.course_materials
  for each row execute function public.audit_change();

-- Move each course's PDF into its first deck, without logging these as admin changes.
alter table public.course_materials disable trigger audit_course_materials;
insert into public.course_materials (course_id, position, title, pdf_url)
select c.id, 1, c.title, c.pdf_url
from public.courses c
where c.pdf_url is not null
  and not exists (select 1 from public.course_materials m where m.course_id = c.id);
alter table public.course_materials enable trigger audit_course_materials;

-- Reading questions belong to a deck; removing a deck removes its reading questions.
-- Past attempts keep their own copy of every question, so no history is lost.
alter table public.questions
  add column if not exists material_id uuid references public.course_materials(id) on delete cascade;
create index if not exists questions_material_idx on public.questions (material_id);

update public.questions q
set material_id = m.id
from public.course_materials m
where q.question_type = 'reading_test'
  and q.material_id is null
  and m.course_id = q.course_id
  and m.position = 1;

-- A reading question with no deck to point at can never be shown, so it is removed.
delete from public.questions where question_type = 'reading_test' and material_id is null;

alter table public.questions drop constraint if exists questions_material_reading_check;
alter table public.questions add constraint questions_material_reading_check check (
  (question_type = 'reading_test' and material_id is not null)
  or (question_type = 'main_test' and material_id is null)
);

-- A reading question's deck must belong to the same course.
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

drop trigger if exists check_question_material on public.questions;
create trigger check_question_material
  before insert or update of material_id, course_id on public.questions
  for each row execute function public.check_question_material();

alter table public.courses drop column if exists pdf_url;

commit;
