begin;

-- Original Roadmap Phase 5 completion, unit 3 of 6:
-- live server-authoritative proctoring sessions and privacy-bounded event capture.

create table if not exists public.agilecert_proctoring_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  consent_id uuid references public.agilecert_identity_proctoring_consents(id) on delete restrict,
  identity_check_id uuid references public.agilecert_exam_identity_checks(id) on delete set null,
  policy_version integer not null check (policy_version > 0),
  status text not null default 'active' check (status in (
    'pending_identity', 'active', 'submitted', 'expired', 'terminated', 'under_review', 'closed'
  )),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_event_at timestamptz,
  camera_permission text not null default 'not_requested' check (camera_permission in ('not_requested', 'granted', 'denied', 'unavailable')),
  microphone_permission text not null default 'not_requested' check (microphone_permission in ('not_requested', 'granted', 'denied', 'unavailable')),
  fullscreen_status text not null default 'not_requested' check (fullscreen_status in ('not_requested', 'entered', 'exited', 'unavailable')),
  connectivity_status text not null default 'online' check (connectivity_status in ('online', 'offline', 'unstable')),
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  low_event_count integer not null default 0 check (low_event_count >= 0),
  medium_event_count integer not null default 0 check (medium_event_count >= 0),
  high_event_count integer not null default 0 check (high_event_count >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  client_fingerprint jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists agilecert_proctoring_sessions_candidate_idx
  on public.agilecert_proctoring_sessions(candidate_id, started_at desc);
create index if not exists agilecert_proctoring_sessions_risk_idx
  on public.agilecert_proctoring_sessions(risk_level, risk_score desc, started_at desc);
create index if not exists agilecert_proctoring_sessions_status_idx
  on public.agilecert_proctoring_sessions(status, started_at desc);

alter table public.proctor_events
  add column if not exists proctoring_session_id uuid references public.agilecert_proctoring_sessions(id) on delete cascade,
  add column if not exists client_event_id text,
  add column if not exists source text not null default 'exam_submission'
    check (source in ('live_browser', 'live_ai', 'exam_submission', 'administrator', 'system')),
  add column if not exists risk_weight numeric(5,2) not null default 0
    check (risk_weight between 0 and 100);

create unique index if not exists proctor_events_client_event_uidx
  on public.proctor_events(proctoring_session_id, client_event_id)
  where proctoring_session_id is not null and client_event_id is not null;
create index if not exists proctor_events_proctoring_session_idx
  on public.proctor_events(proctoring_session_id, occurred_at desc)
  where proctoring_session_id is not null;

create or replace function public.agilecert_guard_proctor_event_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forbidden text[] := array[
    'question', 'questionId', 'questionText', 'questions',
    'answer', 'answers', 'answerKey', 'correctOption', 'selectedOption',
    'selectedOptionId', 'optionText', 'candidateAnswers', 'rawAnswerPayload'
  ];
begin
  if coalesce(new.metadata, '{}'::jsonb) ?| v_forbidden then
    raise exception 'Proctor-event metadata must not contain examination questions, answers or answer keys.';
  end if;

  new.message := left(trim(coalesce(new.message, 'Proctor event recorded.')), 800);
  if length(new.message) < 3 then
    new.message := 'Proctor event recorded.';
  end if;

  if new.client_event_id is not null then
    new.client_event_id := left(regexp_replace(trim(new.client_event_id), '[^A-Za-z0-9._:-]+', '-', 'g'), 120);
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_guard_proctor_event_privacy_trigger on public.proctor_events;
create trigger agilecert_guard_proctor_event_privacy_trigger
before insert or update of metadata, message, client_event_id on public.proctor_events
for each row execute function public.agilecert_guard_proctor_event_privacy();

create or replace function public.agilecert_refresh_proctoring_session_risk(
  p_proctoring_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.agilecert_proctoring_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_score numeric(5,2);
  v_low integer;
  v_medium integer;
  v_high integer;
  v_count integer;
  v_last timestamptz;
  v_level text;
begin
  select * into v_session
  from public.agilecert_proctoring_sessions
  where id = p_proctoring_session_id
  for update;
  if not found then return; end if;

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = v_session.examination_id;

  select
    least(100, coalesce(sum(pe.risk_weight), 0))::numeric(5,2),
    count(*) filter (where pe.severity = 'low')::integer,
    count(*) filter (where pe.severity = 'medium')::integer,
    count(*) filter (where pe.severity = 'high')::integer,
    count(*)::integer,
    max(pe.occurred_at)
  into v_score, v_low, v_medium, v_high, v_count, v_last
  from public.proctor_events pe
  where pe.proctoring_session_id = p_proctoring_session_id;

  v_level := case
    when v_score >= coalesce(v_policy.critical_threshold, 80) then 'critical'
    when v_score >= coalesce(v_policy.incident_threshold, 60) then 'high'
    when v_score >= 25 then 'medium'
    else 'low'
  end;

  update public.agilecert_proctoring_sessions
  set risk_score = v_score,
      risk_level = v_level,
      low_event_count = v_low,
      medium_event_count = v_medium,
      high_event_count = v_high,
      event_count = v_count,
      last_event_at = v_last,
      updated_at = now()
  where id = p_proctoring_session_id;
end;
$$;

create or replace function public.agilecert_refresh_proctoring_session_risk_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.proctoring_session_id is not null then
      perform public.agilecert_refresh_proctoring_session_risk(old.proctoring_session_id);
    end if;
    return old;
  end if;

  if new.proctoring_session_id is not null then
    perform public.agilecert_refresh_proctoring_session_risk(new.proctoring_session_id);
  end if;
  if tg_op = 'UPDATE' and old.proctoring_session_id is distinct from new.proctoring_session_id
     and old.proctoring_session_id is not null then
    perform public.agilecert_refresh_proctoring_session_risk(old.proctoring_session_id);
  end if;
  return new;
end;
$$;

drop trigger if exists agilecert_refresh_proctoring_session_risk_event_trigger on public.proctor_events;
create trigger agilecert_refresh_proctoring_session_risk_event_trigger
after insert or update or delete on public.proctor_events
for each row execute function public.agilecert_refresh_proctoring_session_risk_trigger();

create or replace function public.agilecert_sync_proctoring_session_from_exam_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_proctoring_sessions
  set status = case new.status
        when 'active' then status
        when 'submitted' then 'submitted'
        when 'expired' then 'expired'
        when 'terminated' then 'terminated'
        else status
      end,
      ended_at = case when new.status in ('submitted', 'expired', 'terminated') then coalesce(ended_at, now()) else ended_at end,
      updated_at = now()
  where session_id = new.id;
  return new;
end;
$$;

drop trigger if exists agilecert_sync_proctoring_session_from_exam_session_trigger on public.exam_sessions;
create trigger agilecert_sync_proctoring_session_from_exam_session_trigger
after update of status on public.exam_sessions
for each row execute function public.agilecert_sync_proctoring_session_from_exam_session();

create trigger agilecert_proctoring_sessions_updated_at
before update on public.agilecert_proctoring_sessions
for each row execute function public.set_updated_at();

alter table public.agilecert_proctoring_sessions enable row level security;

commit;
