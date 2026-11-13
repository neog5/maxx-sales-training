-- 013 · Course PDFs need a sign-in
-- The course-pdfs bucket stops being public: a file's old public link no longer works.
-- Signed-in people who aren't archived can read the files, and the app hands out
-- short-lived signed links for the reader and for AI question suggestions.
-- course_materials.pdf_url keeps the file's old public address; the app only uses it to
-- find the file's path in the bucket. Question images stay public.
-- Run this together with the app code that signs the links: the previous app version
-- can't open PDFs once this has run.
-- Requires 010 and 012. Undo: supabase/migrations/013_private_course_pdfs.undo.sql

begin;

update storage.buckets set public = false where id = 'course-pdfs';

drop policy if exists "course_pdfs_read_signed_in" on storage.objects;
create policy "course_pdfs_read_signed_in" on storage.objects for select to authenticated
  using (bucket_id = 'course-pdfs' and (select public.is_active_user()));

commit;
