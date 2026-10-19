-- Undo 002 · Groups and course assignments.
-- WARNING: deletes all groups, memberships and course assignments.

begin;

drop table if exists public.course_assignments;
drop table if exists public.group_members;
drop table if exists public.groups;
drop function if exists public.stamp_actor();

commit;
