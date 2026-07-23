begin;

create or replace function public.create_agilecert_certificate_order(
  p_eligibility_id uuid,
  p_product_code text,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_eligibility public.agilecert_certificate_eligibilities;
  v_product public.agilecert_certificate_products;
  v_price public.agilecert_certificate_product_prices;
  v_profile public.agilecert_candidate_profiles;
  v_order public.agilecert_certificate_orders;
  v_currency text;
  v_reference text;
  v_payable bigint;
  v_discount bigint;
  v_window text;
  v_existing_credential public.agilecert_credentials;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_product_code not in ('achievement', 'professional') then
    raise exception 'A valid certificate product is required.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibilities
  where id = p_eligibility_id
    and candidate_id = v_user_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  if v_eligibility.eligibility_status <> 'eligible' then
    raise exception 'This examination result is not currently eligible for certification.';
  end if;

  if v_eligibility.integrity_status <> 'cleared' then
    raise exception 'The examination integrity review must be cleared before certification.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = p_product_code
    and active;

  if not found then
    raise exception 'The selected certificate product is unavailable.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_user_id;

  if not found then
    raise exception 'Complete your AgileCert profile before purchasing a certificate.';
  end if;

  if nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'Your legal name is required before purchasing a certificate.';
  end if;

  if v_product.requires_identity_verification
     and v_profile.identity_verification_status <> 'verified' then
    raise exception 'Government-issued identity verification is required for the Professional Certificate.';
  end if;

  v_currency := coalesce(
    v_profile.pricing_currency,
    case when upper(coalesce(v_profile.country_code, '')) = 'NG' then 'NGN' else 'USD' end
  );

  if p_currency is not null and upper(trim(p_currency)) <> v_currency then
    raise exception 'The requested currency does not match the verified candidate pricing market.';
  end if;

  select * into v_price
  from public.agilecert_certificate_product_prices
  where product_code = p_product_code
    and currency = v_currency
    and active;

  if not found then
    raise exception 'Certificate pricing is unavailable for the selected currency.';
  end if;

  select * into v_existing_credential
  from public.agilecert_credentials
  where eligibility_id = v_eligibility.id
    and product_code = p_product_code
  order by issued_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'already_issued',
      'paymentRequired', false,
      'credentialId', v_existing_credential.id,
      'credentialCode', v_existing_credential.credential_code,
      'verificationSlug', v_existing_credential.verification_slug
    );
  end if;

  select * into v_order
  from public.agilecert_certificate_orders
  where eligibility_id = v_eligibility.id
    and product_code = p_product_code
    and status in ('pending', 'initialized', 'paid', 'waived')
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_order.status in ('paid', 'waived') then
      return jsonb_build_object(
        'orderId', v_order.id,
        'reference', v_order.reference,
        'eligibilityId', v_order.eligibility_id,
        'productCode', v_order.product_code,
        'currency', v_order.currency,
        'listAmountMinor', v_order.list_amount_minor,
        'discountAmountMinor', v_order.discount_amount_minor,
        'payableAmountMinor', v_order.payable_amount_minor,
        'pricingWindow', v_order.pricing_window,
        'status', v_order.status,
        'paymentRequired', false,
        'alreadyPaid', true
      );
    end if;

    if v_order.expires_at is null or v_order.expires_at > now() then
      return jsonb_build_object(
        'orderId', v_order.id,
        'reference', v_order.reference,
        'eligibilityId', v_order.eligibility_id,
        'productCode', v_order.product_code,
        'currency', v_order.currency,
        'listAmountMinor', v_order.list_amount_minor,
        'discountAmountMinor', v_order.discount_amount_minor,
        'payableAmountMinor', v_order.payable_amount_minor,
        'pricingWindow', v_order.pricing_window,
        'status', v_order.status,
        'authorizationUrl', v_order.gateway_authorization_url,
        'accessCode', v_order.gateway_access_code,
        'expiresAt', v_order.expires_at,
        'paymentRequired', true
      );
    end if;

    update public.agilecert_certificate_orders
    set status = 'expired', updated_at = now()
    where id = v_order.id;
  end if;

  if now() <= v_eligibility.early_price_expires_at then
    v_payable := v_price.early_amount_minor;
    v_discount := v_price.standard_amount_minor - v_price.early_amount_minor;
    v_window := 'early';
  else
    v_payable := v_price.standard_amount_minor;
    v_discount := 0;
    v_window := 'standard';
  end if;

  if v_payable <= 0 then
    raise exception 'The certificate payable amount is invalid.';
  end if;

  v_reference := 'AGC-CERT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

  insert into public.agilecert_certificate_orders (
    reference,
    candidate_id,
    eligibility_id,
    product_code,
    currency,
    pricing_window,
    list_amount_minor,
    discount_amount_minor,
    payable_amount_minor,
    status,
    expires_at
  )
  values (
    v_reference,
    v_user_id,
    v_eligibility.id,
    p_product_code,
    v_currency,
    v_window,
    v_price.standard_amount_minor,
    v_discount,
    v_payable,
    'pending',
    now() + interval '30 minutes'
  )
  returning * into v_order;

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'eligibilityId', v_order.eligibility_id,
    'productCode', v_order.product_code,
    'productTitle', v_product.title,
    'currency', v_order.currency,
    'listAmountMinor', v_order.list_amount_minor,
    'discountAmountMinor', v_order.discount_amount_minor,
    'payableAmountMinor', v_order.payable_amount_minor,
    'pricingWindow', v_order.pricing_window,
    'status', v_order.status,
    'expiresAt', v_order.expires_at,
    'paymentRequired', true
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
  v_order public.agilecert_certificate_orders;
  v_eligibility public.agilecert_certificate_eligibilities;
  v_product public.agilecert_certificate_products;
  v_profile public.agilecert_candidate_profiles;
  v_credential public.agilecert_credentials;
  v_badge public.agilecert_digital_badges;
  v_programme_code text;
  v_random_code text;
  v_credential_code text;
  v_verification_slug text;
  v_credential_title text;
