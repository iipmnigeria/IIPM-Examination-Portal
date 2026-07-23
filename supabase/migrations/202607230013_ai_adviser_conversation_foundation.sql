begin;

create table if not exists public.agilecert_ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key_hash text not null unique,
  candidate_id uuid references auth.users(id) on delete set null,
  message_count integer not null default 0 check (message_count >= 0),
  rate_window_started_at timestamptz not null default now(),
  last_message_at timestamptz,
  lead_intent text,
  escalation_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agilecert_ai_chat_sessions(id) on delete cascade,
  candidate_id uuid references auth.users(id) on delete set null,
  user_message text not null,
  assistant_message text not null,
  recommended_examination_ids uuid[] not null default '{}'::uuid[],
  lead_intent text,
  escalation_required boolean not null default false,
  model text,
  provider_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_ai_chat_session_candidate_idx
  on public.agilecert_ai_chat_sessions(candidate_id, updated_at desc);
create index if not exists agilecert_ai_chat_message_session_idx
  on public.agilecert_ai_chat_messages(session_id, created_at desc);

alter table public.agilecert_ai_chat_sessions enable row level security;
alter table public.agilecert_ai_chat_messages enable row level security;

-- Chat logs are server-only. The browser receives only the response returned by
-- the Edge Function and cannot read other sessions or raw audit records.

create or replace function public.register_agilecert_ai_chat_request(
  p_session_key_hash text,
  p_candidate_id uuid default null,
  p_hourly_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.agilecert_ai_chat_sessions;
  v_limit integer := greatest(5, least(coalesce(p_hourly_limit, 30), 100));
  v_allowed boolean := false;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  if nullif(trim(p_session_key_hash), '') is null or length(trim(p_session_key_hash)) < 32 then
    raise exception 'A valid hashed AI adviser session key is required.';
  end if;

  insert into public.agilecert_ai_chat_sessions (
    session_key_hash,
    candidate_id,
    message_count,
    rate_window_started_at,
    last_message_at
  ) values (
    trim(p_session_key_hash),
    p_candidate_id,
    0,
    now(),
    now()
  )
  on conflict (session_key_hash) do update
  set
    candidate_id = coalesce(public.agilecert_ai_chat_sessions.candidate_id, excluded.candidate_id),
    updated_at = now()
  returning * into v_session;

  select * into v_session
  from public.agilecert_ai_chat_sessions
  where id = v_session.id
  for update;

  if v_session.rate_window_started_at <= now() - interval '1 hour' then
    update public.agilecert_ai_chat_sessions
    set
      message_count = 1,
      rate_window_started_at = now(),
      last_message_at = now(),
      updated_at = now()
    where id = v_session.id
    returning * into v_session;
    v_allowed := true;
  elsif v_session.message_count < v_limit then
    update public.agilecert_ai_chat_sessions
    set
      message_count = message_count + 1,
      last_message_at = now(),
      updated_at = now()
    where id = v_session.id
    returning * into v_session;
    v_allowed := true;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'sessionId', v_session.id,
    'messageCount', v_session.message_count,
    'hourlyLimit', v_limit,
    'remaining', greatest(0, v_limit - v_session.message_count),
    'windowStartedAt', v_session.rate_window_started_at
  );
end;
$$;

revoke all on function public.register_agilecert_ai_chat_request(text, uuid, integer) from public;
grant execute on function public.register_agilecert_ai_chat_request(text, uuid, integer) to service_role;

create or replace function public.record_agilecert_ai_chat_response(
  p_session_id uuid,
  p_candidate_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_recommended_examination_ids uuid[],
  p_lead_intent text,
  p_escalation_required boolean,
  p_model text,
  p_provider_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  insert into public.agilecert_ai_chat_messages (
    session_id,
    candidate_id,
    user_message,
    assistant_message,
    recommended_examination_ids,
    lead_intent,
    escalation_required,
    model,
    provider_request_id,
    metadata
  ) values (
    p_session_id,
    p_candidate_id,
    left(trim(p_user_message), 4000),
    left(trim(p_assistant_message), 12000),
    coalesce(p_recommended_examination_ids, '{}'::uuid[]),
    nullif(trim(p_lead_intent), ''),
    coalesce(p_escalation_required, false),
    nullif(trim(p_model), ''),
    nullif(trim(p_provider_request_id), ''),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_message_id;

  update public.agilecert_ai_chat_sessions
  set
    lead_intent = coalesce(nullif(trim(p_lead_intent), ''), lead_intent),
    escalation_required = escalation_required or coalesce(p_escalation_required, false),
    last_message_at = now(),
    updated_at = now()
  where id = p_session_id;

  return v_message_id;
end;
$$;

revoke all on function public.record_agilecert_ai_chat_response(uuid, uuid, text, text, uuid[], text, boolean, text, text, jsonb) from public;
grant execute on function public.record_agilecert_ai_chat_response(uuid, uuid, text, text, uuid[], text, boolean, text, text, jsonb) to service_role;

comment on table public.agilecert_ai_chat_sessions is
  'Private rate-limited AgileCert AI Certification Adviser sessions.';
comment on table public.agilecert_ai_chat_messages is
  'Private AI adviser audit records; examination questions and answer keys are never included in the model context.';

commit;
