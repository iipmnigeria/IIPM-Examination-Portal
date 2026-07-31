begin;

-- ---------------------------------------------------------------------------
-- Finance Console Phase 1B: certification pricing rules and applicability
-- ---------------------------------------------------------------------------

alter table public.agilecert_certificate_product_prices
  add column if not exists pricing_mode text not null default 'separate_payment',
  add column if not exists country_codes text[] not null default '{}'::text[],
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists effective_to timestamptz;

alter table public.agilecert_certificate_product_prices
  drop constraint if exists agilecert_certificate_product_prices_early_amount_minor_check;
alter table public.agilecert_certificate_product_prices
  drop constraint if exists agilecert_certificate_product_prices_standard_amount_minor_check;
alter table public.agilecert_certificate_product_prices
  drop constraint if exists agilecert_certificate_product_prices_pricing_mode_check;
alter table public.agilecert_certificate_product_prices
  drop constraint if exists agilecert_certificate_product_prices_amounts_check;
alter table public.agilecert_certificate_product_prices
  drop constraint if exists agilecert_certificate_product_prices_effective_dates_check;

alter table public.agilecert_certificate_product_prices
  add constraint agilecert_certificate_product_prices_pricing_mode_check
    check (pricing_mode in ('separate_payment', 'included', 'free')),
  add constraint agilecert_certificate_product_prices_amounts_check
    check (
      (pricing_mode = 'separate_payment'
        and early_amount_minor > 0
        and standard_amount_minor >= early_amount_minor)
      or
      (pricing_mode in ('included', 'free')
        and early_amount_minor >= 0
        and standard_amount_minor >= early_amount_minor)
    ),
  add constraint agilecert_certificate_product_prices_effective_dates_check
    check (effective_to is null or effective_to > effective_from);

update public.agilecert_certificate_product_prices
set country_codes = case
      when currency = 'NGN' and cardinality(country_codes) = 0 then array['NG']::text[]
      else country_codes
    end,
    effective_from = coalesce(effective_from, created_at, now());

create table if not exists public.agilecert_certificate_product_scopes (
  id uuid primary key default gen_random_uuid(),
  product_code text not null
    references public.agilecert_certificate_products(code) on delete cascade,
  scope_type text not null
    check (scope_type in ('all', 'programme', 'examination')),
  programme_id uuid references public.programmes(id) on delete cascade,
  examination_id uuid references public.examinations(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'all' and programme_id is null and examination_id is null)
    or (scope_type = 'programme' and programme_id is not null and examination_id is null)
    or (scope_type = 'examination' and examination_id is not null and programme_id is null)
  )
);

