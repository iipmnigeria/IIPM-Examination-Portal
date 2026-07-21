begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null default 'candidate'
    check (role in ('candidate', 'auditor', 'exam_admin', 'super_admin')),
  candidate_code text unique,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(email));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    lower(coalesce(new.email, '')),
    'candidate'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
$$;

create or replace function public.is_exam_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('auditor', 'exam_admin', 'super_admin'), false)
$$;

create or replace function public.is_exam_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('exam_admin', 'super_admin'), false)
$$;

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.examinations (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete restrict,
  title text not null,
  instructions text,
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  pass_mark numeric(5,2) not null default 70 check (pass_mark between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  randomize_questions boolean not null default true,
  randomize_options boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'true_false')),
  position integer not null check (position > 0),
  points numeric(8,2) not null default 1 check (points > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (examination_id, position)
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (question_id, position)
);

-- Answer keys are isolated from candidate-facing question records.
create table if not exists public.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_id uuid not null references public.question_options(id) on delete restrict,
  explanation text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_answer_key_option()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.question_options qo
    where qo.id = new.correct_option_id
      and qo.question_id = new.question_id
  ) then
    raise exception 'The selected correct option does not belong to this question.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_answer_key_option_trigger on public.question_answer_keys;
create trigger validate_answer_key_option_trigger
  before insert or update on public.question_answer_keys
  for each row execute function public.validate_answer_key_option();

create table if not exists public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  available_from timestamptz,
  expires_at timestamptz,
  max_attempts_override integer check (max_attempts_override between 1 and 10),
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (examination_id, candidate_id),
  check (expires_at is null or available_from is null or expires_at > available_from)
);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.exam_assignments(id) on delete restrict,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'submitted', 'expired', 'terminated')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  tab_away_count integer not null default 0 check (tab_away_count >= 0),
  suspicious_score numeric(5,2) not null default 0 check (suspicious_score between 0 and 100),
  client_fingerprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);

create unique index if not exists one_active_session_per_assignment_idx
  on public.exam_sessions (assignment_id)
  where status = 'active';

create table if not exists public.candidate_answers (
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id) on delete restrict,
  answered_at timestamptz not null default now(),
  client_sequence integer not null default 0,
  primary key (session_id, question_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete restrict,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  raw_score numeric(10,2) not null default 0,
  maximum_score numeric(10,2) not null default 0,
  percentage numeric(5,2) not null default 0 check (percentage between 0 and 100),
  status text not null default 'submitted' check (status in ('submitted', 'flagged', 'terminated', 'reviewed')),
  suspicious_score numeric(5,2) not null default 0 check (suspicious_score between 0 and 100),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  graded_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proctor_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  confidence numeric(5,4) check (confidence between 0 and 1),
  message text not null,
  snapshot_path text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  certificate_number text not null unique,
  verification_code text not null unique default encode(gen_random_bytes(12), 'hex'),
  storage_path text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists examinations_programme_idx on public.examinations(programme_id);
create index if not exists questions_examination_idx on public.questions(examination_id, position);
create index if not exists options_question_idx on public.question_options(question_id, position);
create index if not exists assignments_candidate_idx on public.exam_assignments(candidate_id, status);
create index if not exists sessions_candidate_idx on public.exam_sessions(candidate_id, status);
create index if not exists attempts_candidate_idx on public.attempts(candidate_id, created_at desc);
create index if not exists attempts_examination_idx on public.attempts(examination_id, created_at desc);
create index if not exists proctor_session_idx on public.proctor_events(session_id, occurred_at desc);
create index if not exists audit_actor_idx on public.audit_logs(actor_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger programmes_set_updated_at before update on public.programmes
  for each row execute function public.set_updated_at();
create trigger examinations_set_updated_at before update on public.examinations
  for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.exam_assignments
  for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.exam_sessions
  for each row execute function public.set_updated_at();
create trigger attempts_set_updated_at before update on public.attempts
  for each row execute function public.set_updated_at();
create trigger certificates_set_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.programmes enable row level security;
alter table public.examinations enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.candidate_answers enable row level security;
alter table public.attempts enable row level security;
alter table public.proctor_events enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "staff_select_profiles"
  on public.profiles for select
  to authenticated
  using (public.is_exam_staff());

create policy "admins_manage_profiles"
  on public.profiles for update
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "authenticated_view_active_programmes"
  on public.programmes for select
  to authenticated
  using (is_active = true or public.is_exam_staff());

create policy "admins_manage_programmes"
  on public.programmes for all
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "authenticated_view_published_exams"
  on public.examinations for select
  to authenticated
  using (status = 'published' or public.is_exam_staff());

create policy "admins_manage_exams"
  on public.examinations for all
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "staff_manage_questions"
  on public.questions for all
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "staff_manage_options"
  on public.question_options for all
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "admins_manage_answer_keys"
  on public.question_answer_keys for all
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

create policy "candidate_view_assignments"
  on public.exam_assignments for select
  to authenticated
  using (candidate_id = auth.uid());

create policy "staff_manage_assignments"
  on public.exam_assignments for all
  to authenticated
  using (public.is_exam_staff())
  with check (public.is_exam_staff());

create policy "candidate_view_sessions"
  on public.exam_sessions for select
  to authenticated
  using (candidate_id = auth.uid());

create policy "staff_view_sessions"
  on public.exam_sessions for select
  to authenticated
  using (public.is_exam_staff());

create policy "staff_manage_sessions"
  on public.exam_sessions for update
  to authenticated
  using (public.is_exam_staff())
  with check (public.is_exam_staff());

create policy "candidate_view_own_answers"
  on public.candidate_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.exam_sessions s
      where s.id = candidate_answers.session_id
        and s.candidate_id = auth.uid()
    )
  );

