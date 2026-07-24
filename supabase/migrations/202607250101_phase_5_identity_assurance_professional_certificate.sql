begin;

-- Phase 5: privacy-bounded manual identity assurance and Professional
-- Certificate enablement. This migration deliberately excludes government ID,
-- selfies, facial matching, biometrics and external identity providers.

create table if not exists public.agilecert_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'submitted'
    check (status in (
      'draft', 'submitted', 'under_review', 'changes_requested',
      'approved', 'rejected', 'withdrawn', 'expired'
    )),
  legal_name_snapshot text not null check (length(trim(legal_name_snapshot)) between 3 and 180),
  phone_snapshot text not null check (length(trim(phone_snapshot)) between 5 and 40),
  country_code_snapshot text not null check (country_code_snapshot ~ '^[A-Z]{2}$'),
  affiliation_type text not null
    check (affiliation_type in ('professional_body', 'employer', 'educational_institution', 'training_provider', 'other')),
  affiliation_name text not null check (length(trim(affiliation_name)) between 2 and 200),
  affiliation_reference text,
  evidence_category text not null
    check (evidence_category in (
      'professional_membership', 'employer_confirmation',
      'educational_credential', 'institutional_identity',
      'other_professional_evidence'
    )),
  evidence_object_path text not null,
  evidence_filename text not null check (length(trim(evidence_filename)) between 1 and 240),
  evidence_mime_type text not null
    check (evidence_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  evidence_size_bytes bigint not null check (evidence_size_bytes between 1 and 10485760),
  candidate_notes text,
  attested_at timestamptz not null,
  submitted_at timestamptz,
  review_started_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  approval_expires_at timestamptz,
  supersedes_id uuid references public.agilecert_identity_verifications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agilecert_identity_verifications_active_candidate_idx
  on public.agilecert_identity_verifications(candidate_id)
  where status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved');

create index if not exists agilecert_identity_verifications_queue_idx
  on public.agilecert_identity_verifications(status, submitted_at, created_at);

create table if not exists public.agilecert_identity_verification_audits (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid references public.agilecert_identity_verifications(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  candidate_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_identity_verification_audits_created_idx
  on public.agilecert_identity_verification_audits(created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agilecert-identity-evidence',
  'agilecert-identity-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.agilecert_is_active_certificate_admin(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_active = true
      and p.role in ('exam_admin', 'super_admin')
  );
$$;

create or replace function public.agilecert_identity_is_approved(
  p_candidate_id uuid,
  p_legal_name text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agilecert_identity_verifications v
    where v.candidate_id = p_candidate_id
      and v.status = 'approved'
      and (v.approval_expires_at is null or v.approval_expires_at > now())
      and (
        nullif(trim(coalesce(p_legal_name, '')), '') is null
        or lower(trim(v.legal_name_snapshot)) = lower(trim(p_legal_name))
      )
  );
$$;

create or replace function public.get_my_agilecert_identity_assurance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_verification public.agilecert_identity_verifications%rowtype;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_candidate_id;

  select * into v_verification
  from public.agilecert_identity_verifications
  where candidate_id = v_candidate_id
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'legalName', v_profile.legal_name,
      'phone', v_profile.phone,
      'countryCode', v_profile.country_code,
      'professionalHeadline', v_profile.professional_headline,
      'employer', v_profile.employer
    ),
    'verification', case when v_verification.id is null then null else jsonb_build_object(
      'id', v_verification.id,
      'status', v_verification.status,
      'legalNameSnapshot', v_verification.legal_name_snapshot,
      'phoneSnapshot', v_verification.phone_snapshot,
      'countryCodeSnapshot', v_verification.country_code_snapshot,
      'affiliationType', v_verification.affiliation_type,
      'affiliationName', v_verification.affiliation_name,
      'affiliationReference', v_verification.affiliation_reference,
      'evidenceCategory', v_verification.evidence_category,
      'evidenceFilename', v_verification.evidence_filename,
      'candidateNotes', v_verification.candidate_notes,
      'submittedAt', v_verification.submitted_at,
      'reviewStartedAt', v_verification.review_started_at,
      'reviewedAt', v_verification.reviewed_at,
      'reviewNote', v_verification.review_note,
      'approvalExpiresAt', v_verification.approval_expires_at,
      'createdAt', v_verification.created_at,
      'updatedAt', v_verification.updated_at
    ) end,
    'professionalCheckoutUnlocked', public.agilecert_identity_is_approved(
      v_candidate_id,
      v_profile.legal_name
    ),
    'allowedEvidenceCategories', jsonb_build_array(
      'professional_membership',
      'employer_confirmation',
      'educational_credential',
      'institutional_identity',
      'other_professional_evidence'
    ),
    'prohibitedEvidenceNotice',
      'Do not upload passports, national identity cards, driving licences, voter cards, selfies or biometric material.'
  );
end;
$$;

create or replace function public.submit_my_agilecert_identity_assurance(
  p_affiliation_type text,
  p_affiliation_name text,
  p_affiliation_reference text,
  p_evidence_category text,
  p_evidence_object_path text,
  p_evidence_filename text,
  p_evidence_mime_type text,
  p_evidence_size_bytes bigint,
  p_candidate_notes text default null,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_previous public.agilecert_identity_verifications%rowtype;
  v_created public.agilecert_identity_verifications%rowtype;
  v_path text := trim(coalesce(p_evidence_object_path, ''));
  v_affiliation_type text := lower(trim(coalesce(p_affiliation_type, '')));
  v_category text := lower(trim(coalesce(p_evidence_category, '')));
  v_mime text := lower(trim(coalesce(p_evidence_mime_type, '')));
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  if not coalesce(p_attestation, false) then
    raise exception 'Confirm the accuracy and consent attestation before submitting.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_candidate_id;

  if not found
     or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null
     or nullif(trim(coalesce(v_profile.phone, '')), '') is null
     or coalesce(v_profile.country_code, '') !~ '^[A-Z]{2}$' then
    raise exception 'Complete your legal name, phone and country in the candidate profile before identity assurance.';
  end if;

  if v_affiliation_type not in ('professional_body', 'employer', 'educational_institution', 'training_provider', 'other') then
    raise exception 'Select a valid professional affiliation type.';
  end if;

  if length(trim(coalesce(p_affiliation_name, ''))) < 2 then
    raise exception 'Enter the professional or institutional affiliation name.';
  end if;

  if v_category not in (
    'professional_membership', 'employer_confirmation',
    'educational_credential', 'institutional_identity',
    'other_professional_evidence'
  ) then
    raise exception 'Select a permitted non-government professional evidence category.';
  end if;

  if v_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Evidence must be a PDF, JPG or PNG file.';
  end if;

  if coalesce(p_evidence_size_bytes, 0) < 1 or p_evidence_size_bytes > 10485760 then
    raise exception 'Evidence must not exceed 10 MB.';
  end if;

  if v_path !~ ('^' || v_candidate_id::text || '/[A-Za-z0-9._/-]+$') then
    raise exception 'The evidence file path is not owned by the signed-in candidate.';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'agilecert-identity-evidence'
      and o.name = v_path
  ) then
    raise exception 'The private evidence upload was not found.';
  end if;

  select * into v_previous
  from public.agilecert_identity_verifications
  where candidate_id = v_candidate_id
    and status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved')
  order by created_at desc
  limit 1
  for update;

  if found and v_previous.status in ('submitted', 'under_review', 'approved') then
    raise exception 'Withdraw the current active verification before submitting another.';
  end if;

  if found then
    update public.agilecert_identity_verifications
    set status = 'withdrawn',
        updated_at = now(),
        metadata = metadata || jsonb_build_object('supersededAt', now())
    where id = v_previous.id;
  end if;

  insert into public.agilecert_identity_verifications (
    candidate_id,
    status,
    legal_name_snapshot,
    phone_snapshot,
    country_code_snapshot,
    affiliation_type,
    affiliation_name,
    affiliation_reference,
    evidence_category,
    evidence_object_path,
    evidence_filename,
    evidence_mime_type,
    evidence_size_bytes,
    candidate_notes,
    attested_at,
    submitted_at,
    supersedes_id,
    metadata
  )
  values (
    v_candidate_id,
    'submitted',
    trim(v_profile.legal_name),
    trim(v_profile.phone),
    upper(v_profile.country_code),
    v_affiliation_type,
    trim(p_affiliation_name),
    nullif(trim(coalesce(p_affiliation_reference, '')), ''),
    v_category,
    v_path,
    trim(p_evidence_filename),
    v_mime,
    p_evidence_size_bytes,
    nullif(trim(coalesce(p_candidate_notes, '')), ''),
    now(),
    now(),
    v_previous.id,
    jsonb_build_object(
      'verificationMethod', 'manual_iipm_review',
      'governmentIdProhibited', true,
      'biometricsProhibited', true
    )
  )
  returning * into v_created;

  insert into public.agilecert_identity_verification_audits (
    verification_id, actor_id, candidate_id, action, metadata
  ) values (
    v_created.id,
    v_candidate_id,
    v_candidate_id,
    'identity_assurance_submitted',
    jsonb_build_object(
      'evidenceCategory', v_created.evidence_category,
      'affiliationType', v_created.affiliation_type,
      'evidenceFilename', v_created.evidence_filename
    )
  );

  return jsonb_build_object(
    'id', v_created.id,
    'status', v_created.status,
    'submittedAt', v_created.submitted_at,
    'professionalCheckoutUnlocked', false
  );
end;
$$;

create or replace function public.withdraw_my_agilecert_identity_assurance(
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_verification public.agilecert_identity_verifications%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_verification
  from public.agilecert_identity_verifications
  where candidate_id = v_candidate_id
    and status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved')
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active identity-assurance submission was found.';
  end if;

  update public.agilecert_identity_verifications
  set status = 'withdrawn',
      updated_at = now(),
      metadata = metadata || jsonb_build_object('withdrawnAt', now(), 'withdrawalReason', v_reason)
  where id = v_verification.id
  returning * into v_verification;

  insert into public.agilecert_identity_verification_audits (
    verification_id, actor_id, candidate_id, action, metadata
  ) values (
    v_verification.id,
    v_candidate_id,
    v_candidate_id,
    'identity_assurance_withdrawn',
    jsonb_build_object('reason', v_reason, 'previousStatus', v_verification.status)
  );

  return jsonb_build_object('id', v_verification.id, 'status', v_verification.status);
end;
$$;

create or replace function public.get_agilecert_identity_assurance_admin_console(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_submissions jsonb;
  v_audits jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'candidateId', v.candidate_id,
    'candidateName', coalesce(cp.legal_name, p.full_name),
    'candidateEmail', p.email,
    'status', v.status,
    'legalNameSnapshot', v.legal_name_snapshot,
    'phoneSnapshot', v.phone_snapshot,
    'countryCodeSnapshot', v.country_code_snapshot,
    'affiliationType', v.affiliation_type,
    'affiliationName', v.affiliation_name,
    'affiliationReference', v.affiliation_reference,
    'evidenceCategory', v.evidence_category,
    'evidenceObjectPath', v.evidence_object_path,
    'evidenceFilename', v.evidence_filename,
    'evidenceMimeType', v.evidence_mime_type,
    'evidenceSizeBytes', v.evidence_size_bytes,
    'candidateNotes', v.candidate_notes,
    'submittedAt', v.submitted_at,
    'reviewStartedAt', v.review_started_at,
    'reviewedAt', v.reviewed_at,
    'reviewedBy', v.reviewed_by,
    'reviewNote', v.review_note,
    'approvalExpiresAt', v.approval_expires_at,
    'createdAt', v.created_at,
    'updatedAt', v.updated_at
  ) order by coalesce(v.submitted_at, v.created_at) desc), '[]'::jsonb)
  into v_submissions
  from (
    select *
    from public.agilecert_identity_verifications
    where v_status is null or status = v_status
    order by coalesce(submitted_at, created_at) desc
    limit v_limit
  ) v
  join public.profiles p on p.id = v.candidate_id
  left join public.agilecert_candidate_profiles cp on cp.user_id = v.candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'verificationId', a.verification_id,
    'actorId', a.actor_id,
    'candidateId', a.candidate_id,
    'action', a.action,
    'metadata', a.metadata,
    'createdAt', a.created_at
  ) order by a.created_at desc), '[]'::jsonb)
  into v_audits
  from (
    select * from public.agilecert_identity_verification_audits
    order by created_at desc
    limit v_limit
  ) a;

  return jsonb_build_object(
    'submissions', v_submissions,
    'audits', v_audits,
    'counts', jsonb_build_object(
      'submitted', (select count(*) from public.agilecert_identity_verifications where status = 'submitted'),
      'underReview', (select count(*) from public.agilecert_identity_verifications where status = 'under_review'),
      'changesRequested', (select count(*) from public.agilecert_identity_verifications where status = 'changes_requested'),
      'approved', (select count(*) from public.agilecert_identity_verifications where status = 'approved'),
      'rejected', (select count(*) from public.agilecert_identity_verifications where status = 'rejected')
    ),
    'adminId', v_admin_id
  );
