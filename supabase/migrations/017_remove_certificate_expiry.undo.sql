-- Undo 017 · Remove certificate expiry. Brings back expires_at and the 2-year trigger from 005,
-- and fills in the date for existing certificates.

begin;

alter table public.certificates add column if not exists expires_at timestamptz;

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
