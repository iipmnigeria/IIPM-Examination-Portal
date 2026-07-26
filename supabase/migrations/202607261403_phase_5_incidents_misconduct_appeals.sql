begin;

-- Original Roadmap Phase 5 completion, unit 4 of 6:
-- proctoring incidents, candidate explanations, misconduct decisions and appeals.

create table if not exists public.agilecert_proctoring_incidents (
  id uuid primary key default extensions.gen_random_uuid(),
  proctoring_session_id uuid not null references public.agilecert_proctoring_sessions(id) on delete cascade,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  attempt_id uuid references public.attempts(id) on delete set null,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  source_event_id uuid references public.proctor_events(id) on delete set null,
  incident_source text not null default 'automatic_threshold'
    check (incident_source in ('automatic_threshold', 'administrator', 'candidate_report', 'system')),
  category text not null default 'aggregate_risk' check (category in (
    'identity_mismatch', 'camera_unavailable', 'multiple_people', 'no_face',
    'phone_or_notes', 'browser_focus', 'clipboard_or_capture', 'connectivity',
    'aggregate_risk', 'other'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in (
    'open', 'awaiting_candidate', 'under_investigation', 'decision_issued', 'closed', 'dismissed'
  )),
  title text not null check (length(trim(title)) between 3 and 180),
  summary text not null check (length(trim(summary)) between 10 and 2000),
  risk_score_at_creation numeric(5,2) not null default 0 check (risk_score_at_creation between 0 and 100),
  candidate_explanation text,
  candidate_explanation_submitted_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  investigation_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agilecert_auto_incident_session_uidx
  on public.agilecert_proctoring_incidents(proctoring_session_id)
  where incident_source = 'automatic_threshold' and status not in ('dismissed', 'closed');
create index if not exists agilecert_proctoring_incidents_queue_idx
  on public.agilecert_proctoring_incidents(status, severity, created_at desc);
create index if not exists agilecert_proctoring_incidents_candidate_idx
  on public.agilecert_proctoring_incidents(candidate_id, created_at desc);

create table if not exists public.agilecert_misconduct_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  incident_id uuid not null unique references public.agilecert_proctoring_incidents(id) on delete restrict,
  proctoring_session_id uuid not null references public.agilecert_proctoring_sessions(id) on delete restrict,
  session_id uuid not null references public.exam_sessions(id) on delete restrict,
  attempt_id uuid references public.attempts(id) on delete set null,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'open' check (status in (
    'open', 'awaiting_candidate', 'under_review', 'decided', 'appealed', 'closed'
  )),
  result_hold boolean not null default true,
  decision text check (decision is null or decision in (
    'no_violation', 'warning', 'flag_attempt', 'invalidate_attempt', 'suspend_candidate'
  )),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  suspension_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (decision is null or decided_at is not null),
  check (decision is null or decided_by is not null)
);

create index if not exists agilecert_misconduct_cases_queue_idx
  on public.agilecert_misconduct_cases(status, result_hold, created_at desc);
create index if not exists agilecert_misconduct_cases_candidate_idx
  on public.agilecert_misconduct_cases(candidate_id, created_at desc);

create table if not exists public.agilecert_misconduct_appeals (
  id uuid primary key default extensions.gen_random_uuid(),
  misconduct_case_id uuid not null unique references public.agilecert_misconduct_cases(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  grounds text not null check (length(trim(grounds)) between 20 and 4000),
  supporting_reference text,
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'upheld', 'partially_upheld', 'rejected', 'withdrawn'
  )),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  replacement_decision text check (replacement_decision is null or replacement_decision in (
    'no_violation', 'warning', 'flag_attempt', 'invalidate_attempt', 'suspend_candidate'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_misconduct_appeals_queue_idx
  on public.agilecert_misconduct_appeals(status, submitted_at desc);

create or replace function public.agilecert_create_threshold_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_incident_id uuid;
  v_severity text;
begin
  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = new.examination_id;

  if new.status not in ('active', 'submitted', 'under_review')
     or new.risk_score < coalesce(v_policy.incident_threshold, 60)
     or old.risk_score >= coalesce(v_policy.incident_threshold, 60) then
    return new;
  end if;

  v_severity := case
    when new.risk_score >= coalesce(v_policy.critical_threshold, 80) then 'critical'
    else 'high'
  end;

  insert into public.agilecert_proctoring_incidents (
    proctoring_session_id, session_id, examination_id, candidate_id,
    incident_source, category, severity, status, title, summary,
    risk_score_at_creation, metadata
  ) values (
    new.id,
    new.session_id,
    new.examination_id,
    new.candidate_id,
    'automatic_threshold',
    'aggregate_risk',
    v_severity,
    'open',
    'Proctoring risk threshold reached',
    'The server-authoritative proctoring risk score reached the configured incident threshold. Administrator investigation is required.',
    new.risk_score,
    jsonb_build_object(
      'eventCount', new.event_count,
      'lowEventCount', new.low_event_count,
      'mediumEventCount', new.medium_event_count,
      'highEventCount', new.high_event_count,
      'policyVersion', new.policy_version
    )
  )
  on conflict (proctoring_session_id) where incident_source = 'automatic_threshold' and status not in ('dismissed', 'closed')
  do update set
    severity = excluded.severity,
    risk_score_at_creation = greatest(public.agilecert_proctoring_incidents.risk_score_at_creation, excluded.risk_score_at_creation),
    metadata = public.agilecert_proctoring_incidents.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_incident_id;

  insert into public.agilecert_misconduct_cases (
    incident_id, proctoring_session_id, session_id, examination_id, candidate_id,
    status, result_hold, metadata
  ) values (
    v_incident_id, new.id, new.session_id, new.examination_id, new.candidate_id,
    'open', true, jsonb_build_object('createdFrom', 'automatic_threshold')
  )
  on conflict (incident_id) do nothing;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, examination_id, session_id, entity_type, entity_id, action, metadata
  ) values (
    new.candidate_id, new.examination_id, new.session_id,
    'incident', v_incident_id, 'automatic_incident_created',
    jsonb_build_object('riskScore', new.risk_score, 'severity', v_severity)
  );

  return new;
end;
$$;

drop trigger if exists agilecert_create_threshold_incident_trigger on public.agilecert_proctoring_sessions;
create trigger agilecert_create_threshold_incident_trigger
after update of risk_score on public.agilecert_proctoring_sessions
for each row execute function public.agilecert_create_threshold_incident();

create or replace function public.agilecert_link_attempt_to_proctoring_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_proctoring_incidents
  set attempt_id = new.id, updated_at = now()
  where session_id = new.session_id and attempt_id is null;

  update public.agilecert_misconduct_cases
  set attempt_id = new.id, updated_at = now()
  where session_id = new.session_id and attempt_id is null;

  if exists (
    select 1 from public.agilecert_misconduct_cases c
    where c.session_id = new.session_id and c.result_hold = true and c.status <> 'closed'
  ) and new.status = 'submitted' then
    new.status := 'flagged';
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_link_attempt_to_proctoring_case_trigger on public.attempts;
create trigger agilecert_link_attempt_to_proctoring_case_trigger
before insert on public.attempts
for each row execute function public.agilecert_link_attempt_to_proctoring_case();

create trigger agilecert_proctoring_incidents_updated_at
before update on public.agilecert_proctoring_incidents
for each row execute function public.set_updated_at();
create trigger agilecert_misconduct_cases_updated_at
before update on public.agilecert_misconduct_cases
for each row execute function public.set_updated_at();
create trigger agilecert_misconduct_appeals_updated_at
before update on public.agilecert_misconduct_appeals
for each row execute function public.set_updated_at();

alter table public.agilecert_proctoring_incidents enable row level security;
alter table public.agilecert_misconduct_cases enable row level security;
alter table public.agilecert_misconduct_appeals enable row level security;

commit;
