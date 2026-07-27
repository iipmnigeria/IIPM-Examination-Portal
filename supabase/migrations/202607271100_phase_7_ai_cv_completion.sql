begin;

-- Phase 7.2: consent-gated AI assistance for the private candidate CV workspace.
-- The provider receives only the candidate-selected CV content required for the
-- requested enhancement. Contact details, identity evidence, examinations,
-- payments, answer keys and private credential authority remain excluded.

create table if not exists public.agilecert_ai_cv_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  request_kind text not null check (
    request_kind in ('professional_summary', 'role_tailoring', 'achievement_rewrite', 'skills_recommendation')
  ),
  target_role_hash text,
  instruction_hash text,
  source_document_updated_at timestamptz,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'applied')),
  model text,
  provider_request_id text,
  safety_metadata jsonb not null default '{}'::jsonb,
  result_metadata jsonb not null default '{}'::jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  applied_at timestamptz
);

create index if not exists agilecert_ai_cv_requests_candidate_created_idx
  on public.agilecert_ai_cv_requests(candidate_id, created_at desc);
create index if not exists agilecert_ai_cv_requests_status_idx
  on public.agilecert_ai_cv_requests(status, created_at desc);

alter table public.agilecert_ai_cv_requests enable row level security;

drop policy if exists agilecert_ai_cv_requests_select_own
  on public.agilecert_ai_cv_requests;
create policy agilecert_ai_cv_requests_select_own
  on public.agilecert_ai_cv_requests
  for select
  to authenticated
  using (candidate_id = auth.uid());

revoke all on public.agilecert_ai_cv_requests from anon, authenticated;
grant select on public.agilecert_ai_cv_requests to authenticated;

create or replace function public.set_my_agilecert_ai_cv_consent(
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.agilecert_candidate_cv_documents%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'Only active candidate accounts may manage AI CV consent.';
  end if;

  update public.agilecert_candidate_cv_documents
  set ai_processing_consent = coalesce(p_consent, false),
      updated_at = now()
  where candidate_id = v_user_id
  returning * into v_document;

  if v_document.id is null then
    raise exception 'Create and save your private CV before enabling AI assistance.';
  end if;

  return jsonb_build_object(
    'consent', v_document.ai_processing_consent,
    'updatedAt', v_document.updated_at
  );
end;
$$;

revoke all on function public.set_my_agilecert_ai_cv_consent(boolean)
  from public, anon, authenticated;
grant execute on function public.set_my_agilecert_ai_cv_consent(boolean)
  to authenticated;

create or replace function public.register_agilecert_ai_cv_request(
  p_candidate_id uuid,
  p_request_kind text,
  p_target_role_hash text default null,
  p_instruction_hash text default null,
  p_hourly_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_request_kind, '')));
  v_limit integer := greatest(3, least(coalesce(p_hourly_limit, 12), 30));
  v_count integer;
  v_request_id uuid;
  v_document_updated_at timestamptz;
begin
  if v_kind not in (
    'professional_summary', 'role_tailoring', 'achievement_rewrite', 'skills_recommendation'
  ) then
    raise exception 'Unsupported AI CV enhancement request.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_candidate_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select d.updated_at
  into v_document_updated_at
  from public.agilecert_candidate_cv_documents d
  where d.candidate_id = p_candidate_id
    and d.ai_processing_consent = true;

  if v_document_updated_at is null then
    raise exception 'Explicit AI CV processing consent is required.';
  end if;

  delete from public.agilecert_ai_cv_requests
  where created_at < now() - interval '90 days';

  select count(*)::integer
  into v_count
  from public.agilecert_ai_cv_requests r
  where r.candidate_id = p_candidate_id
    and r.created_at > now() - interval '1 hour';

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'hourlyLimit', v_limit,
      'remaining', 0,
      'retentionDays', 90
    );
  end if;

  insert into public.agilecert_ai_cv_requests (
    candidate_id,
    request_kind,
    target_role_hash,
    instruction_hash,
    source_document_updated_at,
    status,
    safety_metadata
  ) values (
    p_candidate_id,
    v_kind,
    nullif(trim(coalesce(p_target_role_hash, '')), ''),
    nullif(trim(coalesce(p_instruction_hash, '')), ''),
    v_document_updated_at,
    'started',
    jsonb_build_object(
      'explicitConsent', true,
      'contactDetailsExcluded', true,
      'identityEvidenceExcluded', true,
      'rawCvContentStoredInAudit', false
    )
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'allowed', true,
    'requestId', v_request_id,
    'hourlyLimit', v_limit,
    'remaining', greatest(0, v_limit - v_count - 1),
    'retentionDays', 90,
    'sourceDocumentUpdatedAt', v_document_updated_at
  );
