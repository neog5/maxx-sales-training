-- 012 · Invite-only sign-up and archiving people
--
-- Invites: only email addresses an admin has invited can create an account. The check is
-- in the database, so it also covers sign-ups sent straight to Supabase. An invite can
-- name a training group the person joins when they sign up. People who already have an
-- account are not affected. If Resend is set up (migration 009), the invite is emailed.
--
-- Archiving people: an archived person keeps every training record but loses all access:
-- every table refuses them, they hold no role, and they can't read or take courses. They no
-- longer count towards compliance and get no admin emails. Archiving can be undone.
-- Admins archive learners and managers; only super admins archive admins. Nobody archives
-- themselves.
--
-- Direct database sessions (the SQL Editor, imports, tests) are trusted, as elsewhere:
-- they can create users without an invite. To let the first person sign up on a new
-- database, add their invite in the SQL Editor:
--   insert into public.invites (email) values ('you@maxxortho.com');
-- Requires 001, 002, 003, 009 and 011. Undo: supabase/migrations/012_invites_and_user_archive.undo.sql

begin;

-- ── Archived people ───────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

-- The signed-in user exists and is not archived.
create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and archived_at is null
  );
$$;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

-- An archived person holds no role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'super_admin') and archived_at is null
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin' and archived_at is null
  );
$$;

create or replace function public.can_view_reports()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin', 'super_admin') and archived_at is null
  );
$$;

-- Reading and assessments (migration 011) all start from this check.
create or replace function public.current_learner()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to continue';
  end if;
  if not public.is_active_user() then
    raise exception 'This account has been deactivated';
  end if;
  return (select auth.uid());
end;
$$;

-- Archived people are no longer required to complete anything.
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
  join public.profiles p on p.id = pairs.user_id
  where c.is_active and c.archived_at is null
    and p.archived_at is null
    and (public.can_view_reports() or (pairs.user_id = (select auth.uid()) and public.is_active_user()));
$$;

-- Every table refuses archived people, on top of its own policies. They can still read
-- their own profile row, which is how the app knows to show "account deactivated".
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'courses', 'questions', 'course_materials', 'reading_sessions', 'quiz_attempts', 'attempt_questions',
    'attempt_unlocks', 'certificates', 'groups', 'group_members', 'course_assignments',
    'view_groups', 'view_group_members', 'audit_log'
  ] loop
    execute format('drop policy if exists "active_users_only" on public.%I', v_table);
    execute format(
      'create policy "active_users_only" on public.%I as restrictive for all to authenticated '
      'using ((select public.is_active_user())) with check ((select public.is_active_user()))', v_table);
  end loop;
end;
$$;

drop policy if exists "active_users_only_select" on public.profiles;
create policy "active_users_only_select" on public.profiles as restrictive for select to authenticated
  using ((select public.is_active_user()) or id = (select auth.uid()));
drop policy if exists "active_users_only_update" on public.profiles;
create policy "active_users_only_update" on public.profiles as restrictive for update to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

-- Who may change roles and who may archive. Direct database sessions are trusted.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Only an admin can change profile roles';
    end if;
    if (old.role = 'super_admin' or new.role = 'super_admin') and not public.is_super_admin() then
      raise exception 'Only a super admin can grant or remove super admin access';
    end if;
  end if;
  if (new.archived_at is null) <> (old.archived_at is null) then
    if not public.is_admin() then
      raise exception 'Only an admin can archive or restore people';
    end if;
    if new.id = (select auth.uid()) then
      raise exception 'You cannot archive yourself';
    end if;
    if old.role in ('admin', 'super_admin') and not public.is_super_admin() then
      raise exception 'Only a super admin can archive or restore an admin';
    end if;
  end if;
  return new;
end;
$$;

-- The server stamps who archived a person and when; clients cannot forge either.
-- (Runs after prevent_profile_privilege_escalation: triggers fire in name order.)
create or replace function public.stamp_profile_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    new.archived_at := now();
    new.archived_by := (select auth.uid());
  elsif new.archived_at is null then
    new.archived_by := null;
  else
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_profile_archive on public.profiles;
create trigger stamp_profile_archive
  before update on public.profiles
  for each row execute function public.stamp_profile_archive();

-- ── Invites ───────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email)) and email like '%_@_%'),
  group_id uuid references public.groups(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null default auth.uid(),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null
);

alter table public.invites enable row level security;
drop policy if exists "invites_select_admin" on public.invites;
create policy "invites_select_admin" on public.invites for select to authenticated
  using (public.is_admin());
drop policy if exists "invites_insert_admin" on public.invites;
create policy "invites_insert_admin" on public.invites for insert to authenticated
  with check (public.is_admin() and accepted_at is null and accepted_by is null);
-- Only invites nobody has used can be withdrawn; used ones are a permanent record.
drop policy if exists "invites_delete_admin" on public.invites;
create policy "invites_delete_admin" on public.invites for delete to authenticated
  using (public.is_admin() and accepted_at is null);
