-- 005 · Certificates are valid for 2 years
-- Every certificate gets an expiry date 2 years after it was issued, set by the database.
-- This only records and shows the date: compliance still counts any pass, and nobody is
-- asked to recertify yet. Requires 004. Undo: supabase/migrations/005_certificate_expiry.undo.sql

begin;

create or replace function public.set_certificate_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.expires_at := new.issued_at + interval '2 years';
  return new;
end;
$$;

drop trigger if exists set_certificate_expiry on public.certificates;
create trigger set_certificate_expiry
  before insert on public.certificates
  for each row execute function public.set_certificate_expiry();

update public.certificates set expires_at = issued_at + interval '2 years';

commit;
