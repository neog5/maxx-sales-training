-- Undo 010 · Let admins delete course files
-- Deletes from the app go back to silently removing nothing.

begin;

drop policy if exists "course_pdfs_admin_select" on storage.objects;
drop policy if exists "question_images_admin_select" on storage.objects;

commit;
