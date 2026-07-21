-- IIPM Examination Portal — Phase 5 production-readiness verification
-- Read-only: this script does not modify database records.

-- 1. Required commerce tables.
select
  'required_commerce_tables' as check_name,
  case when count(*) = 5 then 'PASS' else 'FAIL' end as result,
  count(*) as actual,
  5 as expected
from (
  values
    (to_regclass('public.exam_prices')),
    (to_regclass('public.coupons')),
    (to_regclass('public.exam_orders')),
    (to_regclass('public.exam_payments')),
    (to_regclass('public.coupon_redemptions'))
) required(table_name)
where table_name is not null;

-- 2. Required secured functions.
with required(signature) as (
  values
    ('public.get_available_exams()'),
    ('public.start_exam_secure(uuid,jsonb)'),
    ('public.quote_exam_purchase(uuid,text,text)'),
    ('public.create_exam_order(uuid,text,text)'),
    ('public.fulfil_paid_exam_order(uuid,text,jsonb)'),
    ('public.get_admin_commerce_snapshot(integer)'),
    ('public.admin_upsert_exam_price(uuid,text,bigint,text[],boolean,boolean,timestamp with time zone,timestamp with time zone)'),
    ('public.admin_upsert_coupon(uuid,text,text,text,text,numeric,text,text,uuid,uuid,bigint,bigint,timestamp with time zone,timestamp with time zone,integer,integer,boolean)'),
    ('public.admin_set_coupon_active(uuid,boolean)'),
    ('public.admin_set_exam_price_active(uuid,boolean)'),
    ('public.admin_cancel_exam_order(uuid,text)')
)
select
  'required_secured_functions' as check_name,
  case when count(to_regprocedure(signature)) = count(*) then 'PASS' else 'FAIL' end as result,
  count(to_regprocedure(signature)) as actual,
  count(*) as expected
from required;

-- 3. Row Level Security status.
select
  'commerce_rls_enabled' as check_name,
  case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end as result,
  count(*) filter (where c.relrowsecurity) as enabled_tables,
  count(*) as expected_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'exam_prices', 'coupons', 'exam_orders', 'exam_payments', 'coupon_redemptions'
  );

-- 4. Published examinations missing their standard active NGN price.
select
  'published_exams_with_ngn_25000' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as missing_or_incorrect
from public.examinations e
where e.status = 'published'
  and not exists (
    select 1
    from public.exam_prices ep
    where ep.examination_id = e.id
      and ep.currency = 'NGN'
      and ep.amount_minor = 2500000
      and ep.is_active = true
      and ep.effective_from <= now()
      and (ep.effective_to is null or ep.effective_to > now())
  );

-- Detail: examinations that fail the NGN price requirement.
select
  p.code as course,
  e.title,
  ep.currency,
  ep.amount_minor,
  ep.is_active,
  ep.is_default
from public.examinations e
join public.programmes p on p.id = e.programme_id
left join public.exam_prices ep
  on ep.examination_id = e.id and ep.currency = 'NGN'
where e.status = 'published'
  and (
    ep.id is null
    or ep.amount_minor <> 2500000
    or ep.is_active = false
    or ep.effective_from > now()
    or (ep.effective_to is not null and ep.effective_to <= now())
  )
order by p.code;

-- 5. Exactly one active default price per published examination.
select
  'one_active_default_price_per_exam' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as invalid_examinations
from (
  select e.id
  from public.examinations e
  left join public.exam_prices ep
    on ep.examination_id = e.id
   and ep.is_default = true
   and ep.is_active = true
  where e.status = 'published'
  group by e.id
  having count(ep.id) <> 1
) invalid;

-- 6. Successful payment rows must match their orders.
select
  'successful_payments_match_orders' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as mismatches
from public.exam_payments pay
join public.exam_orders ord on ord.id = pay.order_id
where pay.status = 'success'
  and (
    pay.amount_minor <> ord.payable_amount_minor
    or upper(pay.currency) <> upper(ord.currency)
    or pay.reference <> ord.reference
  );

-- 7. Paid or waived fulfilled orders must have active examination access.
select
  'fulfilled_orders_have_assignment' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as missing_assignments
from public.exam_orders ord
left join public.exam_assignments ea
  on ea.examination_id = ord.examination_id
 and ea.candidate_id = ord.candidate_id
where ord.status in ('paid', 'waived')
  and ord.fulfilled_at is not null
  and ea.id is null;

-- 8. Coupon redemption consistency.
select
  'coupon_redemptions_match_orders' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as inconsistent_redemptions
from public.coupon_redemptions cr
join public.exam_orders ord on ord.id = cr.order_id
where
  (cr.status = 'redeemed' and ord.status not in ('paid', 'waived'))
  or (cr.status = 'reserved' and ord.status <> 'pending')
  or (cr.status = 'released' and ord.status = 'pending');

-- 9. Pending orders that have already expired but are not marked expired.
select
  'stale_pending_orders' as check_name,
  case when count(*) = 0 then 'PASS' else 'WARNING' end as result,
  count(*) as stale_orders
from public.exam_orders
where status = 'pending' and expires_at <= now();

-- 10. Summary for review.
select
  (select count(*) from public.examinations where status = 'published') as published_examinations,
  (select count(*) from public.exam_prices where is_active = true) as active_prices,
  (select count(*) from public.coupons where is_active = true) as active_coupons,
  (select count(*) from public.exam_orders where status = 'pending') as pending_orders,
  (select count(*) from public.exam_orders where status = 'paid') as paid_orders,
  (select count(*) from public.exam_orders where status = 'waived') as waived_orders,
  (select count(*) from public.exam_payments where status = 'success') as successful_payments;
