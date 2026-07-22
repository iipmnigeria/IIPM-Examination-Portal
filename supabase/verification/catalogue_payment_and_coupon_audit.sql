-- Read-only audit for fees, Pay & Unlock and programme coupon coverage.
with target_programmes as (
  select id, code, name
  from public.programmes
  where code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
), exam_audit as (
  select
    p.code as programme_code,
    p.name as programme_name,
    e.id as examination_id,
    e.title,
    e.status,
    e.requires_payment,
    e.allow_self_enrollment,
    count(q.id) filter (where q.is_active = true)::integer as active_questions,
    max(ep.amount_minor) filter (
      where ep.currency = 'NGN'
        and ep.is_default = true
        and ep.is_active = true
    ) as ngn_amount_minor,
    count(*) over (partition by p.code) as published_records_for_code
  from target_programmes p
  join public.examinations e on e.programme_id = p.id and e.status = 'published'
  left join public.questions q on q.examination_id = e.id
  left join public.exam_prices ep on ep.examination_id = e.id
  group by p.code, p.name, e.id, e.title, e.status, e.requires_payment, e.allow_self_enrollment
), coupon_audit as (
  select
    p.code as programme_code,
    count(*) filter (where c.discount_value = 88 and c.is_active = true) as active_88_codes,
    count(*) filter (where c.discount_value = 100 and c.is_active = true) as active_100_codes
  from target_programmes p
  left join public.coupons c
    on c.programme_id = p.id
   and c.scope = 'programme'
   and c.discount_type = 'percentage'
  group by p.code
)
select
  e.programme_code,
  e.programme_name,
  e.examination_id,
  e.title,
  e.active_questions,
  coalesce(e.ngn_amount_minor, 0) / 100.0 as fee_ngn,
  e.requires_payment,
  e.allow_self_enrollment,
  e.published_records_for_code,
  coalesce(c.active_88_codes, 0) as active_88_codes,
  coalesce(c.active_100_codes, 0) as active_100_codes,
  case
    when e.ngn_amount_minor is null then 'FAIL: fee missing'
    when e.ngn_amount_minor <> 2500000 then 'FAIL: incorrect fee'
    when e.requires_payment is not true then 'FAIL: Pay & Unlock disabled'
    when e.allow_self_enrollment is not false then 'FAIL: direct launch enabled'
    when e.published_records_for_code > 1 then 'REVIEW: duplicate published examinations'
    else 'PASS'
  end as payment_configuration_status
from exam_audit e
left join coupon_audit c using (programme_code)
order by e.programme_code, e.title;

-- Candidate assignments are intentionally separate from fee configuration.
-- A candidate with an active assignment sees "Unlocked" rather than "Pay & Unlock".
select
  p.email as candidate_email,
  pr.code as programme_code,
  e.title,
  ea.status as assignment_status,
  ea.available_from,
  ea.expires_at
from public.exam_assignments ea
join public.profiles p on p.id = ea.candidate_id
join public.examinations e on e.id = ea.examination_id
join public.programmes pr on pr.id = e.programme_id
where pr.code in (
  'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
  'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
)
  and ea.status = 'assigned'
  and (ea.available_from is null or ea.available_from <= now())
  and (ea.expires_at is null or ea.expires_at > now())
order by p.email, pr.code;
