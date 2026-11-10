-- 009 · Admin email alerts
-- Emails every admin and super admin when someone signs up, and when someone uses
-- their third failed attempt on a course (so an admin can approve more on their profile).
-- The database sends the emails itself through Resend (https://resend.com) with pg_net, so
-- they go out whatever happens in the browser. A failed send never blocks the signup or
-- the attempt; pg_net keeps each request's result in net._http_response for a few hours.
--
-- Settings live in Supabase Vault (Project Settings → Vault, or the SQL below). Without
-- resend_api_key no email is sent, so the triggers are safe to install before Resend is set up.
--   select vault.create_secret('re_...', 'resend_api_key');
--   select vault.create_secret('Maxx Training <alerts@maxxorthoportal.com>', 'alert_from_email');
--   select vault.create_secret('https://training.maxxorthoportal.com', 'portal_url');
--   select vault.create_secret('[DEV] ', 'alert_subject_prefix');  -- optional, dev only
-- Requires 001, 003 and 007. Undo: supabase/migrations/009_admin_email_alerts.undo.sql

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.alert_setting(p_name text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select nullif(trim(decrypted_secret), '') from vault.decrypted_secrets where name = p_name limit 1;
$$;

create or replace function public.alert_html(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(coalesce(p_text, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- Queues one email to every admin and super admin. Never raises.
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

create or replace function public.alert_profile_link(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case when url is null then ''
    else '<p><a href="' || public.alert_html(rtrim(url, '/') || '/profile/' || p_user_id) || '">Open their profile</a></p>' end
  from (select public.alert_setting('portal_url') as url) s;
$$;

revoke all on function public.alert_setting(text) from public, anon, authenticated;
revoke all on function public.send_admin_alert(text, text) from public, anon, authenticated;
revoke all on function public.alert_profile_link(uuid) from public, anon, authenticated;

-- New signup. Profiles are created by handle_new_user() when someone signs up.
create or replace function public.alert_new_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_admin_alert(
    'New sign-up: ' || coalesce(new.full_name, new.email, 'Unknown user'),
    '<p>' || public.alert_html(coalesce(new.full_name, 'Someone')) || ' (' || public.alert_html(new.email)
      || ') just created an account on the training portal.</p>'
      || '<p>They start as a learner. Add them to a training group or change their role if needed.</p>'
      || public.alert_profile_link(new.id)
  );
  return new;
end;
$$;

drop trigger if exists alert_new_signup on public.profiles;
create trigger alert_new_signup after insert on public.profiles
  for each row execute function public.alert_new_signup();

-- Third failed attempt: the attempt that leaves the learner with none left.
create or replace function public.alert_attempts_exhausted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  learner record;
  course_title text;
begin
  if public.attempts_remaining(new.user_id, new.course_id) is distinct from 0 then
    return new;
  end if;

  select full_name, email into learner from public.profiles where id = new.user_id;
  select title into course_title from public.courses where id = new.course_id;

  perform public.send_admin_alert(
    'Out of attempts: ' || coalesce(learner.full_name, learner.email, 'A learner') || ' · ' || coalesce(course_title, 'a course'),
    '<p>' || public.alert_html(coalesce(learner.full_name, 'A learner')) || ' (' || public.alert_html(learner.email)
      || ') has failed <strong>' || public.alert_html(coalesce(course_title, 'a course'))
      || '</strong> three times and cannot take the test again until an admin approves more attempts.</p>'
      || '<p>Latest score: ' || coalesce(new.score::text, '?') || '%.</p>'
      || public.alert_profile_link(new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists alert_attempts_exhausted on public.quiz_attempts;
create trigger alert_attempts_exhausted after insert on public.quiz_attempts
  for each row when (new.status = 'completed' and new.passed = false)
  execute function public.alert_attempts_exhausted();

commit;
