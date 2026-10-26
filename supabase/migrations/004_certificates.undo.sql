-- Undo 004 · Certificates. WARNING: deletes all issued certificates.
-- Passing attempts are untouched, so re-running 004 issues them again (with new numbers).

begin;

drop trigger if exists issue_certificate_on_pass on public.quiz_attempts;
drop function if exists public.issue_certificate_on_pass();
drop function if exists public.issue_certificate(uuid);
drop table if exists public.certificates;
drop sequence if exists public.certificate_number_seq;

commit;