end;
$$;

create or replace function public.review_agilecert_identity_assurance(
  p_verification_id uuid,
  p_decision text,
  p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(trim(coalesce(p_review_note, '')), '');
  v_verification public.agilecert_identity_verifications%rowtype;
  v_current_legal_name text;
begin
  if v_decision not in ('under_review', 'changes_requested', 'approved', 'rejected') then
    raise exception 'Select a valid identity-assurance decision.';
  end if;

  if v_note is null or length(v_note) < 5 then
    raise exception 'A clear review note is required.';
  end if;

  select * into v_verification
  from public.agilecert_identity_verifications
  where id = p_verification_id
  for update;

  if not found then
    raise exception 'The identity-assurance submission was not found.';
  end if;

  if v_verification.status not in ('submitted', 'under_review') then
    raise exception 'This identity-assurance submission cannot be reviewed from status %.', v_verification.status;
  end if;

  select coalesce(nullif(trim(cp.legal_name), ''), nullif(trim(p.full_name), ''))
  into v_current_legal_name
  from public.profiles p
  left join public.agilecert_candidate_profiles cp on cp.user_id = p.id
  where p.id = v_verification.candidate_id
    and p.role = 'candidate'
    and p.is_active = true;

  if v_decision = 'approved'
     and lower(trim(coalesce(v_current_legal_name, ''))) <> lower(trim(v_verification.legal_name_snapshot)) then
    raise exception 'The current candidate legal name no longer matches the submitted snapshot.';
  end if;

  update public.agilecert_identity_verifications
  set status = v_decision,
      review_started_at = case
        when v_decision = 'under_review' then coalesce(review_started_at, now())
        else coalesce(review_started_at, now())
      end,
      reviewed_at = case when v_decision in ('changes_requested', 'approved', 'rejected') then now() else reviewed_at end,
      reviewed_by = v_admin_id,
      review_note = left(v_note, 2000),
      approval_expires_at = case when v_decision = 'approved' then now() + interval '2 years' else null end,
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'verificationMethod', 'manual_iipm_review',
        'lastDecision', v_decision,
        'lastDecisionAt', now()
      )
  where id = v_verification.id
  returning * into v_verification;

  insert into public.agilecert_identity_verification_audits (
    verification_id, actor_id, candidate_id, action, metadata
  ) values (
    v_verification.id,
    v_admin_id,
    v_verification.candidate_id,
    'identity_assurance_' || v_decision,
    jsonb_build_object(
      'reviewNote', left(v_note, 2000),
      'evidenceCategory', v_verification.evidence_category,
      'legalNameSnapshot', v_verification.legal_name_snapshot
    )
  );

  return jsonb_build_object(
    'id', v_verification.id,
    'status', v_verification.status,
    'reviewedAt', v_verification.reviewed_at,
    'reviewedBy', v_verification.reviewed_by,
    'reviewNote', v_verification.review_note,
    'approvalExpiresAt', v_verification.approval_expires_at
  );
