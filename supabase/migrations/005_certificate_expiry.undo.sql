-- Undo 005 · Certificate expiry. Certificates go back to having no expiry date.

begin;

drop trigger if exists set_certificate_expiry on public.certificates;
drop function if exists public.set_certificate_expiry();
update public.certificates set expires_at = null;

commit;