create unique index if not exists agilecert_certificate_product_scope_unique_idx
  on public.agilecert_certificate_product_scopes (
    product_code,
    scope_type,
    coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(examination_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists agilecert_certificate_product_scope_active_idx
  on public.agilecert_certificate_product_scopes(product_code, is_active, scope_type);

insert into public.agilecert_certificate_product_scopes (
  product_code, scope_type, is_active
)
select product.code, 'all', true
from public.agilecert_certificate_products product
on conflict do nothing;

drop trigger if exists agilecert_certificate_product_scopes_set_updated_at
  on public.agilecert_certificate_product_scopes;
create trigger agilecert_certificate_product_scopes_set_updated_at
  before update on public.agilecert_certificate_product_scopes
  for each row execute function public.set_updated_at();

alter table public.agilecert_certificate_product_scopes enable row level security;
revoke all on public.agilecert_certificate_product_scopes from public, anon, authenticated;

create or replace function public.agilecert_certificate_product_applies(
  p_product_code text,
  p_examination_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agilecert_certificate_product_scopes scope
    join public.examinations exam on exam.id = p_examination_id
    where scope.product_code = lower(trim(p_product_code))
      and scope.is_active = true
      and (
        scope.scope_type = 'all'
        or (scope.scope_type = 'programme' and scope.programme_id = exam.programme_id)
        or (scope.scope_type = 'examination' and scope.examination_id = exam.id)
      )
  );
$$;

create or replace function public.agilecert_resolve_certificate_pricing(
  p_candidate_id uuid,
  p_eligibility_id uuid,
  p_product_code text,
  p_requested_currency text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_requested_currency text := nullif(upper(trim(coalesce(p_requested_currency, ''))), '');
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_price public.agilecert_certificate_product_prices%rowtype;
  v_currency text;
  v_country_code text;
  v_passed_at timestamptz;
  v_early_expires_at timestamptz;
  v_pricing_window text;
  v_list_amount bigint;
  v_discount bigint;
  v_payable bigint;
begin
  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
    and candidate_id = p_candidate_id;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_product_code and active = true;

  if not found then
    raise exception 'The selected certificate product is unavailable.';
  end if;

  if not public.agilecert_certificate_product_applies(
    v_product_code,
    v_eligibility.examination_id
  ) then
    raise exception 'The selected certification product is not available for this programme or examination.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = p_candidate_id;

  if not found then
    raise exception 'Complete the candidate profile before requesting certification.';
  end if;

  v_country_code := upper(coalesce(v_profile.country_code, ''));
  v_currency := coalesce(
    v_profile.preferred_currency,
    case when v_country_code = 'NG' then 'NGN' else 'USD' end
  );

  if v_requested_currency is not null and v_requested_currency <> v_currency then
    raise exception 'The requested currency does not match the candidate pricing market.';
  end if;

  select * into v_price
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency
    and price.active = true
    and price.effective_from <= now()
    and (price.effective_to is null or price.effective_to > now())
    and (
      cardinality(price.country_codes) = 0
      or v_country_code = any(price.country_codes)
    );

  if not found then
    raise exception 'Certification pricing is unavailable for the selected market or effective period.';
  end if;

  select coalesce(attempt.submitted_at, attempt.graded_at, v_eligibility.evaluated_at)
  into v_passed_at
  from public.attempts attempt
  where attempt.id = v_eligibility.attempt_id;

  v_passed_at := coalesce(v_passed_at, v_eligibility.evaluated_at, now());
  v_early_expires_at := v_passed_at + interval '7 days';

  if v_price.pricing_mode = 'separate_payment' then
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
  else
    v_pricing_window := 'waived';
    v_list_amount := v_price.standard_amount_minor;
    v_discount := v_list_amount;
    v_payable := 0;
  end if;

  return jsonb_build_object(
    'productCode', v_product.code,
    'productTitle', v_product.title,
    'currency', v_currency,
    'countryCode', nullif(v_country_code, ''),
    'pricingMode', v_price.pricing_mode,
    'pricingWindow', v_pricing_window,
    'earlyAmountMinor', v_price.early_amount_minor,
    'standardAmountMinor', v_price.standard_amount_minor,
    'listAmountMinor', v_list_amount,
    'discountAmountMinor', v_discount,
    'payableAmountMinor', v_payable,
    'paymentRequired', v_price.pricing_mode = 'separate_payment',
    'passedAt', v_passed_at,
    'earlyPriceExpiresAt', v_early_expires_at,
    'effectiveFrom', v_price.effective_from,
    'effectiveTo', v_price.effective_to,
    'countryCodes', v_price.country_codes
  );
end;
$$;

create or replace function public.finance_upsert_certificate_product_price_rule(
  p_product_code text,
  p_currency text,
  p_early_amount_minor bigint,
  p_standard_amount_minor bigint,
  p_pricing_mode text,
  p_country_codes text[] default '{}'::text[],
  p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null,
  p_is_active boolean default true,
  p_change_reason text default 'Finance Console certification pricing-rule update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_mode text := lower(trim(coalesce(p_pricing_mode, 'separate_payment')));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_country_codes text[];
  v_before jsonb;
  v_after jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification fees.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;
  if v_currency not in ('NGN', 'USD') then
    raise exception 'Currency must be NGN or USD.';
  end if;
  if v_mode not in ('separate_payment', 'included', 'free') then
    raise exception 'Select separate payment, included or free certification pricing.';
  end if;
  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the certification pricing change.';
  end if;
  if p_effective_to is not null and p_effective_to <= coalesce(p_effective_from, now()) then
    raise exception 'The certification fee end date must be after its start date.';
  end if;
  if v_mode = 'separate_payment' and (
    coalesce(p_early_amount_minor, 0) <= 0
    or p_standard_amount_minor < p_early_amount_minor
  ) then
    raise exception 'Separate-payment certification requires a positive early fee and a standard fee that is not lower.';
  end if;
  if v_mode in ('included', 'free') and (
    coalesce(p_early_amount_minor, 0) < 0
    or p_standard_amount_minor < p_early_amount_minor
  ) then
    raise exception 'Included or free certification amounts cannot be negative.';
  end if;

  select coalesce(
    array_agg(distinct upper(trim(code))) filter (
      where upper(trim(code)) ~ '^[A-Z]{2}$'
    ),
    '{}'::text[]
  )
  into v_country_codes
  from unnest(coalesce(p_country_codes, '{}'::text[])) code;

  select to_jsonb(price) into v_before
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  insert into public.agilecert_certificate_product_prices (
    product_code, currency, early_amount_minor, standard_amount_minor,
    pricing_mode, country_codes, effective_from, effective_to,
    active, updated_by
  ) values (
    v_product_code, v_currency, p_early_amount_minor, p_standard_amount_minor,
    v_mode, v_country_codes, coalesce(p_effective_from, now()), p_effective_to,
    coalesce(p_is_active, true), v_actor
  )
  on conflict (product_code, currency) do update set
    early_amount_minor = excluded.early_amount_minor,
    standard_amount_minor = excluded.standard_amount_minor,
    pricing_mode = excluded.pricing_mode,
    country_codes = excluded.country_codes,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    active = excluded.active,
    updated_by = v_actor,
    updated_at = now();

  select to_jsonb(price) into v_after
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id, action, metadata
  ) values (
    v_actor,
    'price_updated',
    jsonb_build_object(
      'productCode', v_product_code,
      'currency', v_currency,
      'pricingMode', v_mode,
      'countryCodes', v_country_codes,
      'effectiveFrom', coalesce(p_effective_from, now()),
      'effectiveTo', p_effective_to,
      'active', coalesce(p_is_active, true),
      'authority', 'finance_console_phase1b'
    )
  );

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_price',
    v_product_code || ':' || v_currency,
    'certification_pricing_rule_saved',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before, 'null'::jsonb),
      'after', coalesce(v_after, 'null'::jsonb)
    )
  );

  return jsonb_build_object(
    'productCode', v_product_code,
    'currency', v_currency,
    'earlyAmountMinor', p_early_amount_minor,
    'standardAmountMinor', p_standard_amount_minor,
    'pricingMode', v_mode,
    'countryCodes', v_country_codes,
    'effectiveFrom', coalesce(p_effective_from, now()),
    'effectiveTo', p_effective_to,
    'active', coalesce(p_is_active, true),
    'changeReason', v_reason
  );
