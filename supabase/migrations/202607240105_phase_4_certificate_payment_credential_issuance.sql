begin;

-- Phase 4: certificate commerce, verified payment authorisation and paid
-- credential issuance. Examination payment, examination runtime, identity
-- verification, communications automation and AI adviser remain unchanged.

create table if not exists public.agilecert_certificate_products (
  code text primary key
    check (code in ('achievement', 'professional')),
  title text not null
    check (length(trim(title)) between 3 and 120),
  description text not null
    check (length(trim(description)) between 10 and 1000),
  requires_identity_verification boolean not null default false,
  includes_badge boolean not null default true,
  includes_transcript boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agilecert_certificate_products (
  code,
  title,
  description,
  requires_identity_verification,
  includes_badge,
  includes_transcript,
  active
)
values
  (
    'achievement',
    'Certificate of Achievement',
    'Confirms that the candidate passed the specialist examination and includes a digital certificate, public verification and achievement badge.',
    false,
    true,
    false,
    true
  ),
  (
    'professional',
    'Professional Certificate',
    'Higher-assurance credential with identity verification, enhanced badge, transcript, public professional profile and LinkedIn-ready information.',
    true,
    true,
    true,
    true
  )
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    requires_identity_verification = excluded.requires_identity_verification,
    includes_badge = excluded.includes_badge,
    includes_transcript = excluded.includes_transcript,
    active = excluded.active,
    updated_at = now();

create table if not exists public.agilecert_certificate_product_prices (
  product_code text not null
    references public.agilecert_certificate_products(code) on delete cascade,
  currency text not null
    check (currency in ('NGN', 'USD')),
  early_amount_minor bigint not null
    check (early_amount_minor > 0),
  standard_amount_minor bigint not null
    check (standard_amount_minor >= early_amount_minor),
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_code, currency)
);

insert into public.agilecert_certificate_product_prices (
  product_code,
  currency,
  early_amount_minor,
  standard_amount_minor,
  active
)
values
  ('achievement', 'NGN', 2000000, 2500000, true),
  ('achievement', 'USD', 3500, 5000, true),
  ('professional', 'NGN', 5000000, 7500000, true),
  ('professional', 'USD', 6000, 7500, true)
on conflict (product_code, currency) do nothing;

create table if not exists public.agilecert_certificate_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  candidate_id uuid not null
    references public.profiles(id) on delete restrict,
  eligibility_id uuid not null
    references public.agilecert_certificate_eligibility_records(id) on delete restrict,
  product_code text not null
    references public.agilecert_certificate_products(code) on delete restrict,
  currency text not null
    check (currency in ('NGN', 'USD')),
  pricing_window text not null
    check (pricing_window in ('early', 'standard', 'waived')),
  list_amount_minor bigint not null
    check (list_amount_minor >= 0),
  discount_amount_minor bigint not null default 0
    check (discount_amount_minor >= 0),
  payable_amount_minor bigint not null
    check (payable_amount_minor >= 0),
  status text not null default 'pending'
    check (status in (
      'pending',
      'initialized',
      'paid',
      'waived',
      'expired',
      'failed',
      'cancelled',
      'refunded',
      'disputed'
    )),
  payment_provider text not null default 'paystack',
  gateway_authorization_url text,
  gateway_access_code text,
  gateway_reference text,
  provider_transaction_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id) on delete set null,
  waiver_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount_minor <= list_amount_minor),
  check (payable_amount_minor <= list_amount_minor),
  check (
    (status = 'waived' and payable_amount_minor = 0)
    or status <> 'waived'
  )
);

create unique index if not exists agilecert_certificate_orders_active_unique_idx
  on public.agilecert_certificate_orders(eligibility_id, product_code)
  where status in ('pending', 'initialized', 'paid', 'waived');

create index if not exists agilecert_certificate_orders_candidate_idx
  on public.agilecert_certificate_orders(candidate_id, created_at desc);

create index if not exists agilecert_certificate_orders_status_idx
  on public.agilecert_certificate_orders(status, updated_at desc);

create table if not exists public.agilecert_certificate_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.agilecert_certificate_orders(id) on delete restrict,
  provider text not null default 'paystack',
  reference text not null,
  status text not null
    check (status in ('initiated', 'success', 'failed', 'refunded', 'disputed')),
  amount_minor bigint not null
    check (amount_minor >= 0),
  currency text not null
    check (currency in ('NGN', 'USD')),
  provider_transaction_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, reference)
);

create index if not exists agilecert_certificate_payments_order_idx
  on public.agilecert_certificate_payments(order_id, created_at desc);

