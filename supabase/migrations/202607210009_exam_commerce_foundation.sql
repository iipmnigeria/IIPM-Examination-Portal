begin;

-- ---------------------------------------------------------------------------
-- Examination commerce foundation
-- ---------------------------------------------------------------------------

alter table public.examinations
  add column if not exists requires_payment boolean not null default true;

update public.examinations
set requires_payment = true,
    allow_self_enrollment = false,
    updated_at = now()
where status = 'published';

create table if not exists public.exam_prices (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  country_codes text[] not null default '{}'::text[],
  is_default boolean not null default false,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (examination_id, currency),
  check (effective_to is null or effective_to > effective_from)
);

create unique index if not exists one_default_exam_price_idx
  on public.exam_prices (examination_id)
  where is_default = true and is_active = true;

create index if not exists exam_prices_lookup_idx
  on public.exam_prices (examination_id, currency, is_active);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(14,2) not null check (discount_value > 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  scope text not null default 'all' check (scope in ('all', 'programme', 'examination')),
  programme_id uuid references public.programmes(id) on delete cascade,
  examination_id uuid references public.examinations(id) on delete cascade,
  minimum_amount_minor bigint not null default 0 check (minimum_amount_minor >= 0),
  maximum_discount_minor bigint check (maximum_discount_minor is null or maximum_discount_minor > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  maximum_redemptions integer check (maximum_redemptions is null or maximum_redemptions > 0),
  per_candidate_limit integer not null default 1 check (per_candidate_limit > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (
    (scope = 'all' and programme_id is null and examination_id is null)
    or (scope = 'programme' and programme_id is not null and examination_id is null)
    or (scope = 'examination' and examination_id is not null and programme_id is null)
  )
);

create unique index if not exists coupons_code_upper_uidx
  on public.coupons (upper(code));

create index if not exists coupons_active_window_idx
  on public.coupons (is_active, starts_at, expires_at);

create table if not exists public.exam_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'IIPM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20))
  ),
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  price_id uuid references public.exam_prices(id) on delete restrict,
  coupon_id uuid references public.coupons(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  list_amount_minor bigint not null check (list_amount_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  payable_amount_minor bigint not null check (payable_amount_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'waived', 'failed', 'cancelled', 'expired', 'refunded')),
  gateway text not null default 'paystack',
  gateway_authorization_url text,
  gateway_access_code text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount_minor <= list_amount_minor),
  check (payable_amount_minor = list_amount_minor - discount_amount_minor)
);

create index if not exists exam_orders_candidate_idx
  on public.exam_orders (candidate_id, created_at desc);
create index if not exists exam_orders_reference_idx
  on public.exam_orders (reference);
create index if not exists exam_orders_pending_idx
  on public.exam_orders (status, expires_at)
  where status = 'pending';

create table if not exists public.exam_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.exam_orders(id) on delete restrict,
  provider text not null default 'paystack',
  reference text not null,
  provider_transaction_id text,
  status text not null default 'initiated'
    check (status in ('initiated', 'success', 'failed', 'abandoned', 'refunded')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, reference)
);

create index if not exists exam_payments_order_idx
  on public.exam_payments (order_id, created_at desc);
create index if not exists exam_payments_transaction_idx
  on public.exam_payments (provider_transaction_id)
  where provider_transaction_id is not null;

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null unique references public.exam_orders(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  discount_amount_minor bigint not null check (discount_amount_minor >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'redeemed', 'released')),
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_usage_idx
  on public.coupon_redemptions (coupon_id, status);
create index if not exists coupon_redemptions_candidate_idx
  on public.coupon_redemptions (candidate_id, coupon_id, status);

-- Reuse the common updated_at trigger function already created by migration 001.
drop trigger if exists exam_prices_set_updated_at on public.exam_prices;
create trigger exam_prices_set_updated_at
  before update on public.exam_prices
  for each row execute function public.set_updated_at();

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

drop trigger if exists exam_orders_set_updated_at on public.exam_orders;
create trigger exam_orders_set_updated_at
  before update on public.exam_orders
  for each row execute function public.set_updated_at();

drop trigger if exists exam_payments_set_updated_at on public.exam_payments;
create trigger exam_payments_set_updated_at
  before update on public.exam_payments
  for each row execute function public.set_updated_at();