end;
$$;

create or replace function public.finance_upsert_certificate_product_scope(
  p_scope_id uuid default null,
  p_product_code text default null,
  p_scope_type text default 'all',
  p_programme_id uuid default null,
  p_examination_id uuid default null,
  p_is_active boolean default true,
  p_change_reason text default 'Finance Console certification applicability update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_scope_type text := lower(trim(coalesce(p_scope_type, 'all')));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_programme_id uuid := case when v_scope_type = 'programme' then p_programme_id else null end;
  v_examination_id uuid := case when v_scope_type = 'examination' then p_examination_id else null end;
  v_scope public.agilecert_certificate_product_scopes%rowtype;
  v_before jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification applicability.';
  end if;
  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;
  if v_scope_type not in ('all', 'programme', 'examination') then
    raise exception 'Select all, programme or examination applicability.';
  end if;
  if v_scope_type = 'all' and (p_programme_id is not null or p_examination_id is not null) then
    raise exception 'All-programme applicability cannot have a programme or examination target.';
  end if;
  if v_scope_type = 'programme' and (p_programme_id is null or p_examination_id is not null) then
    raise exception 'Programme applicability requires one programme target.';
  end if;
  if v_scope_type = 'examination' and (p_examination_id is null or p_programme_id is not null) then
    raise exception 'Examination applicability requires one examination target.';
  end if;
  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the applicability change.';
  end if;

  if p_scope_id is not null then
    select to_jsonb(scope) into v_before
    from public.agilecert_certificate_product_scopes scope
    where scope.id = p_scope_id;

    update public.agilecert_certificate_product_scopes
    set product_code = v_product_code,
        scope_type = v_scope_type,
        programme_id = v_programme_id,
        examination_id = v_examination_id,
        is_active = coalesce(p_is_active, true),
        updated_by = v_actor,
        updated_at = now()
    where id = p_scope_id
    returning * into v_scope;

    if not found then
      raise exception 'The selected certification applicability rule was not found.';
    end if;
  else
    select * into v_scope
    from public.agilecert_certificate_product_scopes scope
    where scope.product_code = v_product_code
      and scope.scope_type = v_scope_type
      and scope.programme_id is not distinct from v_programme_id
      and scope.examination_id is not distinct from v_examination_id
    limit 1
    for update;

    if found then
      v_before := to_jsonb(v_scope);
      update public.agilecert_certificate_product_scopes
      set is_active = coalesce(p_is_active, true),
          updated_by = v_actor,
          updated_at = now()
      where id = v_scope.id
      returning * into v_scope;
    else
      insert into public.agilecert_certificate_product_scopes (
        product_code, scope_type, programme_id, examination_id,
        is_active, created_by, updated_by
      ) values (
        v_product_code, v_scope_type, v_programme_id, v_examination_id,
        coalesce(p_is_active, true), v_actor, v_actor
      )
      returning * into v_scope;
    end if;
  end if;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_scope',
    v_scope.id::text,
    'certification_scope_saved',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before, 'null'::jsonb),
      'after', to_jsonb(v_scope)
    )
  );

  return jsonb_build_object(
    'id', v_scope.id,
    'productCode', v_scope.product_code,
    'scopeType', v_scope.scope_type,
    'programmeId', v_scope.programme_id,
    'examinationId', v_scope.examination_id,
    'isActive', v_scope.is_active,
    'changeReason', v_reason
  );
