begin;

-- Keep NGN as the single default price for each published examination.
update public.exam_prices ep
set is_default = false,
    updated_at = now()
where ep.currency <> 'NGN'
  and ep.is_default = true
  and exists (
    select 1 from public.examinations e
    where e.id = ep.examination_id and e.status = 'published'
  );

update public.exam_prices ep
set is_default = true,
    is_active = true,
    updated_at = now()
where ep.currency = 'NGN'
  and exists (
    select 1 from public.examinations e
    where e.id = ep.examination_id and e.status = 'published'
  );

-- Replace the quote resolver with explicitly qualified column references.
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
  select e.* into v_exam
  from public.examinations e
  where e.id = p_examination_id
    and e.status = 'published'
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at > now());

  if not found then
    raise exception 'This examination is not currently available for purchase.';
  end if;

  select ep.* into v_price
  from public.exam_prices ep
  where ep.examination_id = p_examination_id
    and ep.currency = v_currency
    and ep.is_active = true
    and ep.effective_from <= now()
    and (ep.effective_to is null or ep.effective_to > now())
  limit 1;

  if not found then
    raise exception 'A price is not configured for currency %.', v_currency;
  end if;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select c.* into v_coupon
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

-- RLS policies still decide who may write; these grants make admin policies usable.
grant select, insert, update, delete on public.exam_prices to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select, insert, update, delete on public.exam_orders to authenticated;
grant select, insert, update, delete on public.exam_payments to authenticated;
grant select, insert, update, delete on public.coupon_redemptions to authenticated;

revoke all on function public.resolve_exam_purchase_quote(uuid, uuid, text, text) from public;

commit;