drop trigger if exists coupon_redemptions_set_updated_at on public.coupon_redemptions;
create trigger coupon_redemptions_set_updated_at
  before update on public.coupon_redemptions
  for each row execute function public.set_updated_at();

-- Default price: NGN 25,000 = 2,500,000 kobo.
insert into public.exam_prices (
  examination_id, currency, amount_minor, country_codes, is_default, is_active
)
select e.id, 'NGN', 2500000, array['NG'], true, true
from public.examinations e
where e.status = 'published'
on conflict (examination_id, currency) do update
set amount_minor = excluded.amount_minor,
    country_codes = excluded.country_codes,
    is_default = true,
    is_active = true,
    effective_from = least(public.exam_prices.effective_from, now()),
    effective_to = null,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Internal pricing and coupon resolution
-- ---------------------------------------------------------------------------

create or replace function public.resolve_exam_purchase_quote(
  p_examination_id uuid,
  p_candidate_id uuid,
  p_currency text default 'NGN',
  p_coupon_code text default null
)
returns table (
  examination_id uuid,
  price_id uuid,
  currency text,
  list_amount_minor bigint,
  coupon_id uuid,
  coupon_code text,
  discount_amount_minor bigint,
  payable_amount_minor bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.examinations%rowtype;
  v_price public.exam_prices%rowtype;
  v_coupon public.coupons%rowtype;
  v_usage_count integer;
  v_candidate_usage integer;
  v_discount bigint := 0;
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'NGN'));
begin
  select * into v_exam
  from public.examinations
  where id = p_examination_id
    and status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());

  if not found then
    raise exception 'This examination is not currently available for purchase.';
  end if;

  select * into v_price
  from public.exam_prices
  where examination_id = p_examination_id
    and currency = v_currency
    and is_active = true
    and effective_from <= now()
    and (effective_to is null or effective_to > now())
  limit 1;

  if not found then
    raise exception 'A price is not configured for currency %.', v_currency;
  end if;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons c
    where upper(c.code) = upper(trim(p_coupon_code))
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.expires_at is null or c.expires_at > now())
      and (c.currency is null or c.currency = v_currency)
      and v_price.amount_minor >= c.minimum_amount_minor
      and (
        c.scope = 'all'
        or (c.scope = 'programme' and c.programme_id = v_exam.programme_id)
        or (c.scope = 'examination' and c.examination_id = v_exam.id)
      )
    limit 1;

    if not found then
      raise exception 'The coupon is invalid, expired or not applicable to this examination.';
    end if;

    select count(*) into v_usage_count
    from public.coupon_redemptions cr
    where cr.coupon_id = v_coupon.id
      and cr.status in ('reserved', 'redeemed');

    if v_coupon.maximum_redemptions is not null
       and v_usage_count >= v_coupon.maximum_redemptions then
      raise exception 'This coupon has reached its redemption limit.';
    end if;

    select count(*) into v_candidate_usage
    from public.coupon_redemptions cr
    where cr.coupon_id = v_coupon.id
      and cr.candidate_id = p_candidate_id
      and cr.status in ('reserved', 'redeemed');

    if v_candidate_usage >= v_coupon.per_candidate_limit then
      raise exception 'You have already used this coupon the maximum permitted number of times.';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := floor(v_price.amount_minor * (v_coupon.discount_value / 100.0))::bigint;
    else
      v_discount := least(v_price.amount_minor, floor(v_coupon.discount_value)::bigint);
    end if;

    if v_coupon.maximum_discount_minor is not null then
      v_discount := least(v_discount, v_coupon.maximum_discount_minor);
    end if;
  end if;

  return query
  select
    v_exam.id,
    v_price.id,
    v_currency,
    v_price.amount_minor,
    v_coupon.id,
    case when v_coupon.id is null then null else upper(v_coupon.code) end,
    greatest(0, least(v_discount, v_price.amount_minor)),
    greatest(0, v_price.amount_minor - least(v_discount, v_price.amount_minor));
end;
$$;

