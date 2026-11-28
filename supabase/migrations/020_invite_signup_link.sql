-- 020 · Invite emails open the sign-up form
-- The invite link now goes to /login?signup=1&email=…, which opens Create account with the
-- invited address filled in, instead of the sign-in form. The sender's name and address come
-- from the alert_from_email Vault setting (see docs/developer/operations.md).
-- Requires 012. Undo: supabase/migrations/020_invite_signup_link.undo.sql

begin;

create or replace function public.email_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := public.alert_setting('portal_url');
  v_link text;
begin
  if v_url is null or new.accepted_at is not null then
    return new;
  end if;
  -- An email address only needs + and % escaped to survive in a query string.
  v_link := rtrim(v_url, '/') || '/login?signup=1&email='
    || replace(replace(new.email, '%', '%25'), '+', '%2B');
  perform public.send_email(
    jsonb_build_array(new.email),
    'You''re invited to Maxx Orthopedics Sales Training',
    '<p>You have been invited to the Maxx Orthopedics sales training portal.</p>'
      || '<p><a href="' || public.alert_html(v_link) || '">Create your account</a> with this email address ('
      || public.alert_html(new.email) || ') and choose a password.</p>'
  );
  return new;
end;
$$;

commit;