end;
$$;

create or replace function public.finance_set_certificate_product_scope_active(
  p_scope_id uuid,
  p_is_active boolean,
  p_change_reason text default 'Finance Console certification applicability status update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_scope public.agilecert_certificate_product_scopes%rowtype;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification applicability.';
  end if;
  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the applicability status change.';
  end if;

  select to_jsonb(scope) into v_before
  from public.agilecert_certificate_product_scopes scope
  where scope.id = p_scope_id;

  if v_before is null then
    raise exception 'The selected certification applicability rule was not found.';
  end if;

  update public.agilecert_certificate_product_scopes
  set is_active = coalesce(p_is_active, false),
      updated_by = v_actor,
      updated_at = now()
  where id = p_scope_id
  returning * into v_scope;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_scope',
    v_scope.id::text,
    'certification_scope_status_changed',
    jsonb_build_object(
      'reason', v_reason,
      'before', v_before,
      'after', to_jsonb(v_scope)
    )
  );

  return jsonb_build_object(
    'id', v_scope.id,
    'productCode', v_scope.product_code,
    'isActive', v_scope.is_active,
    'changeReason', v_reason
  );
end;
$$;

-- Preserve the established Paystack order implementation as an internal
-- compatibility bridge. The public function name is reintroduced below as a
-- Phase 1B gate that validates market, effective dates and applicability first.
alter function public.get_my_agilecert_certificate_commerce()
  rename to get_my_agilecert_certificate_commerce_phase1b_legacy;
alter function public.create_agilecert_certificate_order(uuid, text, text)
  rename to create_agilecert_certificate_order_phase1b_legacy;
alter function public.create_agilecert_professional_certificate_order(uuid, text)
  rename to create_agilecert_professional_certificate_order_phase1b_legacy;

