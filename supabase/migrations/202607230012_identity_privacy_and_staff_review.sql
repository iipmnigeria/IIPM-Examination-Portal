begin;

-- Prevent direct browser reads of raw provider payloads and private storage
-- paths. Candidate and staff access is provided through redacted RPCs.
revoke all on table public.agilecert_identity_verification_requests from anon, authenticated;

-- Replace the candidate RPC with a redacted JSON response. Storage paths and
-- provider raw payloads remain server-only.
drop function if exists public.get_my_agilecert_identity_request();
create function public.get_my_agilecert_identity_request()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when r.id is null then null
    else jsonb_build_object(
      'id', r.id,
      'request_reference', r.request_reference,
      'candidate_id', r.candidate_id,
      'document_type', r.document_type,
      'issuing_country_code', r.issuing_country_code,
      'document_number_last4', r.document_number_last4,
      'status', r.status,
      'verification_method', r.verification_method,
      'provider', r.provider,
      'document_authenticity_score', r.document_authenticity_score,
      'identity_match_score', r.identity_match_score,
      'submitted_at', r.submitted_at,
      'verified_at', r.verified_at,
      'expires_at', r.expires_at,
      'rejected_at', r.rejected_at,
      'rejection_reason', r.rejection_reason,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    )
  end
  from (
    select *
    from public.agilecert_identity_verification_requests
    where candidate_id = auth.uid()
    order by created_at desc
    limit 1
  ) r;
$$;

revoke all on function public.get_my_agilecert_identity_request() from public;
grant execute on function public.get_my_agilecert_identity_request() to authenticated;

create or replace function public.list_agilecert_identity_review_queue(
  p_status text default 'submitted',
  p_limit integer default 50
)
returns table (
  id uuid,
  request_reference text,
  candidate_id uuid,
  candidate_email text,
  legal_name text,
  document_type text,
  issuing_country_code text,
  document_number_last4 text,
  status text,
  verification_method text,
  provider text,
  document_authenticity_score numeric,
  identity_match_score numeric,
  submitted_at timestamptz,
  created_at timestamptz,
  rejection_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'Staff access is required.';
  end if;

  return query
  select
    r.id,
    r.request_reference,
    r.candidate_id,
    u.email::text,
    p.legal_name,
    r.document_type,
    r.issuing_country_code,
    r.document_number_last4,
    r.status,
    r.verification_method,
    r.provider,
    r.document_authenticity_score,
    r.identity_match_score,
    r.submitted_at,
    r.created_at,
    r.rejection_reason
  from public.agilecert_identity_verification_requests r
  join auth.users u on u.id = r.candidate_id
  left join public.agilecert_candidate_profiles p on p.user_id = r.candidate_id
  where p_status is null or r.status = p_status
  order by coalesce(r.submitted_at, r.created_at)
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.list_agilecert_identity_review_queue(text, integer) from public;
grant execute on function public.list_agilecert_identity_review_queue(text, integer) to authenticated;

-- Correct staff-review authorization while keeping automated provider decisions
-- isolated in the separate service-role-only RPC.
create or replace function public.review_agilecert_identity_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null,
  p_expires_at timestamptz default null,
  p_provider text default null,
  p_provider_reference text default null,
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
  v_actor uuid := auth.uid();
  v_request public.agilecert_identity_verification_requests;
begin
  if v_actor is null or not public.is_staff(v_actor) then
    raise exception 'Staff access is required.';
  end if;

  if p_decision not in ('verified', 'rejected', 'processing', 'expired') then
    raise exception 'Unsupported identity-verification decision %.', p_decision;
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
       coalesce(p_document_authenticity_score, 100) < 70
       or coalesce(p_identity_match_score, 100) < 70
     ) then
    raise exception 'Verification scores must be at least 70 before approval.';
  end if;

  update public.agilecert_identity_verification_requests
  set
    status = p_decision,
    verification_method = 'staff_exception_review',
    provider = coalesce(nullif(trim(p_provider), ''), provider),
    provider_reference = coalesce(nullif(trim(p_provider_reference), ''), provider_reference),
    document_authenticity_score = coalesce(p_document_authenticity_score, document_authenticity_score),
    identity_match_score = coalesce(p_identity_match_score, identity_match_score),
    provider_payload = provider_payload || coalesce(p_provider_payload, '{}'::jsonb),
    processing_started_at = case when p_decision = 'processing' then coalesce(processing_started_at, now()) else processing_started_at end,
    verified_at = case when p_decision = 'verified' then now() else null end,
    expires_at = case when p_decision = 'verified' then coalesce(p_expires_at, now() + interval '3 years') else expires_at end,
    rejected_at = case when p_decision = 'rejected' then now() else null end,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
    reviewed_by = v_actor,
    reviewed_at = now(),
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
    pricing_source = case when p_decision = 'verified' then 'staff_identity_review' else pricing_source end,
    pricing_verified_at = case when p_decision = 'verified' then now() else pricing_verified_at end,
    updated_at = now()
  where user_id = v_request.candidate_id;

  return v_request;
end;
$$;

revoke all on function public.review_agilecert_identity_request(uuid, text, text, timestamptz, text, text, numeric, numeric, jsonb) from public;
grant execute on function public.review_agilecert_identity_request(uuid, text, text, timestamptz, text, text, numeric, numeric, jsonb) to authenticated;

-- Harden path validation in the candidate submission RPC.
create or replace function public.submit_my_agilecert_identity_request(
  p_request_id uuid,
  p_document_storage_path text,
  p_selfie_storage_path text
)
returns public.agilecert_identity_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.agilecert_identity_verification_requests;
  v_expected_prefix text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_request
  from public.agilecert_identity_verification_requests
  where id = p_request_id
    and candidate_id = v_user_id
  for update;

  if not found then
    raise exception 'The identity-verification request was not found.';
  end if;

  if v_request.status not in ('draft', 'rejected') then
    return v_request;
  end if;

  v_expected_prefix := v_user_id::text || '/' || v_request.id::text || '/';

  if not (trim(p_document_storage_path) like v_expected_prefix || '%') then
    raise exception 'The identity-document storage path is invalid.';
  end if;

  if not (trim(p_selfie_storage_path) like v_expected_prefix || '%') then
    raise exception 'The selfie storage path is invalid.';
  end if;

  if trim(p_document_storage_path) = trim(p_selfie_storage_path) then
    raise exception 'The government document and selfie must be separate files.';
  end if;

  update public.agilecert_identity_verification_requests
  set
    document_storage_path = trim(p_document_storage_path),
    selfie_storage_path = trim(p_selfie_storage_path),
    status = 'submitted',
    verification_method = 'pending_provider',
    submitted_at = now(),
    processing_started_at = null,
    rejected_at = null,
    rejection_reason = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  update public.agilecert_candidate_profiles
  set
    identity_verification_status = 'pending',
    updated_at = now()
  where user_id = v_user_id
    and identity_verification_status <> 'verified';

  return v_request;
end;
$$;

revoke all on function public.submit_my_agilecert_identity_request(uuid, text, text) from public;
grant execute on function public.submit_my_agilecert_identity_request(uuid, text, text) to authenticated;

comment on function public.list_agilecert_identity_review_queue(text, integer) is
  'Returns a redacted staff-only identity exception-review queue without private object paths or provider payloads.';

commit;