create table if not exists public.agilecert_paid_credentials (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.agilecert_certificate_orders(id) on delete restrict,
  certificate_id uuid not null unique
    references public.agilecert_issued_certificates(id) on delete restrict,
  candidate_id uuid not null
    references public.profiles(id) on delete restrict,
  product_code text not null
    references public.agilecert_certificate_products(code) on delete restrict,
  credential_code text not null unique,
  badge_code text not null unique,
  transcript_code text unique,
  verification_url text not null,
  linkedin_credential_name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_paid_credentials_candidate_idx
  on public.agilecert_paid_credentials(candidate_id, issued_at desc);

create table if not exists public.agilecert_certificate_commerce_audits (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  candidate_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.agilecert_certificate_orders(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_certificate_commerce_audits_created_idx
  on public.agilecert_certificate_commerce_audits(created_at desc);

create or replace function public.agilecert_certificate_market_currency(
  p_candidate_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    cp.preferred_currency,
    case when upper(coalesce(cp.country_code, '')) = 'NG' then 'NGN' else 'USD' end
  )
  from public.agilecert_candidate_profiles cp
  where cp.user_id = p_candidate_id;
$$;

create or replace function public.get_my_agilecert_certificate_commerce()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_currency text;
  v_offers jsonb;
  v_orders jsonb;
  v_credentials jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_candidate_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  v_currency := coalesce(
    public.agilecert_certificate_market_currency(v_candidate_id),
    'USD'
  );

  select coalesce(jsonb_agg(payload order by passed_at desc, product_code), '[]'::jsonb)
  into v_offers
  from (
    select
      coalesce(a.submitted_at, a.graded_at, er.evaluated_at) as passed_at,
      product.code as product_code,
      jsonb_build_object(
        'eligibilityId', er.id,
        'attemptId', er.attempt_id,
        'examinationId', er.examination_id,
        'examinationTitle', e.title,
        'programmeCode', pr.code,
        'score', er.score,
        'passMark', er.pass_mark,
        'integrityStatus', er.integrity_status,
        'eligibilityStatus', er.eligibility_status,
        'passedAt', coalesce(a.submitted_at, a.graded_at, er.evaluated_at),
        'earlyPriceExpiresAt', coalesce(a.submitted_at, a.graded_at, er.evaluated_at) + interval '7 days',
        'productCode', product.code,
        'productTitle', product.title,
        'productDescription', product.description,
        'currency', price.currency,
        'earlyAmountMinor', price.early_amount_minor,
        'standardAmountMinor', price.standard_amount_minor,
        'payableAmountMinor', case
          when now() <= coalesce(a.submitted_at, a.graded_at, er.evaluated_at) + interval '7 days'
            then price.early_amount_minor
          else price.standard_amount_minor
        end,
        'pricingWindow', case
          when now() <= coalesce(a.submitted_at, a.graded_at, er.evaluated_at) + interval '7 days'
            then 'early'
          else 'standard'
        end,
        'checkoutAvailable', not product.requires_identity_verification,
        'blockedReason', case
          when product.requires_identity_verification then 'identity_verification_required'
          else null
        end,
        'requiresIdentityVerification', product.requires_identity_verification,
        'includesBadge', product.includes_badge,
        'includesTranscript', product.includes_transcript,
        'benefits', case product.code
          when 'achievement' then jsonb_build_array(
            'Digital PDF certificate',
            'Unique credential number',
            'Public verification',
            'Achievement digital badge'
          )
          else jsonb_build_array(
            'Professional certificate',
            'Enhanced digital badge',
            'Formal examination transcript',
            'Public professional credential profile',
            'LinkedIn-ready credential information'
          )
        end
      ) as payload
    from public.agilecert_certificate_eligibility_records er
    join public.attempts a on a.id = er.attempt_id
    join public.examinations e on e.id = er.examination_id
    join public.programmes pr on pr.id = e.programme_id
    cross join public.agilecert_certificate_products product
    join public.agilecert_certificate_product_prices price
      on price.product_code = product.code
     and price.currency = v_currency
     and price.active = true
    left join public.agilecert_issued_certificates certificate
      on certificate.eligibility_id = er.id
    where er.candidate_id = v_candidate_id
      and er.integrity_status = 'cleared'
      and er.eligibility_status in ('eligible', 'requested')
      and product.active = true
      and certificate.id is null
  ) available;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId', o.id,
    'reference', o.reference,
    'eligibilityId', o.eligibility_id,
    'productCode', o.product_code,
    'productTitle', product.title,
    'currency', o.currency,
    'pricingWindow', o.pricing_window,
    'listAmountMinor', o.list_amount_minor,
    'discountAmountMinor', o.discount_amount_minor,
    'payableAmountMinor', o.payable_amount_minor,
    'status', o.status,
    'paymentProvider', o.payment_provider,
    'expiresAt', o.expires_at,
    'paidAt', o.paid_at,
    'fulfilledAt', o.fulfilled_at,
    'createdAt', o.created_at
  ) order by o.created_at desc), '[]'::jsonb)
  into v_orders
  from public.agilecert_certificate_orders o
  join public.agilecert_certificate_products product on product.code = o.product_code
  where o.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', credential.id,
    'orderId', credential.order_id,
    'certificateId', credential.certificate_id,
    'productCode', credential.product_code,
    'productTitle', product.title,
    'credentialCode', credential.credential_code,
    'badgeCode', credential.badge_code,
    'transcriptCode', credential.transcript_code,
    'verificationUrl', credential.verification_url,
    'linkedinCredentialName', credential.linkedin_credential_name,
    'status', credential.status,
    'issuedAt', credential.issued_at,
    'certificate', jsonb_build_object(
      'id', certificate.id,
      'certificateNumber', certificate.certificate_number,
      'verificationCode', certificate.verification_code,
      'holderName', certificate.holder_name,
      'certificateTitle', certificate.certificate_title,
      'examinationTitle', certificate.examination_title,
      'programmeCode', certificate.programme_code,
      'score', certificate.score,
      'passMark', certificate.pass_mark,
      'issueDate', certificate.issue_date,
      'issuedAt', certificate.issued_at,
      'status', certificate.status
    )
  ) order by credential.issued_at desc), '[]'::jsonb)
  into v_credentials
  from public.agilecert_paid_credentials credential
  join public.agilecert_certificate_products product
    on product.code = credential.product_code
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where credential.candidate_id = v_candidate_id;

  return jsonb_build_object(
    'marketCurrency', v_currency,
    'offers', v_offers,
    'orders', v_orders,
    'credentials', v_credentials,
    'counts', jsonb_build_object(
      'offers', jsonb_array_length(v_offers),
      'pendingOrders', (
        select count(*)
        from public.agilecert_certificate_orders
        where candidate_id = v_candidate_id
          and status in ('pending', 'initialized')
      ),
      'paidOrders', (
        select count(*)
        from public.agilecert_certificate_orders
        where candidate_id = v_candidate_id
          and status in ('paid', 'waived')
      ),
      'credentials', jsonb_array_length(v_credentials)
    )
  );