create or replace function public.agilecert_create_no_charge_certificate_order(
  p_eligibility_id uuid,
  p_product_code text,
  p_currency text,
  p_require_identity boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_identity public.agilecert_identity_verifications%rowtype;
  v_existing_order public.agilecert_certificate_orders%rowtype;
  v_existing_certificate public.agilecert_issued_certificates%rowtype;
  v_order public.agilecert_certificate_orders%rowtype;
  v_pricing jsonb;
  v_reference text;
  v_result jsonb;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;
  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
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

  if v_eligibility.eligibility_status not in ('eligible', 'requested')
     or v_eligibility.integrity_status <> 'cleared' then
    raise exception 'This examination result is not eligible for certification.';
  end if;

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

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_product_code and active = true;

  if not found then
    raise exception 'The selected certificate product is unavailable.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_candidate_id;

  if not found or nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
    raise exception 'Complete your legal name and candidate profile before requesting certification.';
  end if;

  if coalesce(p_require_identity, false) then
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
      raise exception 'An approved IIPM identity-assurance record is required for Professional Certificate issuance.';
    end if;
  end if;

  v_pricing := public.agilecert_resolve_certificate_pricing(
    v_candidate_id,
    v_eligibility.id,
    v_product_code,
    p_currency
  );

  if (v_pricing ->> 'paymentRequired')::boolean then
    raise exception 'The selected certification product requires payment.';
  end if;

  select * into v_existing_order
  from public.agilecert_certificate_orders
  where eligibility_id = v_eligibility.id
    and product_code = v_product_code
    and status in ('pending', 'initialized', 'paid', 'waived')
  order by created_at desc
  limit 1
  for update;

  if found and v_existing_order.status in ('paid', 'waived') then
    return jsonb_build_object(
      'orderId', v_existing_order.id,
      'reference', v_existing_order.reference,
      'eligibilityId', v_existing_order.eligibility_id,
      'productCode', v_existing_order.product_code,
      'currency', v_existing_order.currency,
      'pricingWindow', v_existing_order.pricing_window,
      'pricingMode', v_existing_order.metadata ->> 'pricingMode',
      'listAmountMinor', v_existing_order.list_amount_minor,
      'discountAmountMinor', v_existing_order.discount_amount_minor,
      'payableAmountMinor', v_existing_order.payable_amount_minor,
      'status', v_existing_order.status,
      'paymentRequired', false,
      'alreadyPaid', true,
      'fulfilledAt', v_existing_order.fulfilled_at
    );
  elsif found then
    update public.agilecert_certificate_orders
    set status = 'expired',
        gateway_authorization_url = null,
        gateway_access_code = null,
        updated_at = now()
    where id = v_existing_order.id;
  end if;

  v_reference := case
    when v_product_code = 'professional'
      then 'AGC-PRO-NC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
    else 'AGC-NOCHARGE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  end;

  insert into public.agilecert_certificate_orders (
    reference, candidate_id, eligibility_id, product_code, currency,
    pricing_window, list_amount_minor, discount_amount_minor,
    payable_amount_minor, status, payment_provider, expires_at,
    waived_at, waiver_reason, metadata
  ) values (
    v_reference,
    v_candidate_id,
    v_eligibility.id,
    v_product_code,
    v_pricing ->> 'currency',
    'waived',
    (v_pricing ->> 'listAmountMinor')::bigint,
    (v_pricing ->> 'discountAmountMinor')::bigint,
    0,
    'waived',
    case
      when v_pricing ->> 'pricingMode' = 'included' then 'included_with_examination'
      else 'no_charge'
    end,
    null,
    now(),
    case
      when v_pricing ->> 'pricingMode' = 'included'
        then 'Certification included in the applicable examination arrangement.'
      else 'Certification configured as free by authorised finance administration.'
    end,
    jsonb_build_object(
      'passedAt', v_pricing ->> 'passedAt',
      'earlyPriceExpiresAt', v_pricing ->> 'earlyPriceExpiresAt',
      'createdFrom', 'candidate_checkout',
      'pricingMode', v_pricing ->> 'pricingMode',
      'countryCode', v_pricing ->> 'countryCode',
      'effectiveFrom', v_pricing ->> 'effectiveFrom',
      'effectiveTo', v_pricing ->> 'effectiveTo',
      'identityVerificationId', case when p_require_identity then v_identity.id else null end,
      'identityVerifiedAt', case when p_require_identity then v_identity.reviewed_at else null end
    )
  ) returning * into v_order;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id, candidate_id, order_id, action, metadata
  ) values (
    v_candidate_id,
    v_candidate_id,
    v_order.id,
    case
      when v_product_code = 'professional' then 'professional_no_charge_order_created'
      else 'no_charge_order_created'
    end,
    jsonb_build_object(
      'productCode', v_product_code,
      'currency', v_order.currency,
      'pricingMode', v_pricing ->> 'pricingMode',
      'payableAmountMinor', 0
    )
  );

  if p_require_identity then
    v_result := public.agilecert_issue_identity_verified_certificate_for_order(
      v_order.id,
      null,
      case
        when v_pricing ->> 'pricingMode' = 'included' then 'included_with_examination'
        else 'configured_no_charge'
      end
    );
  else
    v_result := public.agilecert_issue_certificate_for_order(
      v_order.id,
      null,
      case
        when v_pricing ->> 'pricingMode' = 'included' then 'included_with_examination'
        else 'configured_no_charge'
      end
    );
  end if;

  return v_result || jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'eligibilityId', v_order.eligibility_id,
    'productCode', v_order.product_code,
    'productTitle', v_product.title,
    'currency', v_order.currency,
    'pricingWindow', 'waived',
    'pricingMode', v_pricing ->> 'pricingMode',
    'listAmountMinor', v_order.list_amount_minor,
    'discountAmountMinor', v_order.discount_amount_minor,
    'payableAmountMinor', 0,
    'status', 'waived',
    'paymentRequired', false,
    'autoIssued', true
  );
