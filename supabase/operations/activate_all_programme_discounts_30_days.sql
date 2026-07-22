begin;

-- Activate one 88% access discount and one 100% scholarship offer for every
-- approved IIPM programme for 30 days from execution.
-- Existing generated codes are retained; missing codes are generated securely.

with programme_targets as (
  select id, code, name
  from public.programmes
  where code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
), discount_levels as (
  select
    88::numeric as discount_value,
    'ACCESS88'::text as code_label,
    '88% Access Discount'::text as offer_name
  union all
  select
    100::numeric,
    'SCHOLAR100'::text,
    '100% Scholarship'
), desired as (
  select
    p.id as programme_id,
    p.code as programme_code,
    p.name as programme_name,
    d.discount_value,
    d.code_label,
    d.offer_name,
    format('IIPM 2026 %s - %s', d.offer_name, p.code) as coupon_name
  from programme_targets p
  cross join discount_levels d
)
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
  is_active
)
select
  format(
    'IIPM-%s-%s-%s',
    desired.programme_code,
    desired.code_label,
    upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
  ),
  desired.coupon_name,
  format(
    '%s for %s. Active for 30 days and limited to one redemption per candidate.',
    desired.offer_name,
    desired.programme_name
  ),
  'percentage',
  desired.discount_value,
  'NGN',
  'programme',
  desired.programme_id,
  null,
  0,
  null,
  now(),
  now() + interval '30 days',
  null,
  1,
  true
from desired
where not exists (
  select 1
  from public.coupons existing
  where existing.programme_id = desired.programme_id
    and existing.scope = 'programme'
    and existing.discount_type = 'percentage'
    and existing.discount_value = desired.discount_value
    and upper(existing.code) like
      'IIPM-' || desired.programme_code || '-' || desired.code_label || '-%'
);

-- Activate and standardise every generated code in this campaign.
with programme_targets as (
  select id, code, name
  from public.programmes
  where code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
)
update public.coupons c
set description = case
      when c.discount_value = 100 then
        format('100%% scholarship for %s. Active for 30 days and limited to one redemption per candidate.', p.name)
      else
        format('88%% access discount for %s. Active for 30 days and limited to one redemption per candidate.', p.name)
    end,
    discount_type = 'percentage',
    currency = 'NGN',
    scope = 'programme',
    programme_id = p.id,
    examination_id = null,
    minimum_amount_minor = 0,
    maximum_discount_minor = null,
    starts_at = now(),
    expires_at = now() + interval '30 days',
    per_candidate_limit = 1,
    is_active = true,
    updated_at = now()
from programme_targets p
where c.programme_id = p.id
  and c.discount_type = 'percentage'
  and c.discount_value in (88, 100)
  and (
    upper(c.code) like 'IIPM-' || p.code || '-ACCESS88-%'
    or upper(c.code) like 'IIPM-' || p.code || '-SCHOLAR100-%'
  );

-- Validate all 11 programmes have active 88% and 100% codes.
do $$
declare
  v_missing record;
begin
  select expected.programme_code, expected.discount_value
  into v_missing
  from (
    select
      p.id as programme_id,
      p.code as programme_code,
      d.discount_value,
      d.code_label
    from public.programmes p
    cross join (
      values
        (88::numeric, 'ACCESS88'::text),
        (100::numeric, 'SCHOLAR100'::text)
    ) d(discount_value, code_label)
    where p.code in (
      'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
      'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
    )
  ) expected
  where not exists (
    select 1
    from public.coupons c
    where c.programme_id = expected.programme_id
      and c.scope = 'programme'
      and c.discount_type = 'percentage'
      and c.discount_value = expected.discount_value
      and c.currency = 'NGN'
      and c.is_active = true
      and c.starts_at <= now()
      and c.expires_at > now() + interval '29 days'
      and c.per_candidate_limit = 1
      and upper(c.code) like
        'IIPM-' || expected.programme_code || '-' || expected.code_label || '-%'
  )
  limit 1;

  if found then
    raise exception 'A valid 30-day % discount code is missing for programme %.',
      v_missing.discount_value,
      v_missing.programme_code;
  end if;
end;
$$;

commit;

-- Return all active campaign codes. Store this result securely.
select
  p.code as programme_code,
  p.name as programme_name,
  c.discount_value as discount_percent,
  c.code,
  c.starts_at,
  c.expires_at,
  c.per_candidate_limit,
  c.is_active,
  25000.00 as list_fee_ngn,
  case
    when c.discount_value = 88 then 3000.00
    when c.discount_value = 100 then 0.00
  end as payable_after_discount_ngn,
  case
    when c.discount_value = 100 then 'Unlocks without Paystack after coupon validation'
    else 'Candidate completes Paystack payment of NGN 3,000'
  end as effect
from public.coupons c
join public.programmes p on p.id = c.programme_id
where p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
  and c.scope = 'programme'
  and c.discount_type = 'percentage'
  and c.discount_value in (88, 100)
  and c.is_active = true
  and c.starts_at <= now()
  and c.expires_at > now()
  and (
    upper(c.code) like 'IIPM-' || p.code || '-ACCESS88-%'
    or upper(c.code) like 'IIPM-' || p.code || '-SCHOLAR100-%'
  )
order by p.code, c.discount_value, c.code;
