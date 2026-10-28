-- Undo 006 · Multi-deck courses. Each course keeps only its first deck as its PDF.
-- Reading questions on later decks are deleted, and the PDF files of later decks stay
-- in the course-pdfs bucket (remove them by hand if they are no longer needed).

begin;

alter table public.courses add column if not exists pdf_url text;
-- Restoring the column is not an admin edit, so keep it out of the course history.
alter table public.courses disable trigger audit_courses;
update public.courses c
set pdf_url = m.pdf_url
from public.course_materials m
where m.course_id = c.id
  and m.id = (select id from public.course_materials where course_id = c.id order by position, created_at limit 1);
alter table public.courses enable trigger audit_courses;

delete from public.questions q
using public.course_materials m
where q.material_id = m.id
  and m.id <> (select id from public.course_materials where course_id = m.course_id order by position, created_at limit 1);

drop trigger if exists check_question_material on public.questions;
drop function if exists public.check_question_material();
alter table public.questions drop constraint if exists questions_material_reading_check;
alter table public.questions drop column if exists material_id;

drop table if exists public.course_materials;

commit;
