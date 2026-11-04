-- Undo 008 · View-only courses
-- Certificates already issued for view-only courses are kept.

begin;

drop trigger if exists issue_reading_certificate on public.reading_sessions;
drop function if exists public.issue_reading_certificate();
drop trigger if exists protect_reading_started_at on public.reading_sessions;
drop function if exists public.protect_reading_started_at();
alter table public.certificates drop column if exists reading_session_id;
alter table public.courses drop column if exists view_only;

commit;
