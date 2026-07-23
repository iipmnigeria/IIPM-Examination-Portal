begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agilecert-identity-documents',
  'agilecert-identity-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.agilecert_identity_verification_requests (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null unique
    default ('AGC-ID-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null
    check (document_type in ('passport', 'national_id', 'drivers_licence', 'voters_card', 'residence_permit', 'other_government_id')),
  issuing_country_code text not null check (issuing_country_code ~ '^[A-Z]{2}$'),
  document_number_last4 text check (document_number_last4 is null or document_number_last4 ~ '^[A-Za-z0-9]{2,4}$'),
  document_storage_path text,
  selfie_storage_path text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'processing', 'verified', 'rejected', 'expired', 'cancelled')),
  verification_method text not null default 'pending_provider'
    check (verification_method in ('pending_provider', 'automated_provider', 'staff_exception_review')),
  provider text,
  provider_reference text,
  document_authenticity_score numeric(5,2),
  identity_match_score numeric(5,2),
  provider_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  processing_started_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (document_authenticity_score is null or document_authenticity_score between 0 and 100),
  check (identity_match_score is null or identity_match_score between 0 and 100)
);

create index if not exists agilecert_identity_candidate_idx
  on public.agilecert_identity_verification_requests(candidate_id, created_at desc);
create index if not exists agilecert_identity_status_idx
  on public.agilecert_identity_verification_requests(status, submitted_at)
  where status in ('submitted', 'processing');
create unique index if not exists agilecert_identity_one_active_request_idx
  on public.agilecert_identity_verification_requests(candidate_id)
  where status in ('draft', 'submitted', 'processing');

alter table public.agilecert_identity_verification_requests enable row level security;

drop policy if exists agilecert_identity_select_own
  on public.agilecert_identity_verification_requests;
create policy agilecert_identity_select_own
  on public.agilecert_identity_verification_requests for select
  to authenticated
  using (candidate_id = auth.uid() or public.is_staff(auth.uid()));

-- Candidate writes are intentionally performed only through security-definer
-- RPCs and Edge Functions. Direct browser insert/update policies are omitted.

create or replace function public.create_my_agilecert_identity_request(
  p_document_type text,
  p_issuing_country_code text,
  p_document_number_last4 text default null
)
returns public.agilecert_identity_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.agilecert_identity_verification_requests;
  v_country text := upper(trim(p_issuing_country_code));
  v_last4 text := upper(nullif(trim(p_document_number_last4), ''));
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_document_type not in ('passport', 'national_id', 'drivers_licence', 'voters_card', 'residence_permit', 'other_government_id') then
    raise exception 'Select a valid government-issued identity document type.';
  end if;

  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'A valid two-letter issuing-country code is required.';
  end if;

  if v_last4 is not null and v_last4 !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'Only the final two to four letters or digits of the document number may be stored.';
  end if;

  if not exists (
    select 1
    from public.agilecert_candidate_profiles p
    where p.user_id = v_user_id
      and nullif(trim(coalesce(p.legal_name, '')), '') is not null
  ) then
    raise exception 'Complete your legal name in My AgileCert before identity verification.';
  end if;

  select * into v_request
  from public.agilecert_identity_verification_requests r
  where r.candidate_id = v_user_id
    and r.status in ('draft', 'submitted', 'processing')
  order by r.created_at desc
  limit 1;

  if found then
    if v_request.status <> 'draft' then
      return v_request;
    end if;

    update public.agilecert_identity_verification_requests
    set
      document_type = p_document_type,
      issuing_country_code = v_country,
      document_number_last4 = v_last4,
      updated_at = now()
    where id = v_request.id
    returning * into v_request;
  else
    insert into public.agilecert_identity_verification_requests (
      candidate_id,
      document_type,
      issuing_country_code,
      document_number_last4
    ) values (
      v_user_id,
      p_document_type,
      v_country,
      v_last4
    )
    returning * into v_request;
  end if;

  insert into public.agilecert_candidate_profiles (user_id, identity_verification_status)
  values (v_user_id, 'pending')
  on conflict (user_id) do update
  set
    identity_verification_status = case
      when public.agilecert_candidate_profiles.identity_verification_status = 'verified'
        then 'verified'
      else 'pending'
    end,
    updated_at = now();

  return v_request;
end;
$$;

revoke all on function public.create_my_agilecert_identity_request(text, text, text) from public;
grant execute on function public.create_my_agilecert_identity_request(text, text, text) to authenticated;

create or replace function public.get_my_agilecert_identity_request()
returns public.agilecert_identity_verification_requests
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.agilecert_identity_verification_requests r
  where r.candidate_id = auth.uid()
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_agilecert_identity_request() from public;
grant execute on function public.get_my_agilecert_identity_request() to authenticated;

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

  if trim(p_document_storage_path) not like v_expected_prefix || '%' then
    raise exception 'The identity-document storage path is invalid.';
  end if;

  if trim(p_selfie_storage_path) not like v_expected_prefix || '%' then
    raise exception 'The selfie storage path is invalid.';
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
  v_method text;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if current_setting('request.jwt.claim.role', true) <> 'service_role'
     and not public.is_staff(v_actor) then
    raise exception 'Staff or trusted-provider access is required.';
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

  v_method := case
    when nullif(trim(p_provider), '') is not null then 'automated_provider'
    else 'staff_exception_review'
  end;

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
    verification_method = v_method,
    provider = nullif(trim(p_provider), ''),
    provider_reference = nullif(trim(p_provider_reference), ''),
    document_authenticity_score = p_document_authenticity_score,
    identity_match_score = p_identity_match_score,
    provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
    processing_started_at = case when p_decision = 'processing' then coalesce(processing_started_at, now()) else processing_started_at end,
    verified_at = case when p_decision = 'verified' then now() else null end,
    expires_at = case when p_decision = 'verified' then coalesce(p_expires_at, now() + interval '3 years') else expires_at end,
    rejected_at = case when p_decision = 'rejected' then now() else null end,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
    reviewed_by = case when current_setting('request.jwt.claim.role', true) = 'service_role' then reviewed_by else v_actor end,
    reviewed_at = case when current_setting('request.jwt.claim.role', true) = 'service_role' then reviewed_at else now() end,
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
    pricing_source = case when p_decision = 'verified' then 'identity_verification' else pricing_source end,
    pricing_verified_at = case when p_decision = 'verified' then now() else pricing_verified_at end,
    updated_at = now()
  where user_id = v_request.candidate_id;

  return v_request;
end;
$$;

revoke all on function public.review_agilecert_identity_request(uuid, text, text, timestamptz, text, text, numeric, numeric, jsonb) from public;
grant execute on function public.review_agilecert_identity_request(uuid, text, text, timestamptz, text, text, numeric, numeric, jsonb) to authenticated, service_role;

comment on table public.agilecert_identity_verification_requests is
  'Private identity-verification workflow for higher-assurance AgileCert Professional Certificates and verified pricing-country assignment.';
comment on function public.review_agilecert_identity_request(uuid, text, text, timestamptz, text, text, numeric, numeric, jsonb) is
  'Records automated-provider or staff exception-review decisions and synchronises candidate identity and pricing status.';

commit;
