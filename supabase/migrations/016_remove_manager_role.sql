-- 016 · Remove the manager role
-- The portal has three roles now: learner, admin and super admin. Anyone who was a manager
-- becomes a learner (the change is written to the audit log), and the role can no longer be
-- given. can_view_reports() stays, because many rules use it, but now means "is an admin".
-- Watchlists stay: admins use them on the dashboard.
-- Requires 001 and 012. Undo: supabase/migrations/016_remove_manager_role.undo.sql

begin;

update public.profiles set role = 'learner' where role = 'manager';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('learner', 'admin', 'super_admin'));

-- Reports (dashboard, people, everyone's training records) are for admins only.
create or replace function public.can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin();
$$;

commit;
