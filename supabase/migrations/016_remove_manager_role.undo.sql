-- Undo 016 · Remove the manager role
-- The manager role can be given again and managers can read reports. Who used to be a
-- manager is not restored: see the profile.role_changed entries in audit_log.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('learner', 'manager', 'admin', 'super_admin'));

create or replace function public.can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin', 'super_admin') and archived_at is null
  );
$$;

commit;
