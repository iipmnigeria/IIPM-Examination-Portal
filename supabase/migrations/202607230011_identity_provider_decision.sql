begin;

create or replace function public.record_agilecert_identity_provider_decision(
  p_request_id uuid,
  p_decision text,
  p_provider text,
  p_provider_reference text default null,
  p_rejection_reason text default null,
  p_expires_at timestamptz default null,
  p_document_authenticity_score numeric default null,
  p_identity_match_score numeric default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns public.agilecert_identity_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.agilecert_identity_verification_requests;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  if p_decision not in ('processing', 'verified', 'rejected', 'expired') then
    raise exception 'Unsupported identity-provider decision %.', p_decision;
  end if;

  if nullif(trim(p_provider), '') is null then
    raise exception 'The identity-provider name is required.';
  end if;

  select * into v_request
  from public.agilecert_identity_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'The identity-verification request was not found.';
  end if;

  if p_decision = 'verified'
     and (
       coalesce(p_document_authenticity_score, 0) < 70
       or coalesce(p_identity_match_score, 0) < 70
     ) then
    raise exception 'Provider verification scores must both be at least 70.';
  end if;

  update public.agilecert_identity_verification_requests
  set
    status = p_decision,
    verification_method = 'automated_provider',
    provider = trim(p_provider),
    provider_reference = nullif(trim(p_provider_reference), ''),
    document_authenticity_score = p_document_authenticity_score,
    identity_match_score = p_identity_match_score,
    provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
    processing_started_at = case
      when p_decision = 'processing' then coalesce(processing_started_at, now())
      else processing_started_at
    end,
    verified_at = case when p_decision = 'verified' then now() else null end,
    expires_at = case when p_decision = 'verified' then coalesce(p_expires_at, now() + interval '3 years') else expires_at end,
    rejected_at = case when p_decision = 'rejected' then now() else null end,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  update public.agilecert_candidate_profiles
  set
    identity_verification_status = case
      when p_decision = 'verified' then 'verified'
      when p_decision = 'rejected' then 'rejected'
      when p_decision = 'expired' then 'expired'
      else 'pending'
    end,
    pricing_country_code = case when p_decision = 'verified' then v_request.issuing_country_code else pricing_country_code end,
    pricing_currency = case
      when p_decision = 'verified' and v_request.issuing_country_code = 'NG' then 'NGN'
      when p_decision = 'verified' then 'USD'
      else pricing_currency
    end,
    pricing_source = case when p_decision = 'verified' then 'identity_provider' else pricing_source end,
    pricing_verified_at = case when p_decision = 'verified' then now() else pricing_verified_at end,
    updated_at = now()
  where user_id = v_request.candidate_id;

  return v_request;
end;
$$;

revoke all on function public.record_agilecert_identity_provider_decision(uuid, text, text, text, text, timestamptz, numeric, numeric, jsonb) from public;
grant execute on function public.record_agilecert_identity_provider_decision(uuid, text, text, text, text, timestamptz, numeric, numeric, jsonb) to service_role;

comment on function public.record_agilecert_identity_provider_decision(uuid, text, text, text, text, timestamptz, numeric, numeric, jsonb) is
  'Records a trusted automated identity-provider result and locks the verified pricing country and currency.';

commit;