end;
$$;

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
  v_candidate_id uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_requested_currency text := nullif(upper(trim(coalesce(p_currency, ''))), '');
  v_currency text;
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_price public.agilecert_certificate_product_prices%rowtype;
  v_profile public.agilecert_candidate_profiles%rowtype;
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

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
    and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  perform public.evaluate_agilecert_certificate_eligibility(v_eligibility.attempt_id);

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
    and candidate_id = v_candidate_id
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

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_product_code
    and active = true;

  if not found then
    raise exception 'The selected certificate product is unavailable.';
  end if;

  if v_product.requires_identity_verification then
    raise exception 'Professional Certificate checkout will open after identity verification is available.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_candidate_id;

  if not found or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'Complete your legal name and candidate profile before purchasing a certificate.';
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
  where product_code = v_product_code
    and currency = v_currency
    and active = true;

  if not found then
    raise exception 'Certificate pricing is unavailable for the selected market.';
  end if;

  select * into v_existing_order
  from public.agilecert_certificate_orders
  where eligibility_id = v_eligibility.id
    and product_code = v_product_code
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
    expires_at,
    metadata
  )
  values (
    v_reference,
    v_candidate_id,
    v_eligibility.id,
    v_product_code,
    v_currency,
    v_pricing_window,
    v_list_amount,
    v_discount,
    v_payable,
    'pending',
    now() + interval '30 minutes',
    jsonb_build_object(
      'passedAt', v_passed_at,
      'earlyPriceExpiresAt', v_early_expires_at,
      'createdFrom', 'candidate_checkout'
    )
  )
  returning * into v_order;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id,
    candidate_id,
    order_id,
    action,
    metadata
  )
  values (
    v_candidate_id,
    v_candidate_id,
    v_order.id,
    'order_created',
    jsonb_build_object(
      'productCode', v_product_code,
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
    'paymentRequired', true
  );
end;
$$;

create or replace function public.agilecert_issue_certificate_for_order(
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
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_policy public.agilecert_certificate_policies%rowtype;
  v_exam public.examinations%rowtype;
  v_candidate public.profiles%rowtype;
  v_legal_name text;
  v_programme_code text;
  v_safe_programme_code text;
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_serial bigint;
  v_random_code text;
  v_certificate_number text;
  v_verification_code text;
  v_credential_code text;
  v_badge_code text;
  v_transcript_code text;
  v_verification_url text;
  v_certificate_title text;
begin
  select * into v_order
  from public.agilecert_certificate_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The certificate order was not found.';
  end if;

  if v_order.status not in ('paid', 'waived') then
    raise exception 'Verified payment or an authorised waiver is required before certificate issuance.';
  end if;

  select * into v_credential
  from public.agilecert_paid_credentials
  where order_id = v_order.id;

  if found then
    return jsonb_build_object(
      'orderId', v_order.id,
      'status', v_order.status,
      'credentialId', v_credential.id,
      'credentialCode', v_credential.credential_code,
      'badgeCode', v_credential.badge_code,
      'transcriptCode', v_credential.transcript_code,
      'verificationUrl', v_credential.verification_url,
      'alreadyFulfilled', true
    );
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = v_order.eligibility_id;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  perform public.evaluate_agilecert_certificate_eligibility(v_eligibility.attempt_id);

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = v_order.eligibility_id
  for update;

  if v_eligibility.eligibility_status not in ('eligible', 'requested', 'issued')
     or v_eligibility.integrity_status <> 'cleared' then
    raise exception 'The authoritative examination result is not eligible for credential issuance.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_order.product_code
    and active = true;

  if not found then
    raise exception 'The certificate product is unavailable.';
  end if;

  if v_product.requires_identity_verification then
    raise exception 'Professional Certificate issuance requires the identity-verification phase.';
  end if;

  select * into v_candidate
  from public.profiles
  where id = v_order.candidate_id
    and role = 'candidate'
    and is_active = true;

  if not found then
    raise exception 'The candidate account is inactive or unavailable.';
  end if;

  select coalesce(
    nullif(trim(cp.legal_name), ''),
    nullif(trim(v_candidate.full_name), '')
  )
  into v_legal_name
  from public.agilecert_candidate_profiles cp
  where cp.user_id = v_order.candidate_id;

  v_legal_name := coalesce(v_legal_name, nullif(trim(v_candidate.full_name), ''));

  if v_legal_name is null or length(v_legal_name) < 3 then
    raise exception 'The candidate must complete a legal name before credential issuance.';
  end if;

  select * into v_exam
  from public.examinations
  where id = v_eligibility.examination_id;

  if not found then
    raise exception 'The examination linked to the eligibility record was not found.';
  end if;

  select p.code into v_programme_code
  from public.programmes p
  where p.id = v_exam.programme_id;

  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = v_eligibility.examination_id;

  select * into v_certificate
  from public.agilecert_issued_certificates
  where eligibility_id = v_eligibility.id;

  if not found then
    v_safe_programme_code := regexp_replace(
      upper(coalesce(v_programme_code, 'CERT')),
      '[^A-Z0-9]+',
      '',
      'g'
    );

    if v_safe_programme_code = '' then
      v_safe_programme_code := 'CERT';
    end if;

    v_serial := nextval('public.agilecert_certificate_serial_seq');
    v_certificate_number := format(
      'IIPM/%s/%s/%s',
      v_safe_programme_code,
      to_char(now(), 'YYYY'),
      lpad(v_serial::text, 6, '0')
    );
    v_verification_code := upper(encode(gen_random_bytes(9), 'hex'));
    v_certificate_title := case
      when v_order.product_code = 'professional' then 'Professional Certificate'
      else coalesce(v_policy.certificate_title, 'Certificate of Achievement')
    end;

    insert into public.agilecert_issued_certificates (
      certificate_number,
      verification_code,
      candidate_id,
      eligibility_id,
      examination_id,
      attempt_id,
      holder_name,
      certificate_title,
      examination_title,
      programme_code,
      score,
      pass_mark,
      issued_by,
      status_changed_by,
      metadata
    )
    values (
      v_certificate_number,
      v_verification_code,
      v_order.candidate_id,
      v_eligibility.id,
      v_eligibility.examination_id,
      v_eligibility.attempt_id,
      v_legal_name,
      v_certificate_title,
      v_exam.title,
      v_programme_code,
      v_eligibility.score,
      v_eligibility.pass_mark,
      p_actor_id,
      p_actor_id,
      jsonb_build_object(
        'issuerName', coalesce(v_policy.issuer_name, 'Integrated Institute of Professional Management (IIPM)'),
        'authority', 'Phase 4 payment-authorised issuance',
        'issuedFromOrder', v_order.id,
        'productCode', v_order.product_code,
        'authorisationType', p_authorisation_type
      )
    )
    returning * into v_certificate;

    update public.agilecert_certificate_eligibility_records
    set eligibility_status = 'issued',
        issued_at = v_certificate.issued_at,
        updated_at = now()
    where id = v_eligibility.id;
  end if;

  v_random_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_safe_programme_code := regexp_replace(
    upper(coalesce(v_programme_code, 'CERT')),
    '[^A-Z0-9]+',
    '',
    'g'
  );
  if v_safe_programme_code = '' then
    v_safe_programme_code := 'CERT';
  end if;

  v_credential_code := format(
    'AGC/%s/%s/%s',
    v_safe_programme_code,
    to_char(now(), 'YYYY'),
    v_random_code
  );
  v_badge_code := 'BADGE-' || v_random_code;
  v_transcript_code := case
    when v_product.includes_transcript then 'TRANSCRIPT-' || v_random_code
    else null
  end;
  v_verification_url :=
    'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' ||
    v_certificate.verification_code;

  insert into public.agilecert_paid_credentials (
    order_id,
    certificate_id,
    candidate_id,
    product_code,
    credential_code,
    badge_code,
    transcript_code,
    verification_url,
    linkedin_credential_name,
    status,
    metadata
  )
  values (
    v_order.id,
    v_certificate.id,
    v_order.candidate_id,
    v_order.product_code,
    v_credential_code,
    v_badge_code,
    v_transcript_code,
    v_verification_url,
    v_certificate.certificate_title || ' in ' || v_certificate.examination_title,
    v_certificate.status,
    jsonb_build_object(
      'certificateNumber', v_certificate.certificate_number,
      'verificationCode', v_certificate.verification_code,
      'pricingWindow', v_order.pricing_window,
      'currency', v_order.currency,
      'amountAuthorisedMinor', v_order.payable_amount_minor,
      'authorisationType', p_authorisation_type,
      'includesBadge', v_product.includes_badge,
      'includesTranscript', v_product.includes_transcript
    )
  )
  returning * into v_credential;

  update public.agilecert_certificate_orders
  set fulfilled_at = coalesce(fulfilled_at, now()),
      updated_at = now()
  where id = v_order.id;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id,
    candidate_id,
    order_id,
    action,
    metadata
  )
  values (
    p_actor_id,
    v_order.candidate_id,
    v_order.id,
    'credential_issued',
    jsonb_build_object(
      'certificateId', v_certificate.id,
      'credentialId', v_credential.id,
      'productCode', v_order.product_code,
      'authorisationType', p_authorisation_type
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'status', v_order.status,
    'certificateId', v_certificate.id,
    'certificateNumber', v_certificate.certificate_number,
    'verificationCode', v_certificate.verification_code,
    'credentialId', v_credential.id,
    'credentialCode', v_credential.credential_code,
    'badgeCode', v_credential.badge_code,
    'transcriptCode', v_credential.transcript_code,
    'verificationUrl', v_credential.verification_url,
    'alreadyFulfilled', false
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
    return public.agilecert_issue_certificate_for_order(
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
    order_id,
    provider,
    reference,
    status,
    amount_minor,
    currency,
    provider_transaction_id,
    provider_payload,
    verified_at
  )
  values (
    v_order.id,
    v_order.payment_provider,
    v_order.reference,
    'success',
    v_order.payable_amount_minor,
    v_order.currency,
    nullif(trim(p_provider_transaction_id), ''),
    coalesce(p_provider_payload, '{}'::jsonb),
    now()
  )
  on conflict (provider, reference) do update
  set status = 'success',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      provider_transaction_id = excluded.provider_transaction_id,
      provider_payload = excluded.provider_payload,
      verified_at = coalesce(public.agilecert_certificate_payments.verified_at, excluded.verified_at),
      updated_at = now();

  v_result := public.agilecert_issue_certificate_for_order(
    v_order.id,
    null,
    'verified_payment'
  );

  return v_result || jsonb_build_object(
    'verified', true,
    'paymentStatus', 'success'
  );
end;
$$;

create or replace function public.waive_agilecert_certificate_order(
  p_eligibility_id uuid,
  p_product_code text default 'achievement',
  p_currency text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_product_code text := lower(trim(coalesce(p_product_code, 'achievement')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_currency text;
  v_price public.agilecert_certificate_product_prices%rowtype;
  v_order public.agilecert_certificate_orders%rowtype;
  v_result jsonb;
begin
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'A clear waiver reason is required.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  perform public.evaluate_agilecert_certificate_eligibility(v_eligibility.attempt_id);

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
  for update;

  if v_eligibility.eligibility_status not in ('eligible', 'requested', 'issued')
     or v_eligibility.integrity_status <> 'cleared' then
    raise exception 'The result is not eligible for a certificate waiver.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_product_code
    and active = true;

  if not found then
    raise exception 'The selected certificate product is unavailable.';
  end if;

  if v_product.requires_identity_verification then
    raise exception 'Professional Certificate waivers require the identity-verification phase.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_eligibility.candidate_id;

  v_currency := coalesce(
    nullif(upper(trim(coalesce(p_currency, ''))), ''),
    v_profile.preferred_currency,
    case when upper(coalesce(v_profile.country_code, '')) = 'NG' then 'NGN' else 'USD' end
  );

  if v_currency not in ('NGN', 'USD') then
    raise exception 'Waiver currency must be NGN or USD.';
  end if;

  select * into v_price
  from public.agilecert_certificate_product_prices
  where product_code = v_product_code
    and currency = v_currency;

  if not found then
    raise exception 'Certificate pricing is unavailable for the waiver market.';
  end if;

  select * into v_order
  from public.agilecert_certificate_orders
  where eligibility_id = v_eligibility.id
    and product_code = v_product_code
    and status in ('paid', 'waived')
  order by created_at desc
  limit 1
  for update;

  if not found then
    update public.agilecert_certificate_orders
    set status = 'cancelled',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object('cancelledForWaiverAt', now(), 'cancelledBy', v_admin_id)
    where eligibility_id = v_eligibility.id
      and product_code = v_product_code
      and status in ('pending', 'initialized');

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
      payment_provider,
      fulfilled_at,
      waived_at,
      waived_by,
      waiver_reason,
      metadata
    )
    values (
      'AGC-WAIVER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18)),
      v_eligibility.candidate_id,
      v_eligibility.id,
      v_product_code,
      v_currency,
      'waived',
      v_price.standard_amount_minor,
      v_price.standard_amount_minor,
      0,
      'waived',
      'administrator_waiver',
      null,
      now(),
      v_admin_id,
      left(v_reason, 500),
      jsonb_build_object('waivedBy', v_admin_id, 'waivedAt', now())
    )
    returning * into v_order;
  end if;

  v_result := public.agilecert_issue_certificate_for_order(
    v_order.id,
    v_admin_id,
    'administrator_waiver'
  );

  return v_result || jsonb_build_object(
    'waived', true,
    'waiverReason', v_order.waiver_reason
  );
end;
$$;

create or replace function public.issue_agilecert_certificate(
  p_eligibility_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_order public.agilecert_certificate_orders%rowtype;
begin
  select * into v_certificate
  from public.agilecert_issued_certificates
  where eligibility_id = p_eligibility_id;

  if found then
    return jsonb_build_object(
      'id', v_certificate.id,
      'certificateNumber', v_certificate.certificate_number,
      'verificationCode', v_certificate.verification_code,
      'status', v_certificate.status,
      'message', 'The certificate already exists.'
    );
  end if;

  select * into v_order
  from public.agilecert_certificate_orders
  where eligibility_id = p_eligibility_id
    and status in ('paid', 'waived')
  order by coalesce(paid_at, waived_at, created_at) desc
  limit 1;

  if not found then
    raise exception 'Verified payment or an authorised waiver is required. Use the certificate commerce console to create a waiver when appropriate.';
  end if;

  return public.agilecert_issue_certificate_for_order(
    v_order.id,
    v_admin_id,
    case when v_order.status = 'waived' then 'administrator_waiver' else 'administrator_issue_after_payment' end
  );
end;
$$;

create or replace function public.upsert_agilecert_certificate_product_price(
  p_product_code text,
  p_currency text,
  p_early_amount_minor bigint,
  p_standard_amount_minor bigint,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_price public.agilecert_certificate_product_prices%rowtype;
begin
  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  if v_currency not in ('NGN', 'USD') then
    raise exception 'Currency must be NGN or USD.';
  end if;

  if p_early_amount_minor <= 0
     or p_standard_amount_minor < p_early_amount_minor then
    raise exception 'Standard price must be equal to or higher than the positive early price.';
  end if;

  insert into public.agilecert_certificate_product_prices (
    product_code,
    currency,
    early_amount_minor,
    standard_amount_minor,
    active,
    updated_by
  )
  values (
    v_product_code,
    v_currency,
    p_early_amount_minor,
    p_standard_amount_minor,
    coalesce(p_active, true),
    v_admin_id
  )
  on conflict (product_code, currency) do update
  set early_amount_minor = excluded.early_amount_minor,
      standard_amount_minor = excluded.standard_amount_minor,
      active = excluded.active,
      updated_by = v_admin_id,
      updated_at = now()
  returning * into v_price;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id,
    action,
    metadata
  )
  values (
    v_admin_id,
    'price_updated',
    jsonb_build_object(
      'productCode', v_product_code,
      'currency', v_currency,
      'earlyAmountMinor', p_early_amount_minor,
      'standardAmountMinor', p_standard_amount_minor,
      'active', coalesce(p_active, true)
    )
  );

  return jsonb_build_object(
    'productCode', v_price.product_code,
    'currency', v_price.currency,
    'earlyAmountMinor', v_price.early_amount_minor,
    'standardAmountMinor', v_price.standard_amount_minor,
    'active', v_price.active,
    'updatedAt', v_price.updated_at
  );
end;
$$;

create or replace function public.get_agilecert_certificate_commerce_admin_console(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
  v_prices jsonb;
  v_orders jsonb;
  v_credentials jsonb;
  v_audits jsonb;
begin
  perform public.agilecert_require_certificate_admin();

  select coalesce(jsonb_agg(jsonb_build_object(
    'productCode', price.product_code,
    'productTitle', product.title,
    'currency', price.currency,
    'earlyAmountMinor', price.early_amount_minor,
    'standardAmountMinor', price.standard_amount_minor,
    'active', price.active,
    'requiresIdentityVerification', product.requires_identity_verification,
    'updatedAt', price.updated_at
  ) order by product.code, price.currency), '[]'::jsonb)
  into v_prices
  from public.agilecert_certificate_product_prices price
  join public.agilecert_certificate_products product
    on product.code = price.product_code;

  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
  into v_orders
  from (
    select o.created_at,
      jsonb_build_object(
        'orderId', o.id,
        'reference', o.reference,
        'candidateId', o.candidate_id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'eligibilityId', o.eligibility_id,
        'examinationTitle', e.title,
        'productCode', o.product_code,
        'productTitle', product.title,
        'currency', o.currency,
        'pricingWindow', o.pricing_window,
        'listAmountMinor', o.list_amount_minor,
        'discountAmountMinor', o.discount_amount_minor,
        'payableAmountMinor', o.payable_amount_minor,
        'status', o.status,
        'paidAt', o.paid_at,
        'fulfilledAt', o.fulfilled_at,
        'waivedAt', o.waived_at,
        'waiverReason', o.waiver_reason,
        'expiresAt', o.expires_at,
        'createdAt', o.created_at
      ) as payload
    from public.agilecert_certificate_orders o
    join public.profiles candidate on candidate.id = o.candidate_id
    join public.agilecert_certificate_eligibility_records er
      on er.id = o.eligibility_id
    join public.examinations e on e.id = er.examination_id
    join public.agilecert_certificate_products product
      on product.code = o.product_code
    order by o.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by issued_at desc), '[]'::jsonb)
  into v_credentials
  from (
    select credential.issued_at,
      jsonb_build_object(
        'id', credential.id,
        'orderId', credential.order_id,
        'certificateId', credential.certificate_id,
        'candidateId', credential.candidate_id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'productCode', credential.product_code,
        'credentialCode', credential.credential_code,
        'badgeCode', credential.badge_code,
        'transcriptCode', credential.transcript_code,
        'verificationUrl', credential.verification_url,
        'status', credential.status,
        'issuedAt', credential.issued_at,
        'certificateNumber', certificate.certificate_number,
        'verificationCode', certificate.verification_code,
        'examinationTitle', certificate.examination_title
      ) as payload
    from public.agilecert_paid_credentials credential
    join public.profiles candidate on candidate.id = credential.candidate_id
    join public.agilecert_issued_certificates certificate
      on certificate.id = credential.certificate_id
    order by credential.issued_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', audit.id,
    'actorId', audit.actor_id,
    'candidateId', audit.candidate_id,
    'orderId', audit.order_id,
    'action', audit.action,
    'metadata', audit.metadata,
    'createdAt', audit.created_at
  ) order by audit.created_at desc), '[]'::jsonb)
  into v_audits
  from (
    select *
    from public.agilecert_certificate_commerce_audits
    order by created_at desc
    limit v_limit
  ) audit;

  return jsonb_build_object(
    'prices', v_prices,
    'orders', v_orders,
    'credentials', v_credentials,
    'audits', v_audits,
    'counts', jsonb_build_object(
      'pendingOrders', (
        select count(*)
        from public.agilecert_certificate_orders
        where status in ('pending', 'initialized')
      ),
      'paidOrders', (
        select count(*)
        from public.agilecert_certificate_orders
        where status = 'paid'
      ),
      'waivedOrders', (
        select count(*)
        from public.agilecert_certificate_orders
        where status = 'waived'
      ),
      'credentials', (
        select count(*)
        from public.agilecert_paid_credentials
      )
    )
  );
end;
$$;

create or replace function public.verify_agilecert_certificate(
  p_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_issuer text;
begin
  if length(v_code) < 6 then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'Enter a valid certificate number, credential code or verification code.'
    );
  end if;

  select certificate.* into v_certificate
  from public.agilecert_issued_certificates certificate
  left join public.agilecert_paid_credentials credential
    on credential.certificate_id = certificate.id
  where lower(certificate.certificate_number) = lower(v_code)
     or lower(certificate.verification_code) = lower(v_code)
     or lower(coalesce(credential.credential_code, '')) = lower(v_code)
     or lower(coalesce(credential.badge_code, '')) = lower(v_code)
     or lower(coalesce(credential.transcript_code, '')) = lower(v_code)
  limit 1;

  if not found then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'No AgileCert certificate or paid credential matches the supplied code.'
    );
  end if;

  select * into v_credential
  from public.agilecert_paid_credentials
  where certificate_id = v_certificate.id;

  select cp.issuer_name into v_issuer
  from public.agilecert_certificate_policies cp
  where cp.examination_id = v_certificate.examination_id;

  return jsonb_build_object(
    'found', true,
    'valid', v_certificate.status = 'active',
    'status', v_certificate.status,
    'certificateNumber', v_certificate.certificate_number,
    'verificationCode', v_certificate.verification_code,
    'credentialCode', v_credential.credential_code,
    'badgeCode', v_credential.badge_code,
    'transcriptCode', v_credential.transcript_code,
    'productCode', v_credential.product_code,
    'paymentAuthorised', v_credential.id is not null,
    'holderName', v_certificate.holder_name,
    'certificateTitle', v_certificate.certificate_title,
    'examinationTitle', v_certificate.examination_title,
    'programmeCode', v_certificate.programme_code,
    'score', v_certificate.score,
    'passMark', v_certificate.pass_mark,
    'issueDate', v_certificate.issue_date,
    'issuedAt', v_certificate.issued_at,
    'issuer', coalesce(v_issuer, 'Integrated Institute of Professional Management (IIPM)'),
    'poweredBy', 'AgileCert Global',
    'message', case
      when v_certificate.status = 'active' and v_credential.id is not null
        then 'This paid credential is active and publicly verifiable.'
      when v_certificate.status = 'active'
        then 'This certificate is active and verifiable.'
      when v_certificate.status = 'suspended'
        then 'This certificate is currently suspended.'
      else 'This certificate has been revoked.'
    end
  );
end;
$$;

create or replace function public.agilecert_sync_paid_credential_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_paid_credentials
  set status = new.status,
      updated_at = now()
  where certificate_id = new.id
    and status is distinct from new.status;

  return new;
end;
$$;

drop trigger if exists agilecert_paid_credential_status_trigger
  on public.agilecert_issued_certificates;
create trigger agilecert_paid_credential_status_trigger
  after update of status
  on public.agilecert_issued_certificates
  for each row
  execute function public.agilecert_sync_paid_credential_status();

alter table public.agilecert_certificate_products enable row level security;
alter table public.agilecert_certificate_product_prices enable row level security;
alter table public.agilecert_certificate_orders enable row level security;
alter table public.agilecert_certificate_payments enable row level security;
alter table public.agilecert_paid_credentials enable row level security;
alter table public.agilecert_certificate_commerce_audits enable row level security;

drop policy if exists agilecert_certificate_orders_candidate_select
  on public.agilecert_certificate_orders;
create policy agilecert_certificate_orders_candidate_select
  on public.agilecert_certificate_orders
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_certificate_admin()
  );

drop policy if exists agilecert_certificate_payments_candidate_select
  on public.agilecert_certificate_payments;
create policy agilecert_certificate_payments_candidate_select
  on public.agilecert_certificate_payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agilecert_certificate_orders orders
      where orders.id = agilecert_certificate_payments.order_id
        and (
          orders.candidate_id = auth.uid()
          or public.agilecert_is_certificate_admin()
        )
    )
  );