create or replace function public.quote_exam_purchase(
  p_examination_id uuid,
  p_currency text default 'NGN',
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_quote record;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'Only an active candidate account may request an examination quote.';
  end if;

  select * into v_quote
  from public.resolve_exam_purchase_quote(
    p_examination_id,
    v_candidate_id,
    p_currency,
    p_coupon_code
  );

  return jsonb_build_object(
    'examinationId', v_quote.examination_id,
    'priceId', v_quote.price_id,
    'currency', v_quote.currency,
    'listAmountMinor', v_quote.list_amount_minor,
    'couponId', v_quote.coupon_id,
    'couponCode', v_quote.coupon_code,
    'discountAmountMinor', v_quote.discount_amount_minor,
    'payableAmountMinor', v_quote.payable_amount_minor
  );
end;
$$;

create or replace function public.grant_exam_access_from_order(p_order_id uuid)
returns public.exam_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.exam_orders%rowtype;
  v_assignment public.exam_assignments%rowtype;
begin
  select * into v_order
  from public.exam_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The examination order was not found.';
  end if;

  if v_order.status not in ('paid', 'waived') then
    raise exception 'The examination order has not been paid or waived.';
  end if;

  insert into public.exam_assignments (
    examination_id, candidate_id, assigned_by,
    available_from, expires_at, max_attempts_override, status
  ) values (
    v_order.examination_id, v_order.candidate_id, null,
    now(), null, null, 'assigned'
  )
  on conflict (examination_id, candidate_id) do update
  set available_from = now(),
      expires_at = null,
      status = 'assigned',
      updated_at = now()
  returning * into v_assignment;

  update public.exam_orders
  set fulfilled_at = coalesce(fulfilled_at, now()),
      updated_at = now()
  where id = v_order.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'grant_exam_access',
    'exam_order',
    v_order.id::text,
    jsonb_build_object(
      'candidate_id', v_order.candidate_id,
      'examination_id', v_order.examination_id,
      'reference', v_order.reference,
      'status', v_order.status
    )
  );

  return v_assignment;
end;
$$;