end;
$$;

create or replace function public.get_my_agilecert_certificate_commerce()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_payload jsonb;
  v_offer jsonb;
  v_pricing jsonb;
  v_offers jsonb := '[]'::jsonb;
  v_counts jsonb;
begin
  v_payload := public.get_my_agilecert_certificate_commerce_phase1b_legacy();

  for v_offer in
    select value from jsonb_array_elements(coalesce(v_payload -> 'offers', '[]'::jsonb))
  loop
    begin
      v_pricing := public.agilecert_resolve_certificate_pricing(
        v_candidate_id,
        (v_offer ->> 'eligibilityId')::uuid,
        v_offer ->> 'productCode',
        v_offer ->> 'currency'
      );

      v_offer := v_offer || jsonb_build_object(
        'countryCodes', v_pricing -> 'countryCodes',
        'pricingMode', v_pricing ->> 'pricingMode',
        'earlyAmountMinor', (v_pricing ->> 'earlyAmountMinor')::bigint,
        'standardAmountMinor', (v_pricing ->> 'standardAmountMinor')::bigint,
        'payableAmountMinor', (v_pricing ->> 'payableAmountMinor')::bigint,
        'paymentRequired', (v_pricing ->> 'paymentRequired')::boolean,
        'pricingWindow', v_pricing ->> 'pricingWindow',
        'effectiveFrom', v_pricing ->> 'effectiveFrom',
        'effectiveTo', v_pricing ->> 'effectiveTo'
      );
      v_offers := v_offers || jsonb_build_array(v_offer);
    exception
      when others then
        null;
    end;
  end loop;

  v_counts := coalesce(v_payload -> 'counts', '{}'::jsonb)
    || jsonb_build_object('offers', jsonb_array_length(v_offers));

  return jsonb_set(
    jsonb_set(v_payload, '{offers}', v_offers, true),
    '{counts}',
    v_counts,
    true
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
  v_pricing jsonb;
begin
  v_pricing := public.agilecert_resolve_certificate_pricing(
    auth.uid(),
    p_eligibility_id,
    p_product_code,
    p_currency
  );

  if (v_pricing ->> 'paymentRequired')::boolean then
    return public.create_agilecert_certificate_order_phase1b_legacy(
      p_eligibility_id,
      p_product_code,
      p_currency
    );
  end if;

  return public.agilecert_create_no_charge_certificate_order(
    p_eligibility_id,
    p_product_code,
    p_currency,
    false
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
  v_pricing jsonb;
begin
  v_pricing := public.agilecert_resolve_certificate_pricing(
    auth.uid(),
    p_eligibility_id,
    'professional',
    p_currency
  );

  if (v_pricing ->> 'paymentRequired')::boolean then
    return public.create_agilecert_professional_certificate_order_phase1b_legacy(
      p_eligibility_id,
      p_currency
    );
  end if;

  return public.agilecert_create_no_charge_certificate_order(
    p_eligibility_id,
    'professional',
    p_currency,
    true
  );
end;
$$;

create or replace function public.get_finance_certification_snapshot(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_products jsonb;
  v_prices jsonb;
  v_scopes jsonb;
  v_orders jsonb;
  v_payments jsonb;
  v_audit jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.console.view') then
    raise exception 'This account does not have permission to view the Finance Console.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', product.code,
    'title', product.title,
    'description', product.description,
    'requiresIdentityVerification', product.requires_identity_verification,
    'includesBadge', product.includes_badge,
    'includesTranscript', product.includes_transcript,
    'active', product.active,
    'createdAt', product.created_at,
    'updatedAt', product.updated_at
  ) order by case product.code when 'achievement' then 1 else 2 end), '[]'::jsonb)
  into v_products
  from public.agilecert_certificate_products product;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productCode', price.product_code,
    'productTitle', product.title,
    'currency', price.currency,
    'earlyAmountMinor', price.early_amount_minor,
    'standardAmountMinor', price.standard_amount_minor,
    'pricingMode', price.pricing_mode,
    'countryCodes', price.country_codes,
    'effectiveFrom', price.effective_from,
    'effectiveTo', price.effective_to,
    'active', price.active,
    'requiresIdentityVerification', product.requires_identity_verification,
    'updatedAt', price.updated_at
  ) order by case price.product_code when 'achievement' then 1 else 2 end, price.currency), '[]'::jsonb)
  into v_prices
  from public.agilecert_certificate_product_prices price
  join public.agilecert_certificate_products product
    on product.code = price.product_code;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', scope.id,
    'productCode', scope.product_code,
    'scopeType', scope.scope_type,
    'programmeId', scope.programme_id,
    'programmeCode', programme.code,
    'programmeName', programme.name,
    'examinationId', scope.examination_id,
    'examinationTitle', examination.title,
    'isActive', scope.is_active,
    'createdAt', scope.created_at,
    'updatedAt', scope.updated_at
  ) order by scope.product_code, scope.scope_type, scope.created_at), '[]'::jsonb)
  into v_scopes
  from public.agilecert_certificate_product_scopes scope
  left join public.programmes programme on programme.id = scope.programme_id
  left join public.examinations examination on examination.id = scope.examination_id;

  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
  into v_orders
  from (
    select orders.created_at,
      jsonb_build_object(
        'orderId', orders.id,
        'reference', orders.reference,
        'candidateId', orders.candidate_id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'eligibilityId', orders.eligibility_id,
        'examinationTitle', examination.title,
        'programmeCode', programme.code,
        'productCode', orders.product_code,
        'productTitle', product.title,
        'currency', orders.currency,
        'pricingWindow', orders.pricing_window,
        'pricingMode', orders.metadata ->> 'pricingMode',
        'listAmountMinor', orders.list_amount_minor,
        'discountAmountMinor', orders.discount_amount_minor,
        'payableAmountMinor', orders.payable_amount_minor,
        'status', orders.status,
        'paymentProvider', orders.payment_provider,
        'paidAt', orders.paid_at,
        'fulfilledAt', orders.fulfilled_at,
        'waivedAt', orders.waived_at,
        'waiverReason', orders.waiver_reason,
        'expiresAt', orders.expires_at,
        'createdAt', orders.created_at
      ) payload
    from public.agilecert_certificate_orders orders
    join public.profiles candidate on candidate.id = orders.candidate_id
    join public.agilecert_certificate_eligibility_records eligibility
      on eligibility.id = orders.eligibility_id
    join public.examinations examination on examination.id = eligibility.examination_id
    join public.programmes programme on programme.id = examination.programme_id
    join public.agilecert_certificate_products product on product.code = orders.product_code
    order by orders.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
  into v_payments
  from (
    select payment.created_at,
      jsonb_build_object(
        'id', payment.id,
        'orderId', payment.order_id,
        'reference', payment.reference,
        'provider', payment.provider,
        'providerTransactionId', payment.provider_transaction_id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'productCode', orders.product_code,
        'productTitle', product.title,
        'examinationTitle', examination.title,
        'programmeCode', programme.code,
        'status', payment.status,
        'amountMinor', payment.amount_minor,
        'currency', payment.currency,
        'verifiedAt', payment.verified_at,
        'createdAt', payment.created_at,
        'updatedAt', payment.updated_at
      ) payload
    from public.agilecert_certificate_payments payment
    join public.agilecert_certificate_orders orders on orders.id = payment.order_id
    join public.profiles candidate on candidate.id = orders.candidate_id
    join public.agilecert_certificate_eligibility_records eligibility
      on eligibility.id = orders.eligibility_id
    join public.examinations examination on examination.id = eligibility.examination_id
    join public.programmes programme on programme.id = examination.programme_id
    join public.agilecert_certificate_products product on product.code = orders.product_code
    order by payment.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', audit.id,
    'actorId', audit.actor_id,
    'actorName', profile.full_name,
    'entityType', audit.entity_type,
    'entityId', audit.entity_id,
    'action', audit.action,
    'metadata', audit.metadata,
    'createdAt', audit.created_at
  ) order by audit.created_at desc), '[]'::jsonb)
  into v_audit
  from (
    select *
    from public.agilecert_finance_audit_events
    where entity_type in ('certificate_price', 'certificate_product', 'certificate_scope')
    order by created_at desc
    limit v_limit
  ) audit
  left join public.profiles profile on profile.id = audit.actor_id;

  return jsonb_build_object(
    'products', v_products,
    'prices', v_prices,
    'scopes', v_scopes,
    'orders', v_orders,
    'payments', v_payments,
    'audit', v_audit,
    'summary', jsonb_build_object(
      'activeProducts', (
        select count(*) from public.agilecert_certificate_products where active
      ),
      'activePrices', (
        select count(*) from public.agilecert_certificate_product_prices
        where active and effective_from <= now()
          and (effective_to is null or effective_to > now())
      ),
      'activeScopes', (
        select count(*) from public.agilecert_certificate_product_scopes where is_active
      ),
      'pendingOrders', (
        select count(*) from public.agilecert_certificate_orders
        where status in ('pending', 'initialized')
      ),
      'paidOrders', (
        select count(*) from public.agilecert_certificate_orders where status = 'paid'
      ),
      'waivedOrders', (
        select count(*) from public.agilecert_certificate_orders where status = 'waived'
      ),
      'credentials', (
        select count(*) from public.agilecert_paid_credentials
      )
    )
  );
