begin;

-- Controlled Phase 8 increment: one CHRMP-only, 100% checkout coupon.
-- The existing commerce engine enforces the five-redemption ceiling,
-- one redemption per candidate, zero-payable waiver fulfilment and audit trail.
do $$
declare
  v_examination_id uuid;
  v_coupon_id uuid;
begin
  select e.id
  into v_examination_id
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where upper(p.code) = 'CHRMP'
    and e.status = 'published'
  order by e.created_at
  limit 1;

  if v_examination_id is null then
    raise exception 'The published CHRMP examination was not found.';
  end if;

  select c.id
  into v_coupon_id
  from public.coupons c
  where upper(c.code) = 'CHRMP100'
  limit 1
  for update;

  if v_coupon_id is null then
    insert into public.coupons (
      code,
      name,
      description,
      discount_type,
      discount_value,
      currency,
      scope,
      programme_id,
      examination_id,
      minimum_amount_minor,
      maximum_discount_minor,
      starts_at,
      expires_at,
      maximum_redemptions,
      per_candidate_limit,
      is_active,
      created_by
    ) values (
      'CHRMP100',
      'CHRMP 100% Sponsorship Coupon',
      'Provides a full CHRMP examination checkout waiver for the first five eligible candidates. Limited to one redemption per candidate.',
      'percentage',
      100,
      null,
      'examination',
      null,
      v_examination_id,
      0,
      null,
      now(),
      timestamptz '2026-08-24 22:59:59+00',
      5,
      1,
      true,
      null
    )
    returning id into v_coupon_id;
  else
    update public.coupons
    set code = 'CHRMP100',
        name = 'CHRMP 100% Sponsorship Coupon',
        description = 'Provides a full CHRMP examination checkout waiver for the first five eligible candidates. Limited to one redemption per candidate.',
        discount_type = 'percentage',
        discount_value = 100,
        currency = null,
        scope = 'examination',
        programme_id = null,
        examination_id = v_examination_id,
        minimum_amount_minor = 0,
        maximum_discount_minor = null,
        starts_at = now(),
        expires_at = timestamptz '2026-08-24 22:59:59+00',
        maximum_redemptions = 5,
        per_candidate_limit = 1,
        is_active = true,
        updated_at = now()
    where id = v_coupon_id;
  end if;

  if not exists (
    select 1
    from public.coupons c
    where c.id = v_coupon_id
      and upper(c.code) = 'CHRMP100'
      and c.discount_type = 'percentage'
      and c.discount_value = 100
      and c.scope = 'examination'
      and c.examination_id = v_examination_id
      and c.maximum_redemptions = 5
      and c.per_candidate_limit = 1
      and c.is_active = true
      and c.expires_at = timestamptz '2026-08-24 22:59:59+00'
  ) then
    raise exception 'The CHRMP100 coupon configuration could not be verified.';
  end if;
end;
$$;

commit;
