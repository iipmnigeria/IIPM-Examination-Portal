begin;

-- Original Roadmap Phase 5 completion, unit 2 of 6:
-- sensitive government-ID/selfie evidence and examination-day identity checks.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agilecert-sensitive-identity',
  'agilecert-sensitive-identity',
  false,
  12582912,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.agilecert_sensitive_identity_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  document_type text not null check (document_type in (
    'passport', 'national_identity', 'driving_licence', 'voter_identity',
    'residence_permit', 'other_government_identity'
  )),
  document_number_digest text not null
    check (document_number_digest ~ '^[0-9a-f]{64}$'),
  document_number_last4 text not null
    check (document_number_last4 ~ '^[A-Za-z0-9]{2,4}$'),
  issuer_country text not null check (issuer_country ~ '^[A-Z]{2}$'),
  issued_on date,
  expires_on date,
  document_object_path text not null,
  document_filename text not null check (length(trim(document_filename)) between 1 and 240),
  document_mime_type text not null check (document_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  document_size_bytes bigint not null check (document_size_bytes between 1 and 12582912),
  selfie_object_path text,
  selfie_filename text,
  selfie_mime_type text check (selfie_mime_type is null or selfie_mime_type in ('image/jpeg', 'image/png')),
  selfie_size_bytes bigint check (selfie_size_bytes is null or selfie_size_bytes between 1 and 12582912),
  status text not null default 'submitted' check (status in (
    'draft', 'submitted', 'under_review', 'changes_requested', 'approved',
    'rejected', 'withdrawn', 'expired', 'deleted'
  )),
  submitted_at timestamptz,
  review_started_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  verified_name text,
  approved_until timestamptz,
  retention_delete_after timestamptz not null,
  duplicate_digest_detected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on > issued_on),
  check (selfie_object_path is null or selfie_filename is not null),
  check (selfie_object_path is null or selfie_mime_type is not null),
  check (selfie_object_path is null or selfie_size_bytes is not null)
);

create unique index if not exists agilecert_sensitive_identity_active_candidate_idx
  on public.agilecert_sensitive_identity_documents(candidate_id)
  where status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved');
create index if not exists agilecert_sensitive_identity_digest_idx
  on public.agilecert_sensitive_identity_documents(document_number_digest, issuer_country);
create index if not exists agilecert_sensitive_identity_queue_idx
  on public.agilecert_sensitive_identity_documents(status, submitted_at desc nulls last);
create index if not exists agilecert_sensitive_identity_retention_idx
  on public.agilecert_sensitive_identity_documents(retention_delete_after)
  where status <> 'deleted';

create table if not exists public.agilecert_exam_identity_checks (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  consent_id uuid references public.agilecert_identity_proctoring_consents(id) on delete restrict,
  identity_document_id uuid references public.agilecert_sensitive_identity_documents(id) on delete restrict,
  status text not null default 'submitted' check (status in (
    'not_required', 'submitted', 'under_review', 'approved', 'changes_requested',
    'rejected', 'expired'
  )),
  candidate_attested_at timestamptz,
  exam_day_selfie_object_path text,
  exam_day_selfie_filename text,
  exam_day_selfie_mime_type text check (
    exam_day_selfie_mime_type is null or exam_day_selfie_mime_type in ('image/jpeg', 'image/png')
  ),
  exam_day_selfie_size_bytes bigint check (
    exam_day_selfie_size_bytes is null or exam_day_selfie_size_bytes between 1 and 12582912
  ),
  manual_document_match text check (manual_document_match is null or manual_document_match in ('match', 'mismatch', 'inconclusive')),
  manual_face_match text check (manual_face_match is null or manual_face_match in ('match', 'mismatch', 'inconclusive', 'not_required')),
  automated_face_match_score numeric(5,4) check (automated_face_match_score is null or automated_face_match_score between 0 and 1),
  automated_liveness_score numeric(5,4) check (automated_liveness_score is null or automated_liveness_score between 0 and 1),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (exam_day_selfie_object_path is null or exam_day_selfie_filename is not null),
  check (exam_day_selfie_object_path is null or exam_day_selfie_mime_type is not null),
  check (exam_day_selfie_object_path is null or exam_day_selfie_size_bytes is not null)
);

create index if not exists agilecert_exam_identity_checks_candidate_idx
  on public.agilecert_exam_identity_checks(candidate_id, created_at desc);
create index if not exists agilecert_exam_identity_checks_queue_idx
  on public.agilecert_exam_identity_checks(status, created_at desc);

create trigger agilecert_sensitive_identity_documents_updated_at
before update on public.agilecert_sensitive_identity_documents
for each row execute function public.set_updated_at();

create trigger agilecert_exam_identity_checks_updated_at
before update on public.agilecert_exam_identity_checks
for each row execute function public.set_updated_at();

alter table public.agilecert_sensitive_identity_documents enable row level security;
alter table public.agilecert_exam_identity_checks enable row level security;

-- Candidate-owned private uploads. Candidate file paths must start with the auth UUID.
drop policy if exists "agilecert_sensitive_identity_candidate_insert" on storage.objects;
create policy "agilecert_sensitive_identity_candidate_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'agilecert-sensitive-identity'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'candidate' and p.is_active = true
  )
);

drop policy if exists "agilecert_sensitive_identity_candidate_select" on storage.objects;
create policy "agilecert_sensitive_identity_candidate_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'agilecert-sensitive-identity'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "agilecert_sensitive_identity_candidate_delete" on storage.objects;
create policy "agilecert_sensitive_identity_candidate_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'agilecert-sensitive-identity'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1 from public.agilecert_sensitive_identity_documents d
    where d.candidate_id = auth.uid()
      and d.status in ('submitted', 'under_review', 'approved')
      and (d.document_object_path = name or d.selfie_object_path = name)
  )
  and not exists (
    select 1 from public.agilecert_exam_identity_checks c
    where c.candidate_id = auth.uid()
      and c.status in ('submitted', 'under_review', 'approved')
      and c.exam_day_selfie_object_path = name
  )
);

drop policy if exists "agilecert_sensitive_identity_admin_select" on storage.objects;
create policy "agilecert_sensitive_identity_admin_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'agilecert-sensitive-identity'
  and public.is_exam_admin()
);

commit;
