begin;

create or replace function public.get_admin_commerce_snapshot(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_result jsonb;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may access commerce controls.';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'publishedExaminations', (select count(*) from public.examinations e where e.status = 'published'),
      'activePrices', (select count(*) from public.exam_prices ep where ep.is_active = true),
      'activeCoupons', (select count(*) from public.coupons c where c.is_active = true),
      'pendingOrders', (select count(*) from public.exam_orders eo where eo.status = 'pending'),
      'paidOrders', (select count(*) from public.exam_orders eo where eo.status = 'paid'),
      'waivedOrders', (select count(*) from public.exam_orders eo where eo.status = 'waived'),
      'failedOrders', (select count(*) from public.exam_orders eo where eo.status in ('failed', 'cancelled', 'expired')),
      'paidByCurrency', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'currency', paid.currency,
            'amountMinor', paid.amount_minor,
            'transactions', paid.transaction_count
          ) order by paid.currency
        )
        from (
          select eo.currency,
                 coalesce(sum(eo.payable_amount_minor), 0)::bigint as amount_minor,
                 count(*)::integer as transaction_count
          from public.exam_orders eo
          where eo.status = 'paid'
          group by eo.currency
        ) paid
      ), '[]'::jsonb)
    ),
    'examinations', coalesce((
      select jsonb_agg(exam_payload order by exam_payload ->> 'course')
      from (
        select jsonb_build_object(
          'id', e.id,
          'programmeId', p.id,
          'course', p.code,
          'title', e.title,
          'status', e.status,
          'requiresPayment', e.requires_payment,
          'prices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ep.id,
                'currency', ep.currency,
                'amountMinor', ep.amount_minor,
                'countryCodes', ep.country_codes,
                'isDefault', ep.is_default,
                'isActive', ep.is_active,
                'effectiveFrom', ep.effective_from,
                'effectiveTo', ep.effective_to,
                'updatedAt', ep.updated_at
              ) order by ep.is_default desc, ep.currency
            )
            from public.exam_prices ep
            where ep.examination_id = e.id
          ), '[]'::jsonb)
        ) as exam_payload
        from public.examinations e
        join public.programmes p on p.id = e.programme_id
        where e.status <> 'archived'
      ) exams
    ), '[]'::jsonb),
    'programmes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'code', p.code,
          'name', p.name,
          'isActive', p.is_active
        ) order by p.code
      )
      from public.programmes p
    ), '[]'::jsonb),
    'coupons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', upper(c.code),
          'name', c.name,
          'description', c.description,
          'discountType', c.discount_type,
          'discountValue', c.discount_value,
          'currency', c.currency,
          'scope', c.scope,
          'programmeId', c.programme_id,
          'examinationId', c.examination_id,
          'minimumAmountMinor', c.minimum_amount_minor,
          'maximumDiscountMinor', c.maximum_discount_minor,
          'startsAt', c.starts_at,
          'expiresAt', c.expires_at,
          'maximumRedemptions', c.maximum_redemptions,
          'perCandidateLimit', c.per_candidate_limit,
          'isActive', c.is_active,
          'reservedCount', (
            select count(*) from public.coupon_redemptions cr
            where cr.coupon_id = c.id and cr.status = 'reserved'
          ),
          'redeemedCount', (
            select count(*) from public.coupon_redemptions cr
            where cr.coupon_id = c.id and cr.status = 'redeemed'
          ),
          'createdAt', c.created_at,
          'updatedAt', c.updated_at
        ) order by c.created_at desc
      )
      from public.coupons c
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(order_payload order by order_payload ->> 'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', eo.id,
          'reference', eo.reference,
          'candidateId', eo.candidate_id,
          'candidateName', pr.full_name,
          'candidateEmail', pr.email,
          'examinationId', eo.examination_id,
          'course', p.code,
          'examinationTitle', e.title,
          'couponCode', case when c.id is null then null else upper(c.code) end,
          'currency', eo.currency,
          'listAmountMinor', eo.list_amount_minor,
          'discountAmountMinor', eo.discount_amount_minor,
          'payableAmountMinor', eo.payable_amount_minor,
          'status', eo.status,
          'gateway', eo.gateway,
          'expiresAt', eo.expires_at,
          'paidAt', eo.paid_at,
          'fulfilledAt', eo.fulfilled_at,
          'createdAt', eo.created_at,
          'updatedAt', eo.updated_at
        ) as order_payload
        from public.exam_orders eo
        join public.profiles pr on pr.id = eo.candidate_id
        join public.examinations e on e.id = eo.examination_id
        join public.programmes p on p.id = e.programme_id
        left join public.coupons c on c.id = eo.coupon_id
        order by eo.created_at desc
        limit v_limit
      ) recent_orders
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(payment_payload order by payment_payload ->> 'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', pay.id,
          'orderId', pay.order_id,
          'reference', pay.reference,
          'provider', pay.provider,
          'providerTransactionId', pay.provider_transaction_id,
          'candidateName', pr.full_name,
          'candidateEmail', pr.email,
          'course', p.code,
          'examinationTitle', e.title,
          'status', pay.status,
          'amountMinor', pay.amount_minor,
          'currency', pay.currency,
          'paidAt', pay.paid_at,
          'createdAt', pay.created_at,
          'updatedAt', pay.updated_at
        ) as payment_payload
        from public.exam_payments pay
        join public.exam_orders eo on eo.id = pay.order_id
        join public.profiles pr on pr.id = eo.candidate_id
        join public.examinations e on e.id = eo.examination_id
        join public.programmes p on p.id = e.programme_id
        order by pay.created_at desc
        limit v_limit
      ) recent_payments
    ), '[]'::jsonb),
    'redemptions', coalesce((
      select jsonb_agg(redemption_payload order by redemption_payload ->> 'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', cr.id,
          'couponCode', upper(c.code),
          'candidateName', pr.full_name,
          'candidateEmail', pr.email,
          'course', p.code,
          'examinationTitle', e.title,
          'orderReference', eo.reference,
          'currency', eo.currency,
          'discountAmountMinor', cr.discount_amount_minor,
          'status', cr.status,
          'redeemedAt', cr.redeemed_at,
          'releasedAt', cr.released_at,
          'createdAt', cr.created_at
        ) as redemption_payload
        from public.coupon_redemptions cr
        join public.coupons c on c.id = cr.coupon_id
        join public.exam_orders eo on eo.id = cr.order_id
        join public.profiles pr on pr.id = cr.candidate_id
        join public.examinations e on e.id = eo.examination_id
        join public.programmes p on p.id = e.programme_id
        order by cr.created_at desc
        limit v_limit
      ) recent_redemptions
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_upsert_exam_price(
  p_examination_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_country_codes text[] default '{}'::text[],
  p_is_default boolean default false,
  p_is_active boolean default true,
  p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_country_codes text[];
  v_price public.exam_prices%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may manage prices.';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a valid three-letter ISO code.';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'The price must be greater than zero.';
  end if;
  if not exists (select 1 from public.examinations e where e.id = p_examination_id) then
    raise exception 'The examination was not found.';
  end if;
  if p_effective_to is not null and p_effective_to <= coalesce(p_effective_from, now()) then
    raise exception 'The price expiry must be after its effective date.';
  end if;

  select coalesce(array_agg(distinct upper(trim(code))) filter (where trim(code) <> ''), '{}'::text[])
  into v_country_codes
  from unnest(coalesce(p_country_codes, '{}'::text[])) code;

  if p_is_default and p_is_active then
    update public.exam_prices ep
    set is_default = false,
        updated_at = now()
    where ep.examination_id = p_examination_id
      and ep.currency <> v_currency
      and ep.is_default = true;
  end if;

  insert into public.exam_prices (
    examination_id, currency, amount_minor, country_codes,
    is_default, is_active, effective_from, effective_to, created_by
  ) values (
    p_examination_id,
    v_currency,
    p_amount_minor,
    v_country_codes,
    p_is_default,
    p_is_active,
    coalesce(p_effective_from, now()),
    p_effective_to,
    auth.uid()
  )
  on conflict (examination_id, currency) do update
  set amount_minor = excluded.amount_minor,
      country_codes = excluded.country_codes,
      is_default = excluded.is_default,
      is_active = excluded.is_active,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      updated_at = now()
  returning * into v_price;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'upsert_exam_price',
    'exam_price',
    v_price.id::text,
    jsonb_build_object(
      'examination_id', v_price.examination_id,
      'currency', v_price.currency,
      'amount_minor', v_price.amount_minor,
      'is_default', v_price.is_default,
      'is_active', v_price.is_active,
      'country_codes', v_price.country_codes
    )
  );

  return jsonb_build_object(
    'id', v_price.id,
    'examinationId', v_price.examination_id,
    'currency', v_price.currency,
    'amountMinor', v_price.amount_minor,
    'countryCodes', v_price.country_codes,
    'isDefault', v_price.is_default,
    'isActive', v_price.is_active,
    'effectiveFrom', v_price.effective_from,
    'effectiveTo', v_price.effective_to
  );
end;
$$;

create or replace function public.admin_upsert_coupon(
  p_coupon_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_description text default null,
  p_discount_type text default 'percentage',
  p_discount_value numeric default 0,
  p_currency text default null,
  p_scope text default 'all',
  p_programme_id uuid default null,
  p_examination_id uuid default null,
  p_minimum_amount_minor bigint default 0,
  p_maximum_discount_minor bigint default null,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_maximum_redemptions integer default null,
  p_per_candidate_limit integer default 1,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_currency text := case
    when p_currency is null or trim(p_currency) = '' then null
    else upper(trim(p_currency))
  end;
  v_coupon public.coupons%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may manage coupons.';
  end if;

  if v_code = '' or v_code !~ '^[A-Z0-9_-]{3,40}$' then
    raise exception 'Coupon codes must contain 3 to 40 letters, numbers, underscores or hyphens.';
  end if;
  if p_discount_type not in ('percentage', 'fixed') then
    raise exception 'Discount type must be percentage or fixed.';
  end if;
  if p_discount_value is null or p_discount_value <= 0 then
    raise exception 'Discount value must be greater than zero.';
  end if;
  if p_discount_type = 'percentage' and p_discount_value > 100 then
    raise exception 'Percentage discounts cannot exceed 100 percent.';
  end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Coupon currency must be a valid three-letter ISO code.';
  end if;
  if p_scope not in ('all', 'programme', 'examination') then
    raise exception 'Coupon scope is invalid.';
  end if;
  if p_scope = 'all' and (p_programme_id is not null or p_examination_id is not null) then
    raise exception 'An all-examinations coupon cannot have a programme or examination target.';
  end if;
  if p_scope = 'programme' and (p_programme_id is null or p_examination_id is not null) then
    raise exception 'A programme coupon requires exactly one programme target.';
  end if;
  if p_scope = 'examination' and (p_examination_id is null or p_programme_id is not null) then
    raise exception 'An examination coupon requires exactly one examination target.';
  end if;
  if p_expires_at is not null and p_starts_at is not null and p_expires_at <= p_starts_at then
    raise exception 'Coupon expiry must be after its start date.';
  end if;
  if coalesce(p_per_candidate_limit, 0) < 1 then
    raise exception 'Per-candidate use limit must be at least one.';
  end if;

  if p_coupon_id is null then
    insert into public.coupons (
      code, name, description, discount_type, discount_value,
      currency, scope, programme_id, examination_id,
      minimum_amount_minor, maximum_discount_minor,
      starts_at, expires_at, maximum_redemptions,
      per_candidate_limit, is_active, created_by
    ) values (
      v_code,
      nullif(trim(coalesce(p_name, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''),
      p_discount_type,
      p_discount_value,
      v_currency,
      p_scope,
      case when p_scope = 'programme' then p_programme_id else null end,
      case when p_scope = 'examination' then p_examination_id else null end,
      greatest(coalesce(p_minimum_amount_minor, 0), 0),
      p_maximum_discount_minor,
      p_starts_at,
      p_expires_at,
      p_maximum_redemptions,
      p_per_candidate_limit,
      p_is_active,
      auth.uid()
    ) returning * into v_coupon;
  else
    update public.coupons c
    set code = v_code,
        name = nullif(trim(coalesce(p_name, '')), ''),
        description = nullif(trim(coalesce(p_description, '')), ''),
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        currency = v_currency,
        scope = p_scope,
        programme_id = case when p_scope = 'programme' then p_programme_id else null end,
        examination_id = case when p_scope = 'examination' then p_examination_id else null end,
        minimum_amount_minor = greatest(coalesce(p_minimum_amount_minor, 0), 0),
        maximum_discount_minor = p_maximum_discount_minor,
        starts_at = p_starts_at,
        expires_at = p_expires_at,
        maximum_redemptions = p_maximum_redemptions,
        per_candidate_limit = p_per_candidate_limit,
        is_active = p_is_active,
        updated_at = now()
    where c.id = p_coupon_id
    returning * into v_coupon;

    if not found then
      raise exception 'The coupon was not found.';
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'upsert_coupon',
    'coupon',
    v_coupon.id::text,
    jsonb_build_object(
      'code', upper(v_coupon.code),
      'discount_type', v_coupon.discount_type,
      'discount_value', v_coupon.discount_value,
      'currency', v_coupon.currency,
      'scope', v_coupon.scope,
      'programme_id', v_coupon.programme_id,
      'examination_id', v_coupon.examination_id,
      'is_active', v_coupon.is_active
    )
  );

  return jsonb_build_object(
    'id', v_coupon.id,
    'code', upper(v_coupon.code),
    'name', v_coupon.name,
    'discountType', v_coupon.discount_type,
    'discountValue', v_coupon.discount_value,
    'currency', v_coupon.currency,
    'scope', v_coupon.scope,
    'programmeId', v_coupon.programme_id,
    'examinationId', v_coupon.examination_id,
    'minimumAmountMinor', v_coupon.minimum_amount_minor,
    'maximumDiscountMinor', v_coupon.maximum_discount_minor,
    'startsAt', v_coupon.starts_at,
    'expiresAt', v_coupon.expires_at,
    'maximumRedemptions', v_coupon.maximum_redemptions,
    'perCandidateLimit', v_coupon.per_candidate_limit,
    'isActive', v_coupon.is_active
  );
end;
$$;

create or replace function public.admin_set_coupon_active(
  p_coupon_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may manage coupons.';
  end if;

  update public.coupons c
  set is_active = p_is_active,
      updated_at = now()
  where c.id = p_coupon_id
  returning * into v_coupon;

  if not found then
    raise exception 'The coupon was not found.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'set_coupon_active',
    'coupon',
    v_coupon.id::text,
    jsonb_build_object('code', upper(v_coupon.code), 'is_active', v_coupon.is_active)
  );

  return jsonb_build_object(
    'id', v_coupon.id,
    'code', upper(v_coupon.code),
    'isActive', v_coupon.is_active
  );
end;
$$;

create or replace function public.admin_set_exam_price_active(
  p_price_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price public.exam_prices%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may manage prices.';
  end if;

  update public.exam_prices ep
  set is_active = p_is_active,
      is_default = case when p_is_active then ep.is_default else false end,
      updated_at = now()
  where ep.id = p_price_id
  returning * into v_price;

  if not found then
    raise exception 'The price was not found.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'set_exam_price_active',
    'exam_price',
    v_price.id::text,
    jsonb_build_object(
      'examination_id', v_price.examination_id,
      'currency', v_price.currency,
      'is_active', v_price.is_active
    )
  );

  return jsonb_build_object(
    'id', v_price.id,
    'examinationId', v_price.examination_id,
    'currency', v_price.currency,
    'isActive', v_price.is_active,
    'isDefault', v_price.is_default
  );
end;
$$;

create or replace function public.admin_cancel_exam_order(
  p_order_id uuid,
  p_reason text default 'Cancelled by examination administrator'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.exam_orders%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may cancel orders.';
  end if;

  select eo.* into v_order
  from public.exam_orders eo
  where eo.id = p_order_id
  for update;

  if not found then
    raise exception 'The order was not found.';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Only pending unpaid orders may be cancelled.';
  end if;

  update public.exam_orders eo
  set status = 'cancelled',
      metadata = eo.metadata || jsonb_build_object(
        'cancelled_by', auth.uid(),
        'cancel_reason', coalesce(nullif(trim(p_reason), ''), 'Cancelled by examination administrator'),
        'cancelled_at', now()
      ),
      updated_at = now()
  where eo.id = v_order.id
  returning * into v_order;

  update public.coupon_redemptions cr
  set status = 'released',
      released_at = now(),
      updated_at = now()
  where cr.order_id = v_order.id
    and cr.status = 'reserved';

  update public.exam_payments pay
  set status = case when pay.status = 'initiated' then 'abandoned' else pay.status end,
      updated_at = now()
  where pay.order_id = v_order.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'cancel_exam_order',
    'exam_order',
    v_order.id::text,
    jsonb_build_object(
      'reference', v_order.reference,
      'candidate_id', v_order.candidate_id,
      'examination_id', v_order.examination_id,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Cancelled by examination administrator')
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.get_admin_commerce_snapshot(integer) from public;
revoke all on function public.admin_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz) from public;
revoke all on function public.admin_upsert_coupon(uuid, text, text, text, text, numeric, text, text, uuid, uuid, bigint, bigint, timestamptz, timestamptz, integer, integer, boolean) from public;
revoke all on function public.admin_set_coupon_active(uuid, boolean) from public;
revoke all on function public.admin_set_exam_price_active(uuid, boolean) from public;
revoke all on function public.admin_cancel_exam_order(uuid, text) from public;

grant execute on function public.get_admin_commerce_snapshot(integer) to authenticated;
grant execute on function public.admin_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_upsert_coupon(uuid, text, text, text, text, numeric, text, text, uuid, uuid, bigint, bigint, timestamptz, timestamptz, integer, integer, boolean) to authenticated;
grant execute on function public.admin_set_coupon_active(uuid, boolean) to authenticated;
grant execute on function public.admin_set_exam_price_active(uuid, boolean) to authenticated;
grant execute on function public.admin_cancel_exam_order(uuid, text) to authenticated;

commit;
