-- Undo 020 · Invite emails link to the sign-in page again (as in 012).

begin;

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

commit;