create policy "staff_view_answers"
  on public.candidate_answers for select
  to authenticated
  using (public.is_exam_staff());

create policy "candidate_view_attempts"
  on public.attempts for select
  to authenticated
  using (candidate_id = auth.uid());

create policy "staff_view_attempts"
  on public.attempts for select
  to authenticated
  using (public.is_exam_staff());

create policy "staff_review_attempts"
  on public.attempts for update
  to authenticated
  using (public.is_exam_staff())
  with check (public.is_exam_staff());

create policy "staff_view_proctor_events"
  on public.proctor_events for select
  to authenticated
  using (public.is_exam_staff());

create policy "candidate_view_certificates"
  on public.certificates for select
  to authenticated
  using (candidate_id = auth.uid());

create policy "staff_manage_certificates"
  on public.certificates for all
  to authenticated
  using (public.is_exam_staff())
  with check (public.is_exam_staff());

create policy "staff_view_audit_logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_exam_admin());

create or replace function public.verify_certificate(p_verification_code text)
returns table (
  certificate_number text,
  candidate_name text,
  examination_title text,
  percentage numeric,
  issued_at timestamptz,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.certificate_number,
    p.full_name,
    e.title,
    a.percentage,
    c.issued_at,
    c.revoked_at is null
  from public.certificates c
  join public.attempts a on a.id = c.attempt_id
  join public.profiles p on p.id = c.candidate_id
  join public.examinations e on e.id = a.examination_id
  where c.verification_code = p_verification_code
  limit 1
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_exam_staff() from public;
revoke all on function public.is_exam_admin() from public;
revoke all on function public.verify_certificate(text) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_exam_staff() to authenticated;
grant execute on function public.is_exam_admin() to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('candidate-documents', 'candidate-documents', false, 10485760),
  ('proctor-evidence', 'proctor-evidence', false, 5242880),
  ('certificates', 'certificates', false, 10485760)
on conflict (id) do nothing;

create policy "candidate_manage_own_documents"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_view_candidate_documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'candidate-documents' and public.is_exam_staff());

create policy "staff_view_proctor_evidence"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'proctor-evidence' and public.is_exam_staff());

create policy "candidate_view_own_certificates"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_manage_certificates_storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'certificates' and public.is_exam_staff())
  with check (bucket_id = 'certificates' and public.is_exam_staff());

commit;