create or replace function public.create_exam_order(
  p_examination_id uuid,
  p_currency text default 'NGN',
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_quote record;
  v_order public.exam_orders%rowtype;
  v_existing public.exam_orders%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'Only an active candidate account may create an examination order.';
  end if;

  if exists (
    select 1 from public.exam_assignments ea
    where ea.examination_id = p_examination_id
      and ea.candidate_id = v_candidate_id
      and ea.status = 'assigned'
      and (ea.available_from is null or ea.available_from <= now())
      and (ea.expires_at is null or ea.expires_at > now())
  ) then
    return jsonb_build_object(
      'status', 'already_unlocked',
      'examinationId', p_examination_id,
      'canLaunch', true
    );
  end if;

  update public.exam_orders
  set status = 'expired', updated_at = now()
  where candidate_id = v_candidate_id
    and examination_id = p_examination_id
    and status = 'pending'
    and expires_at <= now();

  update public.coupon_redemptions cr
  set status = 'released', released_at = now(), updated_at = now()
  from public.exam_orders eo
  where cr.order_id = eo.id
    and eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.status = 'expired'
    and cr.status = 'reserved';

  select * into v_existing
  from public.exam_orders
  where candidate_id = v_candidate_id
    and examination_id = p_examination_id
    and currency = upper(coalesce(nullif(trim(p_currency), ''), 'NGN'))
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'orderId', v_existing.id,
      'reference', v_existing.reference,
      'examinationId', v_existing.examination_id,
      'currency', v_existing.currency,
      'listAmountMinor', v_existing.list_amount_minor,
      'discountAmountMinor', v_existing.discount_amount_minor,
      'payableAmountMinor', v_existing.payable_amount_minor,
      'status', v_existing.status,
      'expiresAt', v_existing.expires_at
    );
  end if;

  select * into v_quote
  from public.resolve_exam_purchase_quote(
    p_examination_id,
    v_candidate_id,
    p_currency,
    p_coupon_code
  );

  if v_quote.coupon_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_quote.coupon_id::text));

    select * into v_quote
    from public.resolve_exam_purchase_quote(
      p_examination_id,
      v_candidate_id,
      p_currency,
      p_coupon_code
    );
  end if;

  insert into public.exam_orders (
    candidate_id, examination_id, price_id, coupon_id,
    currency, list_amount_minor, discount_amount_minor, payable_amount_minor,
    status, gateway, expires_at
  ) values (
    v_candidate_id,
    v_quote.examination_id,
    v_quote.price_id,
    v_quote.coupon_id,
    v_quote.currency,
    v_quote.list_amount_minor,
    v_quote.discount_amount_minor,
    v_quote.payable_amount_minor,
    case when v_quote.payable_amount_minor = 0 then 'waived' else 'pending' end,
    'paystack',
    now() + interval '30 minutes'
  ) returning * into v_order;

  if v_quote.coupon_id is not null then
    insert into public.coupon_redemptions (
      coupon_id, order_id, candidate_id, discount_amount_minor,
      status, redeemed_at
    ) values (
      v_quote.coupon_id,
      v_order.id,
      v_candidate_id,
      v_quote.discount_amount_minor,
      case when v_order.status = 'waived' then 'redeemed' else 'reserved' end,
      case when v_order.status = 'waived' then now() else null end
    );
  end if;

  if v_order.status = 'waived' then
    perform public.grant_exam_access_from_order(v_order.id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_candidate_id,
    'create_exam_order',
    'exam_order',
    v_order.id::text,
    jsonb_build_object(
      'reference', v_order.reference,
      'examination_id', v_order.examination_id,
      'currency', v_order.currency,
      'payable_amount_minor', v_order.payable_amount_minor,
      'status', v_order.status
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'examinationId', v_order.examination_id,
    'currency', v_order.currency,
    'listAmountMinor', v_order.list_amount_minor,
    'discountAmountMinor', v_order.discount_amount_minor,
    'payableAmountMinor', v_order.payable_amount_minor,
    'status', v_order.status,
    'canLaunch', v_order.status = 'waived',
    'expiresAt', v_order.expires_at
  );
end;
$$;

-- Called by a verified Paystack webhook Edge Function (service role) or by an exam admin.
create or replace function public.fulfil_paid_exam_order(
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
  v_order public.exam_orders%rowtype;
  v_assignment public.exam_assignments%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_exam_admin() then
    raise exception 'Only the verified payment service or an examination administrator may fulfil an order.';
  end if;

  select * into v_order
  from public.exam_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The examination order was not found.';
  end if;

  if v_order.status in ('paid', 'waived') and v_order.fulfilled_at is not null then
    return jsonb_build_object(
      'orderId', v_order.id,
      'reference', v_order.reference,
      'status', v_order.status,
      'fulfilledAt', v_order.fulfilled_at,
      'alreadyFulfilled', true
    );
  end if;

  if v_order.status <> 'pending' then
    raise exception 'This order cannot be fulfilled from status %.', v_order.status;
  end if;

  update public.exam_orders
  set status = 'paid', paid_at = now(), updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.exam_payments (
    order_id, provider, reference, provider_transaction_id,
    status, amount_minor, currency, paid_at, provider_payload
  ) values (
    v_order.id,
    'paystack',
    v_order.reference,
    nullif(trim(p_provider_transaction_id), ''),
    'success',
    v_order.payable_amount_minor,
    v_order.currency,
    now(),
    coalesce(p_provider_payload, '{}'::jsonb)
  )
  on conflict (provider, reference) do update
  set provider_transaction_id = excluded.provider_transaction_id,
      status = 'success',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      paid_at = excluded.paid_at,
      provider_payload = excluded.provider_payload,
      updated_at = now();

  update public.coupon_redemptions
  set status = 'redeemed', redeemed_at = now(), updated_at = now()
  where order_id = v_order.id and status = 'reserved';

  v_assignment := public.grant_exam_access_from_order(v_order.id);

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'status', 'paid',
    'assignmentId', v_assignment.id,
    'examinationId', v_assignment.examination_id,
    'candidateId', v_assignment.candidate_id,
    'canLaunch', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Candidate catalogue: show all published exams, but never disclose questions.
-- ---------------------------------------------------------------------------

create or replace function public.get_available_exams()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(exam_payload order by title), '[]'::jsonb)
  from (
    select
      e.title,
      jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'course', p.code,
        'durationMinutes', e.duration_minutes,
        'questionCount', (
          select count(*) from public.questions q
          where q.examination_id = e.id and q.is_active
        ),
        'description', coalesce(p.description, e.instructions, ''),
        'questions', '[]'::jsonb,
        'requiresPayment', e.requires_payment,
        'canLaunch', case
          when public.current_user_role() <> 'candidate' then false
          when ea.id is not null
            and ea.status = 'assigned'
            and (ea.available_from is null or ea.available_from <= now())
            and (ea.expires_at is null or ea.expires_at > now()) then true
          else false
        end,
        'accessStatus', case
          when public.current_user_role() <> 'candidate' then 'staff_view'
          when ea.status = 'completed' then 'completed'
          when ea.status = 'expired' or (ea.expires_at is not null and ea.expires_at <= now()) then 'expired'
          when ea.id is not null
            and ea.status = 'assigned'
            and (ea.available_from is null or ea.available_from <= now())
            and (ea.expires_at is null or ea.expires_at > now()) then 'unlocked'
          else 'locked'
        end,
        'defaultPrice', case when dp.id is null then null else jsonb_build_object(
          'id', dp.id,
          'currency', dp.currency,
          'amountMinor', dp.amount_minor
        ) end,
        'prices', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', ep.id,
              'currency', ep.currency,
              'amountMinor', ep.amount_minor,
              'countryCodes', ep.country_codes,
              'isDefault', ep.is_default
            ) order by ep.is_default desc, ep.currency
          )
          from public.exam_prices ep
          where ep.examination_id = e.id
            and ep.is_active = true
            and ep.effective_from <= now()
            and (ep.effective_to is null or ep.effective_to > now())
        ), '[]'::jsonb)
      ) as exam_payload
    from public.examinations e
    join public.programmes p on p.id = e.programme_id
    left join public.exam_assignments ea
      on ea.examination_id = e.id and ea.candidate_id = auth.uid()
    left join lateral (
      select ep.*
      from public.exam_prices ep
      where ep.examination_id = e.id
        and ep.is_active = true
        and ep.effective_from <= now()
        and (ep.effective_to is null or ep.effective_to > now())
      order by ep.is_default desc, case when ep.currency = 'NGN' then 0 else 1 end, ep.currency
      limit 1
    ) dp on true
    where e.status = 'published'
      and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now())
  ) catalogue;
