-- Undo 012 · Invite-only sign-up and archiving people
-- Sign-up is open to anyone again, and archived people get their access back (who was
-- archived, and when, is lost). The invites table is dropped; audit entries stay.

begin;

drop trigger if exists audit_invites on public.invites;
drop trigger if exists email_invite on public.invites;
drop trigger if exists stamp_invite on public.invites;
drop function if exists public.email_invite();
drop function if exists public.stamp_invite();
drop table if exists public.invites;

drop trigger if exists stamp_profile_archive on public.profiles;
drop function if exists public.stamp_profile_archive();

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
  end loop;
end;
$$;
drop policy if exists "active_users_only_select" on public.profiles;
drop policy if exists "active_users_only_update" on public.profiles;

-- The functions as they were before 012.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'super_admin')
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
    where id = (select auth.uid()) and role = 'super_admin'
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
    where id = (select auth.uid()) and role in ('manager', 'admin', 'super_admin')
  );
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    if not public.is_admin() then
      raise exception 'Only an admin can change profile roles';
    end if;
    if (old.role = 'super_admin' or new.role = 'super_admin') and not public.is_super_admin() then
      raise exception 'Only a super admin can grant or remove super admin access';
    end if;
  end if;
  return new;
end;
$$;

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
      if not v_details ? 'role' then
        return new;
      end if;
      v_action := 'profile.role_changed';
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

create or replace function public.send_admin_alert(p_subject text, p_html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text := public.alert_setting('resend_api_key');
  recipients jsonb;
begin
  if api_key is null then
    return;
  end if;

  select jsonb_agg(email) into recipients
  from (
    select distinct lower(email) as email from public.profiles
    where role in ('admin', 'super_admin') and email is not null
    limit 50  -- Resend's per-email recipient limit
  ) admins;
  if recipients is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', coalesce(public.alert_setting('alert_from_email'), 'Maxx Training <onboarding@resend.dev>'),
      'to', recipients,
      'subject', coalesce(public.alert_setting('alert_subject_prefix'), '') || p_subject,
      'html', p_html
    )
  );
exception when others then
  raise warning 'Admin alert email not sent: %', sqlerrm;
end;
$$;

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
  return (select auth.uid());
end;
$$;

revoke all on function public.send_admin_alert(text, text) from public, anon, authenticated;
drop function if exists public.send_email(jsonb, text, text);
drop function if exists public.is_active_user();

alter table public.profiles drop column if exists archived_by, drop column if exists archived_at;

commit;
