-- Run manually in Supabase SQL Editor after migration 202607220015.
-- Actual coupon codes are generated inside Supabase and are therefore not exposed
-- in this public repository. One 88% code and one 100% code are created per programme.
-- Codes start INACTIVE for security. Activate only selected programmes after setting
-- appropriate redemption limits and expiry dates in the Commerce Console.

with programme_targets as (
  select id, code, name
  from public.programmes
  where code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
), discount_levels as (
  select 88::numeric as discount_value, 'ACCESS88'::text as code_label, '88% Access Discount'::text as offer_name
  union all
  select 100::numeric, 'SCHOLAR100'::text, '100% Scholarship'
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
    '%s for %s. Valid once per candidate and restricted to NGN examination purchases for this programme.',
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
  null,
  null,
  null,
  1,
  false
from desired
where not exists (
  select 1
  from public.coupons existing
  where existing.name = desired.coupon_name
    and existing.programme_id = desired.programme_id
    and existing.discount_type = 'percentage'
    and existing.discount_value = desired.discount_value
);

-- Return the generated codes. Copy this result into a secure internal record.
select
  p.code as programme_code,
  p.name as programme_name,
  c.discount_value as discount_percent,
  c.code,
  c.is_active,
  c.starts_at,
  c.expires_at,
  c.maximum_redemptions,
  c.per_candidate_limit,
  case
    when c.discount_value = 100 then 'After activation: unlocks without Paystack after validation'
    when c.discount_value = 88 then 'After activation: candidate pays 12% of the configured fee'
    else 'Percentage discount'
  end as effect
from public.coupons c
join public.programmes p on p.id = c.programme_id
where c.name like 'IIPM 2026 %'
  and p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
order by p.code, c.discount_value;
