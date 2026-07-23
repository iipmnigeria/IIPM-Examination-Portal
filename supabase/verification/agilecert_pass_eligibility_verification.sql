-- AgileCert Global pass-to-certificate eligibility verification
-- Run after migrations 202607230001, 202607230002 and 202607230003.
-- This script is read-only.

with checks as (
  select
    'attempt eligibility sync function exists'::text as check_name,
    case when to_regprocedure(
      'public.sync_agilecert_certificate_eligibility_from_attempt()'
    ) is not null then 'PASS' else 'FAIL' end as result

  union all

  select
    'attempt eligibility trigger exists',
    case when exists (
      select 1
      from pg_trigger
      where tgname = 'agilecert_sync_certificate_eligibility_trigger'
        and not tgisinternal
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'no below-pass attempt has active eligibility',
    case when not exists (
      select 1
      from public.agilecert_certificate_eligibilities ce
      join public.attempts a on a.id = ce.attempt_id
      join public.examinations e on e.id = a.examination_id
      where a.percentage < e.pass_mark
        and ce.eligibility_status <> 'revoked'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'all eligible records meet pass mark',
    case when not exists (
      select 1
      from public.agilecert_certificate_eligibilities
      where eligibility_status = 'eligible'
        and score < pass_mark
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'clean passing attempts are eligible',
    case when not exists (
      select 1
      from public.attempts a
      join public.examinations e on e.id = a.examination_id
      left join public.agilecert_certificate_eligibilities ce on ce.attempt_id = a.id
      where a.percentage >= e.pass_mark
        and a.status in ('submitted', 'reviewed')
        and a.suspicious_score < 50
        and (
          ce.id is null
          or ce.integrity_status <> 'cleared'
          or ce.eligibility_status <> 'eligible'
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'flagged passing attempts are blocked',
    case when not exists (
      select 1
      from public.attempts a
      join public.examinations e on e.id = a.examination_id
      left join public.agilecert_certificate_eligibilities ce on ce.attempt_id = a.id
      where a.percentage >= e.pass_mark
        and (a.status = 'flagged' or a.suspicious_score >= 50)
        and (
          ce.id is null
          or ce.integrity_status <> 'flagged'
          or ce.eligibility_status <> 'blocked'
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'terminated passing attempts are rejected',
    case when not exists (
      select 1
      from public.attempts a
      join public.examinations e on e.id = a.examination_id
      left join public.agilecert_certificate_eligibilities ce on ce.attempt_id = a.id
      where a.percentage >= e.pass_mark
        and a.status = 'terminated'
        and (
          ce.id is null
          or ce.integrity_status <> 'rejected'
          or ce.eligibility_status <> 'blocked'
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'server passing timestamp is preserved',
    case when not exists (
      select 1
      from public.agilecert_certificate_eligibilities ce
      join public.attempts a on a.id = ce.attempt_id
      where ce.passed_at is distinct from a.submitted_at
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'early window matches platform setting',
    case when not exists (
      select 1
      from public.agilecert_certificate_eligibilities ce
      cross join public.agilecert_platform_settings s
      where s.singleton
        and ce.early_price_expires_at is distinct from
          ce.passed_at + make_interval(days => s.early_price_window_days)
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'historic expired reminders are cancelled',
    case when not exists (
      select 1
      from public.agilecert_automation_jobs j
      join public.agilecert_certificate_eligibilities ce on ce.id = j.eligibility_id
      where ce.early_price_expires_at <= now()
        and j.job_type like 'certificate_%'
        and j.status = 'pending'
        and coalesce(j.payload ->> 'source', '') = 'eligibility_created'
    ) then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

-- Diagnostic: recent pass and eligibility records.
select
  a.id as attempt_id,
  p.code as programme_code,
  e.title as examination_title,
  a.percentage,
  e.pass_mark,
  a.status as attempt_status,
  a.suspicious_score,
  ce.id as eligibility_id,
  ce.integrity_status,
  ce.eligibility_status,
  ce.passed_at,
  ce.early_price_expires_at
from public.attempts a
join public.examinations e on e.id = a.examination_id
join public.programmes p on p.id = e.programme_id
left join public.agilecert_certificate_eligibilities ce on ce.attempt_id = a.id
order by a.submitted_at desc
limit 50;
