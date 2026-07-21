-- IIPM Examination Portal — Phase 1 commerce verification
-- This script is read-only. Run it after migrations 009 and 010.

select
  to_regclass('public.exam_prices') as exam_prices,
  to_regclass('public.coupons') as coupons,
  to_regclass('public.exam_orders') as exam_orders,
  to_regclass('public.exam_payments') as exam_payments,
  to_regclass('public.coupon_redemptions') as coupon_redemptions;

select
  p.code,
  e.title,
  e.requires_payment,
  e.allow_self_enrollment,
  ep.currency,
  ep.amount_minor,
  ep.amount_minor / 100.0 as display_amount,
  ep.is_default,
  ep.is_active
from public.examinations e
join public.programmes p on p.id = e.programme_id
left join public.exam_prices ep on ep.examination_id = e.id
where e.status = 'published'
order by p.code, ep.currency;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_available_exams',
    'start_exam_secure',
    'quote_exam_purchase',
    'create_exam_order',
    'fulfil_paid_exam_order'
  )
order by p.proname;
