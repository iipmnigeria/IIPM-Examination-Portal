begin;

-- Original Roadmap Phase 5 completion, unit 1 of 6:
-- examination-specific identity/proctoring policy and versioned candidate consent.

create or replace function public.agilecert_require_identity_proctor_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_exam_admin() then
    raise exception 'Active examination-administrator access is required.';
  end if;
  return v_user_id;
end;
$$;

create table if not exists public.agilecert_identity_proctoring_policies (
  examination_id uuid primary key references public.examinations(id) on delete cascade,
  policy_version integer not null default 1 check (policy_version > 0),
  consent_version text not null default '2026-07-v1'
    check (length(trim(consent_version)) between 3 and 80),
  privacy_notice text not null default
    'Identity and proctoring data is used only to protect examination integrity, investigate incidents and meet certification obligations.'
    check (length(trim(privacy_notice)) between 40 and 4000),
  require_existing_identity_approval boolean not null default false,
  require_government_id boolean not null default false,
  require_selfie boolean not null default false,
  require_exam_day_identity_check boolean not null default false,
  require_camera boolean not null default false,
  require_microphone_permission boolean not null default false,
  require_fullscreen boolean not null default false,
  live_event_capture_enabled boolean not null default true,
  ai_visual_analysis_enabled boolean not null default false,
  external_kyc_enabled boolean not null default false,
  automated_face_match_enabled boolean not null default false,
  liveness_check_enabled boolean not null default false,
  retain_webcam_images boolean not null default false,
  incident_threshold numeric(5,2) not null default 60 check (incident_threshold between 1 and 100),
  critical_threshold numeric(5,2) not null default 80 check (critical_threshold between incident_threshold and 100),
  low_event_weight numeric(5,2) not null default 2 check (low_event_weight between 0 and 100),
  medium_event_weight numeric(5,2) not null default 8 check (medium_event_weight between 0 and 100),
  high_event_weight numeric(5,2) not null default 20 check (high_event_weight between 0 and 100),
  identity_retention_days integer not null default 365 check (identity_retention_days between 30 and 3650),
  proctor_event_retention_days integer not null default 365 check (proctor_event_retention_days between 30 and 3650),
  incident_retention_days integer not null default 730 check (incident_retention_days between 30 and 3650),
  appeal_window_days integer not null default 14 check (appeal_window_days between 1 and 180),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (external_kyc_enabled = false or require_government_id = true),
  check (automated_face_match_enabled = false or (require_government_id = true and require_selfie = true)),
  check (liveness_check_enabled = false or require_selfie = true),
  check (retain_webcam_images = false or require_camera = true)
);

insert into public.agilecert_identity_proctoring_policies (examination_id)
select e.id from public.examinations e
on conflict (examination_id) do nothing;

create or replace function public.agilecert_seed_identity_proctoring_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agilecert_identity_proctoring_policies (examination_id)
  values (new.id)
  on conflict (examination_id) do nothing;
  return new;
end;
$$;

drop trigger if exists agilecert_seed_identity_proctoring_policy_trigger on public.examinations;
create trigger agilecert_seed_identity_proctoring_policy_trigger
after insert on public.examinations
for each row execute function public.agilecert_seed_identity_proctoring_policy();

create table if not exists public.agilecert_identity_proctoring_consents (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  policy_version integer not null check (policy_version > 0),
  consent_version text not null check (length(trim(consent_version)) between 3 and 80),
  identity_processing_accepted boolean not null,
  proctoring_processing_accepted boolean not null,
  camera_permission_accepted boolean not null default false,
  microphone_permission_accepted boolean not null default false,
  fullscreen_monitoring_accepted boolean not null default false,
  automated_processing_accepted boolean not null default false,
  notice_snapshot text not null check (length(trim(notice_snapshot)) between 40 and 4000),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawal_reason text,
  client_fingerprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, examination_id, policy_version, consent_version),
  check (withdrawn_at is null or withdrawn_at >= accepted_at)
);

create index if not exists agilecert_identity_proctoring_consents_candidate_idx
  on public.agilecert_identity_proctoring_consents(candidate_id, accepted_at desc);
create index if not exists agilecert_identity_proctoring_consents_exam_idx
  on public.agilecert_identity_proctoring_consents(examination_id, accepted_at desc);

create table if not exists public.agilecert_identity_proctoring_audits (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  examination_id uuid references public.examinations(id) on delete set null,
  session_id uuid references public.exam_sessions(id) on delete set null,
  attempt_id uuid references public.attempts(id) on delete set null,
  entity_type text not null check (entity_type in (
    'policy', 'consent', 'identity_document', 'identity_check', 'proctoring_session',
    'proctoring_event', 'incident', 'misconduct_case', 'appeal', 'retention'
  )),
  entity_id uuid,
  action text not null check (length(trim(action)) between 3 and 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_identity_proctoring_audits_created_idx
  on public.agilecert_identity_proctoring_audits(created_at desc);
create index if not exists agilecert_identity_proctoring_audits_candidate_idx
  on public.agilecert_identity_proctoring_audits(candidate_id, created_at desc);

create trigger agilecert_identity_proctoring_policies_updated_at
before update on public.agilecert_identity_proctoring_policies
for each row execute function public.set_updated_at();

create trigger agilecert_identity_proctoring_consents_updated_at
before update on public.agilecert_identity_proctoring_consents
for each row execute function public.set_updated_at();

alter table public.agilecert_identity_proctoring_policies enable row level security;
alter table public.agilecert_identity_proctoring_consents enable row level security;
alter table public.agilecert_identity_proctoring_audits enable row level security;

commit;