-- No update policy: only handle_new_user() marks an invite as used.

create or replace function public.stamp_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.invited_by := (select auth.uid());
    new.invited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_invite on public.invites;
create trigger stamp_invite before insert on public.invites
  for each row execute function public.stamp_invite();

-- Creates the profile for a new account, but only for invited email addresses.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
begin
  select * into v_invite from public.invites where email = lower(trim(new.email));
  -- session_user is the role that connected: Supabase Auth for real sign-ups, postgres for
  -- the SQL Editor, imports and tests. Anything that isn't postgres needs an invite.
  if v_invite.id is null and session_user <> 'postgres' then
    raise exception 'This email address has not been invited to the training portal';
  end if;

  insert into public.profiles (id, full_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'learner', new.email);

  if v_invite.id is not null then
    update public.invites set accepted_at = now(), accepted_by = new.id where id = v_invite.id;
    if v_invite.group_id is not null then
      insert into public.group_members (group_id, user_id, added_by)
      values (v_invite.group_id, new.id, v_invite.invited_by)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ── Emails ────────────────────────────────────────────────────────────────
-- Queues one email through Resend. Does nothing until resend_api_key is in Vault. Never raises.
create or replace function public.send_email(p_to jsonb, p_subject text, p_html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text := public.alert_setting('resend_api_key');
begin
  if api_key is null or p_to is null or jsonb_array_length(p_to) = 0 then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', coalesce(public.alert_setting('alert_from_email'), 'Maxx Training <onboarding@resend.dev>'),
      'to', p_to,
      'subject', coalesce(public.alert_setting('alert_subject_prefix'), '') || p_subject,
      'html', p_html
    )
  );
exception when others then
  raise warning 'Email not sent: %', sqlerrm;
end;
$$;
revoke all on function public.send_email(jsonb, text, text) from public, anon, authenticated;

-- Admin alerts go to every admin and super admin who isn't archived.
create or replace function public.send_admin_alert(p_subject text, p_html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients jsonb;
begin
  select jsonb_agg(email) into recipients
  from (
    select distinct lower(email) as email from public.profiles
    where role in ('admin', 'super_admin') and email is not null and archived_at is null
    limit 50  -- Resend's per-email recipient limit
  ) admins;
  perform public.send_email(recipients, p_subject, p_html);
end;
$$;
revoke all on function public.send_admin_alert(text, text) from public, anon, authenticated;

-- Emails the invited person a link to the sign-in page. Needs portal_url in Vault.
create or replace function public.email_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := public.alert_setting('portal_url');
begin
  if v_url is null or new.accepted_at is not null then
    return new;
  end if;
  perform public.send_email(
    jsonb_build_array(new.email),
    'You''re invited to Maxx Orthopedics Sales Training',
    '<p>You have been invited to the Maxx Orthopedics sales training portal.</p>'
      || '<p><a href="' || public.alert_html(rtrim(v_url, '/') || '/login') || '">Open the portal</a>, choose '
      || '<strong>Create an account</strong> and sign up with this email address ('
      || public.alert_html(new.email) || ').</p>'
  );
  return new;
end;
$$;

drop trigger if exists email_invite on public.invites;
create trigger email_invite after insert on public.invites
  for each row execute function public.email_invite();

-- ── Audit ─────────────────────────────────────────────────────────────────
-- As in 001, plus: archiving and restoring a person, and invites.
create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_entity text := case tg_table_name
    when 'courses' then 'course'
    when 'profiles' then 'profile'
    when 'groups' then 'group'
    when 'group_members' then 'group_member'
    when 'course_assignments' then 'course_assignment'
    when 'invites' then 'invite'
    else tg_table_name end;
  v_action text := v_entity || '.' || lower(tg_op);
  v_entity_id uuid := (v_row->>'id')::uuid;
  v_details jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', v_old->key, 'to', value)), '{}'::jsonb)
      into v_details
      from jsonb_each(v_row)
      where v_old->key is distinct from value;
    if v_details = '{}'::jsonb then
      return new;
    end if;
    if tg_table_name = 'courses' and v_details ? 'archived_at' then
      v_action := case when new.archived_at is null then 'course.unarchived' else 'course.archived' end;
    elsif tg_table_name = 'profiles' then
      if v_details ? 'archived_at' then
        v_action := case when new.archived_at is null then 'profile.unarchived' else 'profile.archived' end;
      elsif v_details ? 'role' then
        v_action := 'profile.role_changed';
      else
        return new;
      end if;
    end if;
  else
    v_details := v_row;
  end if;

  if tg_table_name = 'group_members' then
    v_entity_id := (v_row->>'group_id')::uuid;
  end if;

  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, details)
  values (
    v_actor,
    (select full_name from public.profiles where id = v_actor),
    v_action,
    v_entity,
    v_entity_id,
    v_details
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after insert or delete on public.invites
  for each row execute function public.audit_change();

commit;