drop policy if exists agilecert_paid_credentials_candidate_select
  on public.agilecert_paid_credentials;
create policy agilecert_paid_credentials_candidate_select
  on public.agilecert_paid_credentials
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_certificate_admin()
  );

drop policy if exists agilecert_certificate_products_authenticated_select
  on public.agilecert_certificate_products;
create policy agilecert_certificate_products_authenticated_select
  on public.agilecert_certificate_products
  for select
  to authenticated
  using (active or public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_prices_authenticated_select
  on public.agilecert_certificate_product_prices;
create policy agilecert_certificate_prices_authenticated_select
  on public.agilecert_certificate_product_prices
  for select
  to authenticated
  using (active or public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_commerce_audits_admin_select
  on public.agilecert_certificate_commerce_audits;
create policy agilecert_certificate_commerce_audits_admin_select
  on public.agilecert_certificate_commerce_audits
  for select
  to authenticated
  using (public.agilecert_is_certificate_admin());

revoke all on public.agilecert_certificate_products from public, anon, authenticated;
revoke all on public.agilecert_certificate_product_prices from public, anon, authenticated;
revoke all on public.agilecert_certificate_orders from public, anon, authenticated;
revoke all on public.agilecert_certificate_payments from public, anon, authenticated;
revoke all on public.agilecert_paid_credentials from public, anon, authenticated;
revoke all on public.agilecert_certificate_commerce_audits from public, anon, authenticated;

grant select on public.agilecert_certificate_products to authenticated;
grant select on public.agilecert_certificate_product_prices to authenticated;
grant select on public.agilecert_certificate_orders to authenticated;
grant select on public.agilecert_certificate_payments to authenticated;
grant select on public.agilecert_paid_credentials to authenticated;
grant select on public.agilecert_certificate_commerce_audits to authenticated;

revoke all on function public.agilecert_certificate_market_currency(uuid)
  from public, anon, authenticated;
revoke all on function public.get_my_agilecert_certificate_commerce()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_commerce()
  to authenticated;

revoke all on function public.create_agilecert_certificate_order(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_agilecert_certificate_order(uuid, text, text)
  to authenticated;

revoke all on function public.agilecert_issue_certificate_for_order(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.agilecert_issue_certificate_for_order(uuid, uuid, text)
  to service_role;

revoke all on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb)
  to service_role;

revoke all on function public.waive_agilecert_certificate_order(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.waive_agilecert_certificate_order(uuid, text, text, text)
  to authenticated;

revoke all on function public.upsert_agilecert_certificate_product_price(text, text, bigint, bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.upsert_agilecert_certificate_product_price(text, text, bigint, bigint, boolean)
  to authenticated;

revoke all on function public.get_agilecert_certificate_commerce_admin_console(integer)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_certificate_commerce_admin_console(integer)
  to authenticated;

revoke all on function public.agilecert_sync_paid_credential_status()
  from public, anon, authenticated;

comment on table public.agilecert_certificate_orders is
  'Phase 4 certificate orders with server-priced early and standard windows.';
comment on table public.agilecert_certificate_payments is
  'Verified certificate-payment events. Browser clients cannot write payment state.';
comment on table public.agilecert_paid_credentials is
  'Paid or waived credential records linked to the Phase 3 certificate authority.';
comment on function public.fulfil_paid_agilecert_certificate_order(uuid, text, jsonb) is
  'Service-role-only idempotent certificate-payment fulfilment and credential issuance.';
comment on function public.verify_agilecert_certificate(text) is
  'Public verification for certificate, credential, badge or transcript codes without payment or private candidate details.';

notify pgrst, 'reload schema';

commit;
