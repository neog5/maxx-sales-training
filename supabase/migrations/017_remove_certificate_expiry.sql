-- 017 · Remove certificate expiry
-- Certificates no longer have an expiry date. Removes the 2-year trigger from 005 and the
-- unused expires_at column from 004. Expiry and recertification will come back as their own
-- feature once the rules are decided.
-- Run it and deploy the matching app code together: the old app reads expires_at.
-- Requires 004 and 005. Undo: supabase/migrations/017_remove_certificate_expiry.undo.sql

begin;

drop trigger if exists set_certificate_expiry on public.certificates;
drop function if exists public.set_certificate_expiry();
alter table public.certificates drop column if exists expires_at;

commit;
