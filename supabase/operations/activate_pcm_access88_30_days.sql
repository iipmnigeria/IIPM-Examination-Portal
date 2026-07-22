begin;

-- Activate the existing PCM 88% discount code for 30 days from execution.
-- Restricted to the PCM programme, NGN purchases and one redemption per candidate.
update public.coupons c
set name = 'PCM 88% Access Discount - 30 Days',
    description = '88% discount for Procurement and Contract Management (PCM). Valid for 30 days from activation and once per candidate.',
    discount_type = 'percentage',
    discount_value = 88,
    currency = 'NGN',
    scope = 'programme',
    programme_id = (select id from public.programmes where code = 'PCM' limit 1),
    examination_id = null,
    minimum_amount_minor = 0,
    maximum_discount_minor = null,
    starts_at = now(),
    expires_at = now() + interval '30 days',
    per_candidate_limit = 1,
    is_active = true,
    updated_at = now()
where upper(c.code) = 'IIPM-PCM-ACCESS88-F2D29DA814';

-- Fail atomically if the coupon was not found or remains incorrectly configured.
do $$
declare
  v_coupon public.coupons%rowtype;
  v_pcm_programme_id uuid;
begin
  select id into v_pcm_programme_id
  from public.programmes
  where code = 'PCM'
  limit 1;

  if v_pcm_programme_id is null then
    raise exception 'PCM programme was not found.';
  end if;

  select * into v_coupon
  from public.coupons
  where upper(code) = 'IIPM-PCM-ACCESS88-F2D29DA814';

  if not found then
    raise exception 'Coupon IIPM-PCM-ACCESS88-F2D29DA814 was not found.';
  end if;

  if v_coupon.is_active is not true
     or v_coupon.discount_type <> 'percentage'
     or v_coupon.discount_value <> 88
     or v_coupon.currency <> 'NGN'
     or v_coupon.scope <> 'programme'
     or v_coupon.programme_id <> v_pcm_programme_id
     or v_coupon.examination_id is not null
     or v_coupon.starts_at > now()
     or v_coupon.expires_at <= now()
     or v_coupon.expires_at > now() + interval '30 days 5 minutes'
     or v_coupon.per_candidate_limit <> 1 then
    raise exception 'The PCM 88%% coupon activation validation failed.';
  end if;
end;
$$;

commit;

-- Return the active coupon details and expected payable amount.
select
  c.code,
  p.code as programme_code,
  c.discount_value as discount_percent,
  c.starts_at,
  c.expires_at,
  c.is_active,
  c.per_candidate_limit,
  25000.00 as list_fee_ngn,
  3000.00 as payable_after_discount_ngn
from public.coupons c
join public.programmes p on p.id = c.programme_id
where upper(c.code) = 'IIPM-PCM-ACCESS88-F2D29DA814';
