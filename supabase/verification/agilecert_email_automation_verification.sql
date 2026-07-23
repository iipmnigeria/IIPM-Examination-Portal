-- AgileCert Global email automation verification
-- Run after migrations 202607230001 through 202607230009.
-- Read-only.

with checks as (
  select
    'automation claim function exists'::text as check_name,
    case when to_regprocedure('public.claim_due_agilecert_automation_jobs(integer,text)') is not null
      then 'PASS' else 'FAIL' end as result

  union all

  select
    'automation finish function exists',
    case when to_regprocedure('public.finish_agilecert_automation_job(uuid,text,text,text,text,text,jsonb)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'email event function exists',
    case when to_regprocedure('public.record_agilecert_email_event(text,text,text,text,text,timestamptz,jsonb)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'email event table uses RLS',
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'agilecert_email_events'
        and c.relrowsecurity
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'no pending certificate reminders after purchase',
    case when not exists (
      select 1
      from public.agilecert_automation_jobs j
      join public.agilecert_certificate_orders o
        on o.eligibility_id = j.eligibility_id
       and o.status in ('paid', 'waived')
      where j.status = 'pending'
        and j.job_type in (
          'certificate_offer_immediate',
          'certificate_reminder_day_2',
          'certificate_reminder_day_5',
          'certificate_reminder_day_7',
          'certificate_standard_price_offer',
          'certificate_standard_price_reminder'
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'no pending reminders for blocked eligibility',
    case when not exists (
      select 1
      from public.agilecert_automation_jobs j
      join public.agilecert_certificate_eligibilities e on e.id = j.eligibility_id
      where j.status = 'pending'
        and j.job_type like 'certificate_%'
        and (
          e.eligibility_status <> 'eligible'
          or e.integrity_status <> 'cleared'
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'active generated credentials have delivery job',
    case when not exists (
      select 1
      from public.agilecert_credentials c
      left join public.agilecert_automation_jobs j
        on j.certificate_order_id = c.certificate_order_id
       and j.job_type = 'credential_delivery_email'
      where c.status = 'active'
        and c.certificate_storage_path is not null
        and j.id is null
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'provider message identifiers are unique',
    case when not exists (
      select provider, provider_message_id
      from public.agilecert_automation_jobs
      where provider_message_id is not null
      group by provider, provider_message_id
      having count(*) > 1
    ) then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

select
  job_type,
  status,
  provider,
  provider_status,
  count(*) as total,
  min(scheduled_for) as earliest_scheduled,
  max(scheduled_for) as latest_scheduled
from public.agilecert_automation_jobs
group by job_type, status, provider, provider_status
order by job_type, status;