begin
  select * into v_order
  from public.agilecert_certificate_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The certificate order was not found.';
  end if;

  select * into v_credential
  from public.agilecert_credentials
  where certificate_order_id = v_order.id;

  if found then
    return jsonb_build_object(
      'orderId', v_order.id,
      'status', v_order.status,
      'credentialId', v_credential.id,
      'credentialCode', v_credential.credential_code,
      'verificationSlug', v_credential.verification_slug,
      'alreadyFulfilled', true
    );
  end if;

  if v_order.status not in ('pending', 'initialized') then
    raise exception 'This certificate order cannot be fulfilled from status %.', v_order.status;
  end if;

  if v_order.expires_at is not null and v_order.expires_at <= now() then
    update public.agilecert_certificate_orders
    set status = 'expired', updated_at = now()
    where id = v_order.id;
    raise exception 'The certificate payment order has expired.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibilities
  where id = v_order.eligibility_id
  for update;

  if not found
     or v_eligibility.eligibility_status <> 'eligible'
     or v_eligibility.integrity_status <> 'cleared' then
    raise exception 'The underlying examination result is not eligible for certification.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_order.product_code
    and active;

  if not found then
    raise exception 'The certificate product is unavailable.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_order.candidate_id;

  if not found or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'The candidate legal name is required before credential issuance.';
  end if;

  if v_product.requires_identity_verification
     and v_profile.identity_verification_status <> 'verified' then
    raise exception 'Identity verification is no longer valid for this Professional Certificate.';
  end if;

  update public.agilecert_certificate_orders
  set
    status = 'paid',
    gateway_reference = nullif(trim(p_provider_transaction_id), ''),
    paid_at = coalesce(paid_at, now()),
    provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  v_programme_code := upper(regexp_replace(coalesce(v_eligibility.programme_code, 'MOD'), '[^A-Za-z0-9]+', '', 'g'));
  if v_programme_code = '' then v_programme_code := 'MOD'; end if;
  v_random_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_credential_code := format('AGC/%s/%s/%s', v_programme_code, extract(year from now())::integer, v_random_code);
  v_verification_slug := lower(format('%s-%s', v_programme_code, v_random_code));
  v_credential_title := case
    when v_order.product_code = 'professional'
      then format('Professional Certificate in %s', v_eligibility.examination_title)
    else format('Certificate of Achievement in %s', v_eligibility.examination_title)
  end;

  insert into public.agilecert_credentials (
    credential_code,
    verification_slug,
    candidate_id,
    eligibility_id,
    certificate_order_id,
    product_code,
    credential_title,
    holder_name,
    examination_title,
    score,
    public_profile_enabled,
    linkedin_credential_name,
    metadata
  )
  values (
    v_credential_code,
    v_verification_slug,
    v_order.candidate_id,
    v_eligibility.id,
    v_order.id,
    v_order.product_code,
    v_credential_title,
    trim(v_profile.legal_name),
    v_eligibility.examination_title,
    v_eligibility.score,
    v_product.includes_public_profile and v_profile.public_profile_enabled,
    v_credential_title,
    jsonb_build_object(
      'passMark', v_eligibility.pass_mark,
      'passedAt', v_eligibility.passed_at,
      'integrityStatus', v_eligibility.integrity_status,
      'identityVerificationStatus', v_profile.identity_verification_status,
      'pricingWindow', v_order.pricing_window,
      'currency', v_order.currency,
      'amountPaidMinor', v_order.payable_amount_minor
    )
  )
  returning * into v_credential;

  insert into public.agilecert_digital_badges (
    credential_id,
    badge_code,
    badge_class,
    badge_assertion,
    share_url
  )
  values (
    v_credential.id,
    'BADGE-' || v_random_code,
    case when v_order.product_code = 'professional'
      then 'agilecert-professional-certificate'
      else 'agilecert-certificate-of-achievement'
    end,
    jsonb_build_object(
      'type', 'OpenBadgeCredential',
      'issuer', 'AgileCert Global by IIPM',
      'recipientName', trim(v_profile.legal_name),
      'credentialCode', v_credential.credential_code,
      'credentialTitle', v_credential.credential_title,
      'examinationTitle', v_credential.examination_title,
      'score', v_credential.score,
      'issuedAt', v_credential.issued_at,
      'verificationSlug', v_credential.verification_slug,
      'status', v_credential.status
    ),
    '/verify/' || v_credential.verification_slug
  )
  returning * into v_badge;

  insert into public.agilecert_automation_jobs (
    candidate_id,
    eligibility_id,
    certificate_order_id,
    job_type,
    scheduled_for,
    payload
  )
  values
    (
      v_order.candidate_id,
      v_eligibility.id,
      v_order.id,
      'credential_generate_assets',
      now(),
      jsonb_build_object('credentialId', v_credential.id, 'badgeId', v_badge.id)
    ),
    (
      v_order.candidate_id,
      v_eligibility.id,
      v_order.id,
      'credential_delivery_email',
      now(),
      jsonb_build_object('credentialId', v_credential.id, 'credentialCode', v_credential.credential_code)
    )
  on conflict do nothing;

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'status', v_order.status,
    'credentialId', v_credential.id,
    'credentialCode', v_credential.credential_code,
    'verificationSlug', v_credential.verification_slug,
    'badgeId', v_badge.id,
    'badgeCode', v_badge.badge_code,
    'alreadyFulfilled', false
  );
end;
$$;

revoke all on function public.create_agilecert_certificate_order(uuid, text, text) from public, anon;
grant execute on function public.create_agilecert_certificate_order(uuid, text, text) to authenticated;

revoke all on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb)
  to service_role;

comment on function public.create_agilecert_certificate_order(uuid, text, text) is
  'Creates a server-priced certificate order for an eligible authenticated candidate.';
comment on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb) is
  'Service-role-only payment fulfilment that issues the credential and digital badge exactly once.';

commit;
