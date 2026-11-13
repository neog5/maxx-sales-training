-- Undo 013 · Course PDFs need a sign-in
-- Makes the course-pdfs bucket public again, so the stored public links work as before.

begin;

drop policy if exists "course_pdfs_read_signed_in" on storage.objects;
update storage.buckets set public = true where id = 'course-pdfs';

commit;