end;
$$;

create or replace function public.create_agilecert_professional_certificate_order(
  p_eligibility_id uuid,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_requested_currency text := nullif(upper(trim(coalesce(p_currency, ''))), '');
  v_currency text;
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_price public.agilecert_certificate_product_prices%rowtype;
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_identity public.agilecert_identity_verifications%rowtype;
  v_existing_order public.agilecert_certificate_orders%rowtype;
  v_existing_certificate public.agilecert_issued_certificates%rowtype;
  v_order public.agilecert_certificate_orders%rowtype;
  v_passed_at timestamptz;
  v_early_expires_at timestamptz;
  v_pricing_window text;
  v_list_amount bigint;
  v_discount bigint;
  v_payable bigint;
  v_reference text;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  perform public.evaluate_agilecert_certificate_eligibility(v_eligibility.attempt_id);

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id and candidate_id = v_candidate_id
  for update;

  select * into v_existing_certificate
  from public.agilecert_issued_certificates
  where eligibility_id = v_eligibility.id;

  if found then
    return jsonb_build_object(
      'status', 'already_issued',
      'paymentRequired', false,
      'certificateId', v_existing_certificate.id,
      'certificateNumber', v_existing_certificate.certificate_number,
      'verificationCode', v_existing_certificate.verification_code
    );
  end if;

  if v_eligibility.eligibility_status not in ('eligible', 'requested')
     or v_eligibility.integrity_status <> 'cleared' then
    raise exception 'This examination result is not eligible for certificate purchase.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_candidate_id;

  if not found or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'Complete your legal name and candidate profile before purchasing a certificate.';
  end if;

  select * into v_identity
  from public.agilecert_identity_verifications
  where candidate_id = v_candidate_id
    and status = 'approved'
    and (approval_expires_at is null or approval_expires_at > now())
    and lower(trim(legal_name_snapshot)) = lower(trim(v_profile.legal_name))
  order by reviewed_at desc
  limit 1
  for share;

  if not found then
    raise exception 'An approved IIPM identity-assurance record is required for Professional Certificate checkout.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = 'professional' and active = true;

  if not found then
    raise exception 'The Professional Certificate product is unavailable.';
  end if;

  v_currency := coalesce(
    v_profile.preferred_currency,
    case when upper(coalesce(v_profile.country_code, '')) = 'NG' then 'NGN' else 'USD' end
  );

  if v_requested_currency is not null and v_requested_currency <> v_currency then
    raise exception 'The requested currency does not match the candidate pricing market.';
  end if;

  select * into v_price
  from public.agilecert_certificate_product_prices
  where product_code = 'professional' and currency = v_currency and active = true;

  if not found then
    raise exception 'Professional Certificate pricing is unavailable for the selected market.';
  end if;

  select * into v_existing_order
  from public.agilecert_certificate_orders
  where eligibility_id = v_eligibility.id
    and product_code = 'professional'
    and status in ('pending', 'initialized', 'paid', 'waived')
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_existing_order.status in ('paid', 'waived') then
      return jsonb_build_object(
        'orderId', v_existing_order.id,
        'reference', v_existing_order.reference,
        'eligibilityId', v_existing_order.eligibility_id,
        'productCode', v_existing_order.product_code,
        'currency', v_existing_order.currency,
        'pricingWindow', v_existing_order.pricing_window,
        'listAmountMinor', v_existing_order.list_amount_minor,
        'discountAmountMinor', v_existing_order.discount_amount_minor,
        'payableAmountMinor', v_existing_order.payable_amount_minor,
        'status', v_existing_order.status,
        'paymentRequired', false,
        'alreadyPaid', true,
        'fulfilledAt', v_existing_order.fulfilled_at
      );
    end if;

    if v_existing_order.expires_at is null or v_existing_order.expires_at > now() then
      return jsonb_build_object(
        'orderId', v_existing_order.id,
        'reference', v_existing_order.reference,
        'eligibilityId', v_existing_order.eligibility_id,
        'productCode', v_existing_order.product_code,
        'currency', v_existing_order.currency,
        'pricingWindow', v_existing_order.pricing_window,
        'listAmountMinor', v_existing_order.list_amount_minor,
        'discountAmountMinor', v_existing_order.discount_amount_minor,
        'payableAmountMinor', v_existing_order.payable_amount_minor,
        'status', v_existing_order.status,
        'authorizationUrl', v_existing_order.gateway_authorization_url,
        'accessCode', v_existing_order.gateway_access_code,
        'expiresAt', v_existing_order.expires_at,
        'paymentRequired', true
      );
    end if;

    update public.agilecert_certificate_orders
    set status = 'expired',
        gateway_authorization_url = null,
        gateway_access_code = null,
        updated_at = now()
    where id = v_existing_order.id;
  end if;

  select coalesce(a.submitted_at, a.graded_at, v_eligibility.evaluated_at)
  into v_passed_at
  from public.attempts a
  where a.id = v_eligibility.attempt_id;

  v_passed_at := coalesce(v_passed_at, v_eligibility.evaluated_at);
  v_early_expires_at := v_passed_at + interval '7 days';

  if now() <= v_early_expires_at then
    v_pricing_window := 'early';
    v_payable := v_price.early_amount_minor;
    v_discount := v_price.standard_amount_minor - v_price.early_amount_minor;
  else
    v_pricing_window := 'standard';
    v_payable := v_price.standard_amount_minor;
    v_discount := 0;
  end if;

  v_list_amount := v_price.standard_amount_minor;
  v_reference := 'AGC-PRO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 21));

  insert into public.agilecert_certificate_orders (
    reference, candidate_id, eligibility_id, product_code, currency,
    pricing_window, list_amount_minor, discount_amount_minor,
    payable_amount_minor, status, expires_at, metadata
  ) values (
    v_reference, v_candidate_id, v_eligibility.id, 'professional', v_currency,
    v_pricing_window, v_list_amount, v_discount, v_payable, 'pending',
    now() + interval '30 minutes',
    jsonb_build_object(
      'passedAt', v_passed_at,
      'earlyPriceExpiresAt', v_early_expires_at,
      'createdFrom', 'candidate_checkout',
      'identityVerificationId', v_identity.id,
      'identityVerifiedAt', v_identity.reviewed_at,
      'verificationMethod', 'manual_iipm_review',
      'verifiedLegalName', v_identity.legal_name_snapshot
    )
  ) returning * into v_order;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id, candidate_id, order_id, action, metadata
  ) values (
    v_candidate_id, v_candidate_id, v_order.id,
    'professional_order_created',
    jsonb_build_object(
      'identityVerificationId', v_identity.id,
      'currency', v_currency,
      'pricingWindow', v_pricing_window,
      'payableAmountMinor', v_payable
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'eligibilityId', v_order.eligibility_id,
    'productCode', v_order.product_code,
    'productTitle', v_product.title,
    'currency', v_order.currency,
    'pricingWindow', v_order.pricing_window,
    'listAmountMinor', v_order.list_amount_minor,
    'discountAmountMinor', v_order.discount_amount_minor,
    'payableAmountMinor', v_order.payable_amount_minor,
    'status', v_order.status,
    'expiresAt', v_order.expires_at,
    'identityVerificationId', v_identity.id,
    'paymentRequired', true
  );
end;
$$;

create or replace function public.agilecert_issue_identity_verified_certificate_for_order(
  p_order_id uuid,
  p_actor_id uuid default null,
  p_authorisation_type text default 'verified_payment'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.agilecert_certificate_orders%rowtype;
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_identity public.agilecert_identity_verifications%rowtype;
  v_result jsonb;
begin
  select * into v_order
  from public.agilecert_certificate_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The certificate order was not found.';
  end if;

  if v_order.product_code <> 'professional' then
    return public.agilecert_issue_certificate_for_order(
      p_order_id, p_actor_id, p_authorisation_type
    );
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_order.candidate_id;

  select * into v_identity
  from public.agilecert_identity_verifications
  where candidate_id = v_order.candidate_id
    and status = 'approved'
    and (approval_expires_at is null or approval_expires_at > now())
    and lower(trim(legal_name_snapshot)) = lower(trim(v_profile.legal_name))
  order by reviewed_at desc
  limit 1
  for share;

  if not found then
    raise exception 'Professional Certificate issuance requires an active approved IIPM identity-assurance record.';
  end if;

  -- The Phase 4 issuer intentionally blocks products marked as requiring
  -- identity verification. The product row is changed only inside this
  -- transaction, remains invisible to concurrent transactions, and is restored
  -- before commit after the Phase 5 server check above has passed.
  update public.agilecert_certificate_products
  set requires_identity_verification = false
  where code = 'professional';

  v_result := public.agilecert_issue_certificate_for_order(
    p_order_id, p_actor_id, p_authorisation_type
  );

  update public.agilecert_certificate_products
  set requires_identity_verification = true
  where code = 'professional';

  update public.agilecert_issued_certificates
  set metadata = metadata || jsonb_build_object(
    'identityVerificationId', v_identity.id,
    'identityVerifiedAt', v_identity.reviewed_at,
    'identityVerificationMethod', 'manual_iipm_review',
    'verifiedLegalName', v_identity.legal_name_snapshot,
    'identityReviewerId', v_identity.reviewed_by,
    'identityEvidenceCategory', v_identity.evidence_category
  )
  where id = (v_result->>'certificateId')::uuid;

  update public.agilecert_paid_credentials
  set metadata = metadata || jsonb_build_object(
    'identityVerificationId', v_identity.id,
    'identityVerifiedAt', v_identity.reviewed_at,
    'identityVerificationMethod', 'manual_iipm_review',
    'verifiedLegalName', v_identity.legal_name_snapshot,
    'identityReviewerId', v_identity.reviewed_by,
    'identityEvidenceCategory', v_identity.evidence_category
  )
  where id = (v_result->>'credentialId')::uuid;

  insert into public.agilecert_identity_verification_audits (
    verification_id, actor_id, candidate_id, action, metadata
  ) values (
    v_identity.id,
    p_actor_id,
    v_order.candidate_id,
    'professional_credential_identity_rechecked',
    jsonb_build_object(
      'orderId', v_order.id,
      'certificateId', v_result->>'certificateId',
      'credentialId', v_result->>'credentialId'
    )
  );

  return v_result || jsonb_build_object(
    'identityVerificationId', v_identity.id,
    'identityVerified', true
  );
end;
$$;

create or replace function public.fulfil_paid_agilecert_certificate_order(
  p_order_id uuid,
  p_provider_transaction_id text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.agilecert_certificate_orders%rowtype;
  v_result jsonb;
begin
  select * into v_order
  from public.agilecert_certificate_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The certificate order was not found.';
  end if;

  if v_order.status in ('paid', 'waived') and v_order.fulfilled_at is not null then
    return public.agilecert_issue_identity_verified_certificate_for_order(
      v_order.id,
      null,
      case when v_order.status = 'waived' then 'administrator_waiver' else 'verified_payment' end
    );
  end if;

  if v_order.status not in ('pending', 'initialized', 'paid') then
    raise exception 'This certificate order cannot be fulfilled from status %.', v_order.status;
  end if;

  update public.agilecert_certificate_orders
  set status = 'paid',
      gateway_reference = coalesce(nullif(trim(p_provider_transaction_id), ''), gateway_reference),
      provider_transaction_id = nullif(trim(p_provider_transaction_id), ''),
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.agilecert_certificate_payments (
    order_id, provider, reference, status, amount_minor, currency,
    provider_transaction_id, provider_payload, verified_at
  ) values (
    v_order.id, v_order.payment_provider, v_order.reference, 'success',
    v_order.payable_amount_minor, v_order.currency,
    nullif(trim(p_provider_transaction_id), ''),
    coalesce(p_provider_payload, '{}'::jsonb), now()
  )
  on conflict (provider, reference) do update
  set status = 'success',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      provider_transaction_id = excluded.provider_transaction_id,
      provider_payload = excluded.provider_payload,
      verified_at = coalesce(public.agilecert_certificate_payments.verified_at, excluded.verified_at),
      updated_at = now();

  v_result := public.agilecert_issue_identity_verified_certificate_for_order(
    v_order.id, null, 'verified_payment'
  );

  return v_result || jsonb_build_object('verified', true, 'paymentStatus', 'success');
end;
$$;

alter table public.agilecert_identity_verifications enable row level security;
alter table public.agilecert_identity_verification_audits enable row level security;

drop policy if exists agilecert_identity_verifications_select_own_or_admin
  on public.agilecert_identity_verifications;
create policy agilecert_identity_verifications_select_own_or_admin
  on public.agilecert_identity_verifications
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_active_certificate_admin(auth.uid())
  );

drop policy if exists agilecert_identity_audits_select_admin
  on public.agilecert_identity_verification_audits;
create policy agilecert_identity_audits_select_admin
  on public.agilecert_identity_verification_audits
  for select
  to authenticated
  using (public.agilecert_is_active_certificate_admin(auth.uid()));

drop policy if exists agilecert_identity_evidence_insert_own
  on storage.objects;
create policy agilecert_identity_evidence_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'agilecert-identity-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'candidate' and p.is_active = true
    )
  );

