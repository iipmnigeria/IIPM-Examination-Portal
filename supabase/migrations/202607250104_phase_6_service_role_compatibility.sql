begin;

-- Supabase opaque server secret keys are authorised as the service_role database
-- role but do not populate the legacy request.jwt.claim.role setting. These RPCs
-- already revoke browser-role execution and grant execution only to service_role,
-- so the obsolete in-function claim check is removed while preserving the
-- database privilege boundary.

create or replace function public.register_agilecert_ai_adviser_request(
  p_session_key_hash text,
  p_candidate_id uuid default null,
  p_consent boolean default false,
  p_hourly_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.agilecert_ai_adviser_sessions%rowtype;
  v_limit integer := greatest(5, least(coalesce(p_hourly_limit, 20), 60));
  v_allowed boolean := false;
begin
  if not coalesce(p_consent, false) then
    raise exception 'Explicit AI adviser privacy consent is required.';
  end if;

  if nullif(trim(p_session_key_hash), '') is null
     or length(trim(p_session_key_hash)) < 64 then
    raise exception 'A valid hashed AI adviser session key is required.';
  end if;

  if p_candidate_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_candidate_id
      and p.is_active = true
  ) then
    p_candidate_id := null;
  end if;

  delete from public.agilecert_ai_adviser_sessions
  where updated_at < now() - interval '90 days';

  insert into public.agilecert_ai_adviser_sessions (
    session_key_hash,
    candidate_id,
    consent_recorded_at,
    message_count,
    total_message_count,
    rate_window_started_at,
    last_message_at,
    metadata
  ) values (
    trim(p_session_key_hash),
    p_candidate_id,
    now(),
    0,
    0,
    now(),
    now(),
    jsonb_build_object(
      'privacyConsent', true,
      'retentionDays', 90,
      'rawSessionKeyStored', false
    )
  )
  on conflict (session_key_hash) do update
  set candidate_id = coalesce(public.agilecert_ai_adviser_sessions.candidate_id, excluded.candidate_id),
      consent_recorded_at = coalesce(
        public.agilecert_ai_adviser_sessions.consent_recorded_at,
        excluded.consent_recorded_at
      ),
      updated_at = now()
  returning * into v_session;

  select * into v_session
  from public.agilecert_ai_adviser_sessions
  where id = v_session.id
  for update;

  if v_session.rate_window_started_at <= now() - interval '1 hour' then
    update public.agilecert_ai_adviser_sessions
    set message_count = 1,
        total_message_count = total_message_count + 1,
        rate_window_started_at = now(),
        last_message_at = now(),
        updated_at = now()
    where id = v_session.id
    returning * into v_session;
    v_allowed := true;
  elsif v_session.message_count < v_limit then
    update public.agilecert_ai_adviser_sessions
    set message_count = message_count + 1,
        total_message_count = total_message_count + 1,
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
    'windowStartedAt', v_session.rate_window_started_at,
    'retentionDays', 90
  );
end;
$$;

revoke all on function public.register_agilecert_ai_adviser_request(
  text, uuid, boolean, integer
) from public, anon, authenticated;
grant execute on function public.register_agilecert_ai_adviser_request(
  text, uuid, boolean, integer
) to service_role;

create or replace function public.record_agilecert_ai_adviser_response(
  p_session_id uuid,
  p_candidate_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_recommended_examination_ids uuid[],
  p_lead_intent text,
  p_escalation_required boolean,
  p_model text,
  p_provider_request_id text,
  p_safety_metadata jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_intent text := lower(trim(coalesce(p_lead_intent, 'information')));
begin
  if not exists (
    select 1
    from public.agilecert_ai_adviser_sessions s
    where s.id = p_session_id
  ) then
    raise exception 'The AI adviser session was not found.';
  end if;

  if v_intent not in (
    'information', 'comparison', 'ready_to_register',
    'ready_to_pay', 'support', 'human_escalation'
  ) then
    v_intent := 'information';
  end if;

  insert into public.agilecert_ai_adviser_messages (
    session_id,
    candidate_id,
    user_message,
    assistant_message,
    recommended_examination_ids,
    lead_intent,
    escalation_required,
    model,
    provider_request_id,
    safety_metadata,
    metadata
  ) values (
    p_session_id,
    p_candidate_id,
    left(trim(p_user_message), 2000),
    left(trim(p_assistant_message), 6000),
    coalesce(p_recommended_examination_ids, '{}'::uuid[]),
    v_intent,
    coalesce(p_escalation_required, false),
    nullif(trim(coalesce(p_model, '')), ''),
    nullif(trim(coalesce(p_provider_request_id, '')), ''),
    coalesce(p_safety_metadata, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_message_id;

  update public.agilecert_ai_adviser_sessions
  set lead_intent = v_intent,
      escalation_required = escalation_required or coalesce(p_escalation_required, false),
      last_message_at = now(),
      updated_at = now()
  where id = p_session_id;

  return v_message_id;
end;
$$;

revoke all on function public.record_agilecert_ai_adviser_response(
  uuid, uuid, text, text, uuid[], text, boolean, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.record_agilecert_ai_adviser_response(
  uuid, uuid, text, text, uuid[], text, boolean, text, text, jsonb, jsonb
) to service_role;

comment on function public.register_agilecert_ai_adviser_request(text, uuid, boolean, integer) is
  'Service-role-only registration and rate limiting compatible with Supabase opaque server secret keys.';

comment on function public.record_agilecert_ai_adviser_response(
  uuid, uuid, text, text, uuid[], text, boolean, text, text, jsonb, jsonb
) is
  'Service-role-only AI adviser audit recording compatible with Supabase opaque server secret keys.';

commit;
