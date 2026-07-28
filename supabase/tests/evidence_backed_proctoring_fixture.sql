\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function storage.foldername(p_name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(coalesce(p_name, ''), '/')
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null unique
);

create table public.profiles (
  id uuid primary key,
  full_name text not null,
  email text not null,
  role text not null,
  is_active boolean not null default true
);

create or replace function public.is_exam_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('auditor', 'exam_admin', 'super_admin')
  )
$$;

create or replace function public.is_exam_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('exam_admin', 'super_admin')
  )
$$;

create table public.examinations (
  id uuid primary key,
  title text not null
);

create table public.exam_sessions (
  id uuid primary key,
  candidate_id uuid not null references public.profiles(id),
  suspicious_score numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.question_options (
  id uuid primary key,
  position integer not null
);

create table public.candidate_answers (
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null,
  selected_option_id uuid references public.question_options(id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id),
  examination_id uuid not null references public.examinations(id),
  candidate_id uuid not null references public.profiles(id),
  percentage numeric(5,2) not null default 0,
  status text not null default 'submitted' check (status in ('submitted', 'flagged', 'terminated', 'reviewed')),
  suspicious_score numeric(5,2) not null default 0,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  reviewed_by uuid references public.profiles(id),
  review_notes text,
  updated_at timestamptz not null default now()
);

create table public.proctor_events (
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

insert into public.profiles (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'Evidence Admin', 'admin@example.test', 'super_admin'),
  ('00000000-0000-0000-0000-000000000002', 'Legacy Candidate', 'candidate@example.test', 'candidate');

insert into public.examinations (id, title) values
  ('00000000-0000-0000-0000-000000000003', 'Evidence Audit Examination');

-- A pre-patch attempt that incorrectly carries 75% without any persisted event.
insert into public.exam_sessions (id, candidate_id, suspicious_score) values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 75);

insert into public.attempts (
  id, session_id, examination_id, candidate_id, percentage, status,
  suspicious_score, started_at, submitted_at
) values (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  94.67, 'flagged', 75, now() - interval '1 hour', now()
);