$$;

-- Secure start: questions are released only after payment/waiver/admin assignment.
create or replace function public.start_exam_secure(
  p_examination_id uuid,
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_exam public.examinations%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_session public.exam_sessions%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
  v_expiry timestamptz;
  v_test jsonb;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'Only an active candidate account may start an examination.';
  end if;

  select * into v_exam
  from public.examinations
  where id = p_examination_id
  for update;

  if not found or v_exam.status <> 'published' then
    raise exception 'This examination is not available.';
  end if;
  if v_exam.starts_at is not null and v_exam.starts_at > now() then
    raise exception 'This examination has not opened.';
  end if;
  if v_exam.ends_at is not null and v_exam.ends_at <= now() then
    raise exception 'This examination has closed.';
  end if;

  select * into v_assignment
  from public.exam_assignments
  where examination_id = p_examination_id and candidate_id = v_candidate_id
  for update;

  if not found then
    if v_exam.requires_payment then
      raise exception 'Payment or an approved scholarship coupon is required before this examination can be launched.';
    end if;
    raise exception 'You have not been granted access to this examination.';
  end if;

  if v_assignment.status <> 'assigned' then
    raise exception 'This examination access is not active.';
  end if;
  if v_assignment.available_from is not null and v_assignment.available_from > now() then
    raise exception 'This examination access is not yet available.';
  end if;
  if v_assignment.expires_at is not null and v_assignment.expires_at <= now() then
    update public.exam_assignments set status = 'expired' where id = v_assignment.id;
    raise exception 'This examination access has expired.';
  end if;

  update public.exam_sessions
  set status = 'expired', updated_at = now()
  where assignment_id = v_assignment.id
    and status = 'active'
    and expires_at <= now();

  select * into v_session
  from public.exam_sessions
  where assignment_id = v_assignment.id and status = 'active'
  order by started_at desc
  limit 1;

  if not found then
    select count(*) into v_attempt_count
    from public.attempts
    where examination_id = p_examination_id and candidate_id = v_candidate_id;

    v_max_attempts := coalesce(v_assignment.max_attempts_override, v_exam.max_attempts);
    if v_attempt_count >= v_max_attempts then
      update public.exam_assignments set status = 'completed' where id = v_assignment.id;
      raise exception 'The maximum number of attempts has been reached.';
    end if;

    v_expiry := now() + make_interval(mins => v_exam.duration_minutes);
    if v_exam.ends_at is not null then v_expiry := least(v_expiry, v_exam.ends_at); end if;
    if v_assignment.expires_at is not null then v_expiry := least(v_expiry, v_assignment.expires_at); end if;

    insert into public.exam_sessions (
      assignment_id, examination_id, candidate_id, expires_at, client_fingerprint
    ) values (
      v_assignment.id, p_examination_id, v_candidate_id, v_expiry,
      coalesce(p_client_fingerprint, '{}'::jsonb)
    ) returning * into v_session;
  end if;

  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'course', p.code,
    'durationMinutes', greatest(1, ceil(extract(epoch from (v_session.expires_at - now())) / 60.0)::integer),
    'questionCount', (
      select count(*) from public.questions q
      where q.examination_id = e.id and q.is_active
    ),
    'description', coalesce(p.description, e.instructions, ''),
    'sessionId', v_session.id,
    'expiresAt', v_session.expires_at,
    'assignmentId', v_assignment.id,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'text', q.question_text,
          'options', coalesce((
            select jsonb_agg(qo.option_text order by qo.position)
            from public.question_options qo
            where qo.question_id = q.id
          ), '[]'::jsonb)
        ) order by q.position
      )
      from public.questions q
      where q.examination_id = e.id and q.is_active
    ), '[]'::jsonb)
  ) into v_test
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where e.id = p_examination_id;

  return v_test;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.exam_prices enable row level security;
