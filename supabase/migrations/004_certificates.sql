-- 004 · Course completion certificates
-- A certificate is issued automatically the first time someone passes a course. It keeps
-- a copy of the name, course and date, so renaming or archiving a course later doesn't
-- change certificates already issued. Nobody can create, edit or delete one from the app.
-- Requires 001. Undo: supabase/migrations/004_certificates.undo.sql

begin;

create sequence if not exists public.certificate_number_seq;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  attempt_id uuid references public.quiz_attempts(id) on delete set null,
  recipient_name text not null,
  course_title text not null,
  course_code text not null,
  issued_at timestamptz not null default now(),
  -- Unused until we decide whether completion expires (recertification).
  expires_at timestamptz,
  unique (user_id, course_id)
);
create index if not exists certificates_course_idx on public.certificates (course_id);

alter table public.certificates enable row level security;

drop policy if exists "certificates_select_own_or_reports" on public.certificates;
create policy "certificates_select_own_or_reports" on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_reports());

-- Issues the certificate for a passed attempt, unless the person already has one.
create or replace function public.issue_certificate(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issued_at timestamptz;
begin
  select coalesce(qa.submitted_at, now()) into v_issued_at
  from public.quiz_attempts qa
  where qa.id = p_attempt_id and qa.passed and qa.status = 'completed';
  if not found then return; end if;

  insert into public.certificates (certificate_number, user_id, course_id, attempt_id, recipient_name, course_title, course_code, issued_at)
  select
    'MXO-' || to_char(v_issued_at, 'YYYY') || '-' || lpad(nextval('public.certificate_number_seq')::text, 6, '0'),
    qa.user_id, qa.course_id, qa.id, p.full_name, c.title, c.code, v_issued_at
  from public.quiz_attempts qa
  join public.profiles p on p.id = qa.user_id
  join public.courses c on c.id = qa.course_id
  where qa.id = p_attempt_id
    and not exists (select 1 from public.certificates ce where ce.user_id = qa.user_id and ce.course_id = qa.course_id)
  on conflict (user_id, course_id) do nothing;
end;
$$;
revoke all on function public.issue_certificate(uuid) from public, anon, authenticated;

create or replace function public.issue_certificate_on_pass()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.passed and new.status = 'completed' then
    perform public.issue_certificate(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists issue_certificate_on_pass on public.quiz_attempts;
create trigger issue_certificate_on_pass
  after insert or update of passed, status on public.quiz_attempts
  for each row execute function public.issue_certificate_on_pass();

-- Backfill: one certificate per person and course, from their first passing attempt,
-- numbered in the order the courses were passed.
do $$
declare
  v_attempt record;
begin
  for v_attempt in
    select first_pass.id
    from (
      select distinct on (qa.user_id, qa.course_id) qa.id, coalesce(qa.submitted_at, qa.started_at) as passed_at
      from public.quiz_attempts qa
      where qa.passed and qa.status = 'completed'
      order by qa.user_id, qa.course_id, coalesce(qa.submitted_at, qa.started_at)
    ) first_pass
    order by first_pass.passed_at
  loop
    perform public.issue_certificate(v_attempt.id);
  end loop;
end;
$$;

commit;
