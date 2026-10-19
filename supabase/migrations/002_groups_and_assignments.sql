-- 002 · Groups and course assignments
-- People belong to any number of groups. A course is assigned to a group (everyone
-- in it must complete it) or to one person. Assignments drive compliance.
-- Requires 001. Undo: supabase/migrations/002_groups_and_assignments.undo.sql

begin;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null default auth.uid(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint course_assignments_one_target check (num_nonnulls(group_id, user_id) = 1)
);
create unique index if not exists course_assignments_group_unique
  on public.course_assignments (course_id, group_id) where group_id is not null;
create unique index if not exists course_assignments_user_unique
  on public.course_assignments (course_id, user_id) where user_id is not null;
create index if not exists course_assignments_group_idx on public.course_assignments (group_id);
create index if not exists course_assignments_user_idx on public.course_assignments (user_id);

-- Who made a change is always the signed-in user, never a client-supplied value.
create or replace function public.stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_table_name = 'groups' then new.created_by := (select auth.uid());
    elsif tg_table_name = 'group_members' then new.added_by := (select auth.uid());
    elsif tg_table_name = 'course_assignments' then new.assigned_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_actor on public.groups;
create trigger stamp_actor before insert on public.groups
  for each row execute function public.stamp_actor();
drop trigger if exists stamp_actor on public.group_members;
create trigger stamp_actor before insert on public.group_members
  for each row execute function public.stamp_actor();
drop trigger if exists stamp_actor on public.course_assignments;
create trigger stamp_actor before insert on public.course_assignments
  for each row execute function public.stamp_actor();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.course_assignments enable row level security;

drop policy if exists "groups_select_all" on public.groups;
create policy "groups_select_all" on public.groups for select to authenticated using (true);
drop policy if exists "groups_write_admin" on public.groups;
create policy "groups_write_admin" on public.groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "group_members_select_own_or_reports" on public.group_members;
create policy "group_members_select_own_or_reports" on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());
drop policy if exists "group_members_write_admin" on public.group_members;
create policy "group_members_write_admin" on public.group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_assignments_select_own_or_reports" on public.course_assignments;
create policy "course_assignments_select_own_or_reports" on public.course_assignments for select to authenticated
  using (
    public.can_view_reports()
    or user_id = (select auth.uid())
    or group_id in (select gm.group_id from public.group_members gm where gm.user_id = (select auth.uid()))
  );
drop policy if exists "course_assignments_write_admin" on public.course_assignments;
create policy "course_assignments_write_admin" on public.course_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists audit_groups on public.groups;
create trigger audit_groups after insert or update or delete on public.groups
  for each row execute function public.audit_change();
drop trigger if exists audit_group_members on public.group_members;
create trigger audit_group_members after insert or delete on public.group_members
  for each row execute function public.audit_change();
drop trigger if exists audit_course_assignments on public.course_assignments;
create trigger audit_course_assignments after insert or delete on public.course_assignments
  for each row execute function public.audit_change();

insert into public.groups (name, description) values
  ('Maxx Employees', 'Maxx Orthopedics staff'),
  ('Normal Distributors', 'Distributors who complete the full course catalogue'),
  ('Titan Distributors', 'Distributors who complete a small set of assigned courses')
on conflict (name) do nothing;

commit;