alter table public.coupons enable row level security;
alter table public.exam_orders enable row level security;
alter table public.exam_payments enable row level security;
alter table public.coupon_redemptions enable row level security;

revoke all on public.exam_prices from authenticated;
revoke all on public.coupons from authenticated;
revoke all on public.exam_orders from authenticated;
revoke all on public.exam_payments from authenticated;
revoke all on public.coupon_redemptions from authenticated;

grant select on public.exam_prices to authenticated;
grant select on public.exam_orders to authenticated;
grant select on public.exam_payments to authenticated;
grant select on public.coupon_redemptions to authenticated;

drop policy if exists "exam_prices_select" on public.exam_prices;
create policy "exam_prices_select"
  on public.exam_prices for select to authenticated
  using (
    public.is_exam_admin()
    or (
      is_active = true
      and effective_from <= now()
      and (effective_to is null or effective_to > now())
    )
  );

drop policy if exists "exam_prices_admin_manage" on public.exam_prices;
create policy "exam_prices_admin_manage"
  on public.exam_prices for all to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "coupons_admin_manage" on public.coupons;
create policy "coupons_admin_manage"
  on public.coupons for all to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "exam_orders_select_own" on public.exam_orders;
create policy "exam_orders_select_own"
  on public.exam_orders for select to authenticated
  using (candidate_id = auth.uid() or public.is_exam_admin());

drop policy if exists "exam_orders_admin_manage" on public.exam_orders;
create policy "exam_orders_admin_manage"
  on public.exam_orders for all to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "exam_payments_select_own" on public.exam_payments;
create policy "exam_payments_select_own"
  on public.exam_payments for select to authenticated
  using (
    public.is_exam_admin()
    or exists (
      select 1 from public.exam_orders eo
      where eo.id = order_id and eo.candidate_id = auth.uid()
    )
  );

drop policy if exists "exam_payments_admin_manage" on public.exam_payments;
create policy "exam_payments_admin_manage"
  on public.exam_payments for all to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own"
  on public.coupon_redemptions for select to authenticated
  using (candidate_id = auth.uid() or public.is_exam_admin());

drop policy if exists "coupon_redemptions_admin_manage" on public.coupon_redemptions;
create policy "coupon_redemptions_admin_manage"
  on public.coupon_redemptions for all to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

revoke all on function public.resolve_exam_purchase_quote(uuid, uuid, text, text) from public;
revoke all on function public.quote_exam_purchase(uuid, text, text) from public;
revoke all on function public.create_exam_order(uuid, text, text) from public;
revoke all on function public.grant_exam_access_from_order(uuid) from public;
revoke all on function public.fulfil_paid_exam_order(uuid, text, jsonb) from public;
revoke all on function public.get_available_exams() from public;
revoke all on function public.start_exam_secure(uuid, jsonb) from public;

grant execute on function public.quote_exam_purchase(uuid, text, text) to authenticated;
grant execute on function public.create_exam_order(uuid, text, text) to authenticated;
grant execute on function public.fulfil_paid_exam_order(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.get_available_exams() to authenticated;
grant execute on function public.start_exam_secure(uuid, jsonb) to authenticated;

commit;