drop policy if exists agilecert_identity_evidence_select_own_or_admin
  on storage.objects;
create policy agilecert_identity_evidence_select_own_or_admin
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'agilecert-identity-evidence'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.agilecert_is_active_certificate_admin(auth.uid())
    )
  );

revoke all on public.agilecert_identity_verifications from anon, authenticated;
revoke all on public.agilecert_identity_verification_audits from anon, authenticated;
grant select on public.agilecert_identity_verifications to authenticated;
grant select on public.agilecert_identity_verification_audits to authenticated;

revoke all on function public.get_my_agilecert_identity_assurance() from public, anon, authenticated;
grant execute on function public.get_my_agilecert_identity_assurance() to authenticated;

revoke all on function public.submit_my_agilecert_identity_assurance(
  text, text, text, text, text, text, text, bigint, text, boolean
) from public, anon, authenticated;
grant execute on function public.submit_my_agilecert_identity_assurance(
  text, text, text, text, text, text, text, bigint, text, boolean
) to authenticated;

revoke all on function public.withdraw_my_agilecert_identity_assurance(text)
  from public, anon, authenticated;
grant execute on function public.withdraw_my_agilecert_identity_assurance(text)
  to authenticated;

revoke all on function public.get_agilecert_identity_assurance_admin_console(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_identity_assurance_admin_console(text, integer)
  to authenticated;

revoke all on function public.review_agilecert_identity_assurance(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_agilecert_identity_assurance(uuid, text, text)
  to authenticated;

revoke all on function public.create_agilecert_professional_certificate_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_agilecert_professional_certificate_order(uuid, text)
  to authenticated;

revoke all on function public.agilecert_issue_identity_verified_certificate_for_order(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb)
  from public, anon, authenticated;

comment on table public.agilecert_identity_verifications is
  'Private manual IIPM identity-assurance submissions. Government ID and biometric evidence are prohibited in Phase 5.';

comment on function public.create_agilecert_professional_certificate_order(uuid, text) is
  'Creates a Professional Certificate order only for an authenticated eligible candidate with an active approved IIPM identity-assurance record.';

commit;