end;
$$;

revoke all on function public.register_agilecert_ai_cv_request(
  uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.register_agilecert_ai_cv_request(
  uuid, text, text, text, integer
) to service_role;

create or replace function public.complete_agilecert_ai_cv_request(
  p_request_id uuid,
  p_succeeded boolean,
  p_model text default null,
  p_provider_request_id text default null,
  p_safety_metadata jsonb default '{}'::jsonb,
  p_result_metadata jsonb default '{}'::jsonb,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_ai_cv_requests
  set status = case when coalesce(p_succeeded, false) then 'completed' else 'failed' end,
      model = nullif(trim(coalesce(p_model, '')), ''),
      provider_request_id = nullif(trim(coalesce(p_provider_request_id, '')), ''),
      safety_metadata = safety_metadata || coalesce(p_safety_metadata, '{}'::jsonb),
      result_metadata = coalesce(p_result_metadata, '{}'::jsonb),
      failure_code = case
        when coalesce(p_succeeded, false) then null
        else nullif(left(trim(coalesce(p_failure_code, 'provider_error')), 120), '')
      end,
      completed_at = now()
  where id = p_request_id
    and status = 'started';

  if not found then
    raise exception 'The AI CV request is unavailable or already completed.';
  end if;
end;
$$;

revoke all on function public.complete_agilecert_ai_cv_request(
  uuid, boolean, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.complete_agilecert_ai_cv_request(
  uuid, boolean, text, text, jsonb, jsonb, text
) to service_role;

create or replace function public.mark_my_agilecert_ai_cv_enhancement_applied(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.agilecert_ai_cv_requests
  set status = 'applied',
      applied_at = now()
  where id = p_request_id
    and candidate_id = v_user_id
    and status = 'completed';

  if not found then
    raise exception 'The completed AI CV suggestion was not found for this candidate.';
  end if;

  update public.agilecert_candidate_cv_documents
  set ai_last_enhanced_at = now(),
      updated_at = now()
  where candidate_id = v_user_id
  returning updated_at into v_document_updated_at;

  return jsonb_build_object(
    'requestId', p_request_id,
    'appliedAt', now(),
    'documentUpdatedAt', v_document_updated_at
  );
end;
$$;

revoke all on function public.mark_my_agilecert_ai_cv_enhancement_applied(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_my_agilecert_ai_cv_enhancement_applied(uuid)
  to authenticated;

comment on table public.agilecert_ai_cv_requests is
  'Private, minimal AI CV request audit. Raw CV content and provider prompts are deliberately not stored.';
comment on function public.register_agilecert_ai_cv_request(uuid, text, text, text, integer) is
  'Service-role-only consent and rate-limit gate for authenticated candidate AI CV enhancements.';
comment on function public.complete_agilecert_ai_cv_request(uuid, boolean, text, text, jsonb, jsonb, text) is
  'Service-role-only completion record for a consent-gated AI CV request.';
comment on function public.mark_my_agilecert_ai_cv_enhancement_applied(uuid) is
  'Marks a completed AI CV suggestion as explicitly applied by its authenticated candidate owner.';

commit;
