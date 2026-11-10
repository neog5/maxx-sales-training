-- Undo 009 · Admin email alerts
-- Leaves the pg_net extension and the Vault secrets in place (delete secrets in the dashboard).

begin;

drop trigger if exists alert_attempts_exhausted on public.quiz_attempts;
drop function if exists public.alert_attempts_exhausted();
drop trigger if exists alert_new_signup on public.profiles;
drop function if exists public.alert_new_signup();
drop function if exists public.alert_profile_link(uuid);
drop function if exists public.send_admin_alert(text, text);
drop function if exists public.alert_html(text);
drop function if exists public.alert_setting(text);

commit;
