-- Undo 003 · View groups. WARNING: deletes all view groups.
-- Restores 002's group visibility (managers can read central groups again).

begin;

drop table if exists public.view_group_members;
drop table if exists public.view_groups;
drop function if exists public.required_courses();

drop policy if exists "course_assignments_select_own_or_admin" on public.course_assignments;
create policy "course_assignments_select_own_or_reports" on public.course_assignments for select to authenticated
  using (
    public.can_view_reports()
    or user_id = (select auth.uid())
    or group_id in (select gm.group_id from public.group_members gm where gm.user_id = (select auth.uid()))
  );

drop policy if exists "group_members_select_own_or_admin" on public.group_members;
create policy "group_members_select_own_or_reports" on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());

drop policy if exists "groups_select_admin_or_member" on public.groups;
create policy "groups_select_all" on public.groups for select to authenticated using (true);

drop trigger if exists on_auth_user_email_changed on auth.users;
drop function if exists public.sync_profile_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'learner');
  return new;
end;
$$;

alter table public.profiles drop column if exists email;

commit;
