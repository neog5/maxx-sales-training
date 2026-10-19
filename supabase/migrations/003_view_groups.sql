-- 003 · Private view groups, searchable emails, and manager scoping
-- View groups are personal lists (like favourites) that managers, admins and super
-- admins create to watch a team's compliance. Only the creator can see one.
-- Central groups (002) become admin-only, apart from a person's own memberships.
-- Requires 002. Undo: supabase/migrations/003_view_groups.undo.sql

begin;

-- ── Emails on profiles, for search and disambiguation ─────────────────────
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'learner', new.email);
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ── Central groups: admins see everything, everyone else only their own ────
drop policy if exists "groups_select_all" on public.groups;
drop policy if exists "groups_select_admin_or_member" on public.groups;
create policy "groups_select_admin_or_member" on public.groups for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = (select auth.uid()))
  );

drop policy if exists "group_members_select_own_or_reports" on public.group_members;
drop policy if exists "group_members_select_own_or_admin" on public.group_members;
create policy "group_members_select_own_or_admin" on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "course_assignments_select_own_or_reports" on public.course_assignments;
drop policy if exists "course_assignments_select_own_or_admin" on public.course_assignments;
create policy "course_assignments_select_own_or_admin" on public.course_assignments for select to authenticated
  using (
    public.is_admin()
    or user_id = (select auth.uid())
    or group_id in (select gm.group_id from public.group_members gm where gm.user_id = (select auth.uid()))
  );

-- Who must complete which course, with groups already expanded. Managers use this for
-- compliance without seeing how central groups are organised. Learners get their own rows.
create or replace function public.required_courses()
returns table (user_id uuid, course_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select distinct pairs.user_id, pairs.course_id
  from (
    select ca.user_id, ca.course_id from public.course_assignments ca where ca.user_id is not null
    union all
    select gm.user_id, ca.course_id
    from public.course_assignments ca
    join public.group_members gm on gm.group_id = ca.group_id
  ) pairs
  join public.courses c on c.id = pairs.course_id
  where c.is_active and c.archived_at is null
    and (public.can_view_reports() or pairs.user_id = (select auth.uid()));
$$;

-- ── View groups ────────────────────────────────────────────────────────────
create table if not exists public.view_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.view_group_members (
  view_group_id uuid not null references public.view_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (view_group_id, user_id)
);
create index if not exists view_group_members_user_idx on public.view_group_members (user_id);

alter table public.view_groups enable row level security;
alter table public.view_group_members enable row level security;

drop policy if exists "view_groups_owner" on public.view_groups;
create policy "view_groups_owner" on public.view_groups for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.can_view_reports());

drop policy if exists "view_group_members_owner" on public.view_group_members;
create policy "view_group_members_owner" on public.view_group_members for all to authenticated
  using (exists (select 1 from public.view_groups vg where vg.id = view_group_id and vg.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.view_groups vg where vg.id = view_group_id and vg.owner_id = (select auth.uid())));

commit;
