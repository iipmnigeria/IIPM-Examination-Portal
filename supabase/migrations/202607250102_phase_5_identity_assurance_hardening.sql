begin;

-- Phase 5 hardening: prevent identity changes during an active Professional
-- Certificate payment and bind issuance to the exact approved verification
-- captured when the order was created.

create or replace function public.agilecert_guard_and_invalidate_identity_on_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification_id uuid;
begin
  if lower(trim(coalesce(old.legal_name, ''))) = lower(trim(coalesce(new.legal_name, '')))
     and trim(coalesce(old.phone, '')) = trim(coalesce(new.phone, ''))
     and upper(trim(coalesce(old.country_code, ''))) = upper(trim(coalesce(new.country_code, ''))) then
    return new;
  end if;

  update public.agilecert_certificate_orders
  set status = 'expired',
      gateway_authorization_url = null,
      gateway_access_code = null,
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'expiredForIdentityProfileChangeAt', now()
      )
  where candidate_id = new.user_id
    and product_code = 'professional'
    and status in ('pending', 'initialized')
    and expires_at is not null
    and expires_at <= now();

  if exists (
    select 1
    from public.agilecert_certificate_orders o
    where o.candidate_id = new.user_id
      and o.product_code = 'professional'
      and (
        (o.status in ('pending', 'initialized') and (o.expires_at is null or o.expires_at > now()))
        or (o.status = 'paid' and o.fulfilled_at is null)
      )
  ) then
    raise exception 'Legal name, phone or country cannot be changed while a Professional Certificate payment is active. Complete the payment or allow the order to expire.';
  end if;

  update public.agilecert_identity_verifications
  set status = 'expired',
      approval_expires_at = now(),
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'expiredAt', now(),
        'expiredReason', 'candidate_profile_changed'
      )
  where candidate_id = new.user_id
    and status = 'approved'
  returning id into v_verification_id;

  if v_verification_id is not null then
    insert into public.agilecert_identity_verification_audits (
      verification_id,
      actor_id,
      candidate_id,
      action,
      metadata
    ) values (
      v_verification_id,
      new.user_id,
      new.user_id,
      'identity_assurance_expired_profile_change',
      jsonb_build_object(
        'legalNameChanged', lower(trim(coalesce(old.legal_name, ''))) <> lower(trim(coalesce(new.legal_name, ''))),
        'phoneChanged', trim(coalesce(old.phone, '')) <> trim(coalesce(new.phone, '')),
        'countryChanged', upper(trim(coalesce(old.country_code, ''))) <> upper(trim(coalesce(new.country_code, '')))
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_candidate_profile_identity_invalidation
  on public.agilecert_candidate_profiles;
create trigger agilecert_candidate_profile_identity_invalidation
before update of legal_name, phone, country_code
on public.agilecert_candidate_profiles
for each row
execute function public.agilecert_guard_and_invalidate_identity_on_profile_change();

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
  v_previous_status text;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.agilecert_certificate_orders
  set status = 'expired',
      gateway_authorization_url = null,
      gateway_access_code = null,
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'expiredForIdentityWithdrawalAt', now()
      )
  where candidate_id = v_candidate_id
    and product_code = 'professional'
    and status in ('pending', 'initialized')
    and expires_at is not null
    and expires_at <= now();

  if exists (
    select 1
    from public.agilecert_certificate_orders o
    where o.candidate_id = v_candidate_id
      and o.product_code = 'professional'
      and (
        (o.status in ('pending', 'initialized') and (o.expires_at is null or o.expires_at > now()))
        or (o.status = 'paid' and o.fulfilled_at is null)
      )
  ) then
    raise exception 'Identity assurance cannot be withdrawn while a Professional Certificate payment is active. Complete the payment or allow the order to expire.';
  end if;

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

  v_previous_status := v_verification.status;

  update public.agilecert_identity_verifications
  set status = 'withdrawn',
      approval_expires_at = case when status = 'approved' then now() else approval_expires_at end,
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'withdrawnAt', now(),
        'withdrawalReason', v_reason
      )
  where id = v_verification.id
  returning * into v_verification;

  insert into public.agilecert_identity_verification_audits (
    verification_id,
    actor_id,
    candidate_id,
    action,
    metadata
  ) values (
    v_verification.id,
    v_candidate_id,
    v_candidate_id,
    'identity_assurance_withdrawn',
    jsonb_build_object(
      'reason', v_reason,
      'previousStatus', v_previous_status
    )
  );

  return jsonb_build_object(
    'id', v_verification.id,
    'status', v_verification.status,
    'previousStatus', v_previous_status
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
  v_identity_id uuid;
  v_product_requires_identity boolean;
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
      p_order_id,
      p_actor_id,
      p_authorisation_type
    );
  end if;

  begin
    v_identity_id := nullif(v_order.metadata->>'identityVerificationId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'The Professional Certificate order contains an invalid identity-assurance reference.';
  end;

  if v_identity_id is null then
    raise exception 'The Professional Certificate order is not linked to an approved identity-assurance record.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_order.candidate_id;

  if not found or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'The candidate legal name is unavailable for Professional Certificate issuance.';
  end if;

  select * into v_identity
  from public.agilecert_identity_verifications
  where id = v_identity_id
    and candidate_id = v_order.candidate_id
    and status = 'approved'
    and (approval_expires_at is null or approval_expires_at > now())
    and lower(trim(legal_name_snapshot)) = lower(trim(v_profile.legal_name))
  for share;

  if not found then
    raise exception 'Professional Certificate issuance requires the same active approved IIPM identity-assurance record used at checkout.';
  end if;

  select requires_identity_verification
  into v_product_requires_identity
  from public.agilecert_certificate_products
  where code = 'professional'
  for update;

  if not found then
    raise exception 'The Professional Certificate product is unavailable.';
  end if;

  update public.agilecert_certificate_products
  set requires_identity_verification = false
  where code = 'professional';

  v_result := public.agilecert_issue_certificate_for_order(
    p_order_id,
    p_actor_id,
    p_authorisation_type
  );

  update public.agilecert_certificate_products
  set requires_identity_verification = v_product_requires_identity
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
    verification_id,
    actor_id,
    candidate_id,
    action,
    metadata
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

revoke all on function public.agilecert_identity_is_approved(uuid, text)
  from public, anon, authenticated;

revoke all on function public.agilecert_guard_and_invalidate_identity_on_profile_change()
  from public, anon, authenticated;

comment on function public.agilecert_guard_and_invalidate_identity_on_profile_change() is
  'Invalidates an approved identity record when legal name, phone or country changes and prevents changes during an active Professional Certificate payment.';

comment on function public.agilecert_issue_identity_verified_certificate_for_order(uuid, uuid, text) is
  'Issues a Professional Certificate only after rechecking the exact approved identity-assurance record captured on the order.';

commit;
