-- Read-only verification for migration 202607220014_ai_studio_course_catalogue.sql
with expected(programme_code, expected_questions) as (
  values
    ('AIML', 5),
    ('CYBER', 5),
    ('SWEETH', 5),
    ('HRMFC', 5),
    ('CHRMG', 50),
    ('CHRMP', 75),
    ('PM', 50),
    ('PCIT', 75),
    ('RMP', 75),
    ('QMP', 75),
    ('PCM', 75)
), actual as (
  select
    p.code as programme_code,
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
    ) as ngn_amount_minor
  from public.programmes p
  join public.examinations e on e.programme_id = p.id
  left join public.questions q on q.examination_id = e.id
  left join public.exam_prices ep on ep.examination_id = e.id
  where p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
  group by p.code, e.id, e.title, e.status, e.requires_payment, e.allow_self_enrollment
)
select
  expected.programme_code,
  actual.title,
  expected.expected_questions,
  coalesce(actual.active_questions, 0) as active_questions,
  coalesce(actual.ngn_amount_minor, 0) / 100.0 as fee_ngn,
  actual.status,
  actual.requires_payment,
  actual.allow_self_enrollment,
  case
    when actual.examination_id is null then 'FAIL: examination missing'
    when actual.active_questions <> expected.expected_questions then 'FAIL: question count'
    when actual.ngn_amount_minor <> 2500000 then 'FAIL: fee'
    when actual.status <> 'published' then 'FAIL: not published'
    when actual.requires_payment is not true then 'FAIL: payment disabled'
    when actual.allow_self_enrollment is not false then 'FAIL: launch not payment-gated'
    else 'PASS'
  end as verification_status
from expected
left join actual using (programme_code)
order by expected.programme_code;