end;
$$;

revoke all on function public.agilecert_certificate_product_applies(text, uuid)
  from public, anon, authenticated;
revoke all on function public.agilecert_resolve_certificate_pricing(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.agilecert_create_no_charge_certificate_order(uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.get_my_agilecert_certificate_commerce_phase1b_legacy()
  from public, anon, authenticated;
revoke all on function public.create_agilecert_certificate_order_phase1b_legacy(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.create_agilecert_professional_certificate_order_phase1b_legacy(uuid, text)
  from public, anon, authenticated;

revoke all on function public.finance_upsert_certificate_product_price_rule(
  text, text, bigint, bigint, text, text[], timestamptz, timestamptz, boolean, text
) from public, anon, authenticated;
grant execute on function public.finance_upsert_certificate_product_price_rule(
  text, text, bigint, bigint, text, text[], timestamptz, timestamptz, boolean, text
) to authenticated;

revoke all on function public.finance_upsert_certificate_product_scope(
  uuid, text, text, uuid, uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.finance_upsert_certificate_product_scope(
  uuid, text, text, uuid, uuid, boolean, text
) to authenticated;

revoke all on function public.finance_set_certificate_product_scope_active(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.finance_set_certificate_product_scope_active(uuid, boolean, text)
  to authenticated;

revoke all on function public.get_my_agilecert_certificate_commerce()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_commerce()
  to authenticated;

revoke all on function public.create_agilecert_certificate_order(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_agilecert_certificate_order(uuid, text, text)
  to authenticated;

revoke all on function public.create_agilecert_professional_certificate_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_agilecert_professional_certificate_order(uuid, text)
  to authenticated;

comment on table public.agilecert_certificate_product_scopes is
  'Finance Console applicability rules connecting certification products to all programmes, selected programmes or selected examinations.';
comment on function public.agilecert_resolve_certificate_pricing(uuid, uuid, text, text) is
  'Server-authoritative certification price, market, effective-date and payment-mode resolver.';
comment on function public.finance_upsert_certificate_product_price_rule(
  text, text, bigint, bigint, text, text[], timestamptz, timestamptz, boolean, text
) is
  'Finance Console management of separate-payment, included and free certification pricing with market and effective-date controls.';

notify pgrst, 'reload schema';

commit;
