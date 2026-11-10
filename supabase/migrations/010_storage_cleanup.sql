-- 010 · Let admins delete course files
-- Supabase Storage only deletes (and lists) objects the caller can also select. The
-- course-pdfs and question-images buckets had insert, update and delete policies for admins
-- but no select policy, so every delete from the app reported success and removed nothing:
-- removed decks, deleted courses and replaced question images all left their files behind.
-- Both buckets are public, so this changes no one's read access to the files themselves;
-- it only lets admins find objects through the Storage API.
-- Files orphaned before this migration stay in the buckets; see the query at the end.
-- Requires setup.sql and requested-changes.sql. Undo: supabase/migrations/010_storage_cleanup.undo.sql

begin;

drop policy if exists "course_pdfs_admin_select" on storage.objects;
create policy "course_pdfs_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'course-pdfs' and public.is_admin());

drop policy if exists "question_images_admin_select" on storage.objects;
create policy "question_images_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

commit;

-- Optional: list files no deck or question uses any more (review before deleting them in
-- the Storage dashboard; attempt reviews may still show an old question image).
--   select o.bucket_id, o.name, o.created_at
--   from storage.objects o
--   where (o.bucket_id = 'course-pdfs'
--          and not exists (select 1 from public.course_materials m where m.pdf_url like '%/course-pdfs/' || o.name))
--      or (o.bucket_id = 'question-images'
--          and not exists (select 1 from public.questions q where q.image_url like '%/question-images/' || o.name)
--          and not exists (select 1 from public.attempt_questions a where a.image_url like '%/question-images/' || o.name))
--   order by o.created_at;
