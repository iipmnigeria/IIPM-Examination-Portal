begin;

-- Schedule certificate sales communications only for candidates whose passing
-- result is both eligible and integrity-cleared. The same function also handles
-- a later staff review that changes a blocked result into a cleared result.
create or replace function public.agilecert_schedule_certificate_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_updates boolean := true;
  v_early_active boolean;
  v_standard_reminder_at timestamptz;
begin
  select coalesce(p.certificate_email_updates, true)
  into v_email_updates
  from public.agilecert_candidate_profiles p
  where p.user_id = new.candidate_id;

  v_email_updates := coalesce(v_email_updates, true);

  -- Blocked, revoked, flagged or rejected results must never receive a
  -- certificate sales sequence. Cancel any jobs that may have been created by
  -- an earlier version of the trigger.
  if new.eligibility_status <> 'eligible'
     or new.integrity_status <> 'cleared'
     or not v_email_updates then
    update public.agilecert_automation_jobs
    set
      status = case when v_email_updates then 'cancelled' else 'suppressed' end,
      updated_at = now(),
      payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
        'stoppedReason', case
          when not v_email_updates then 'candidate_email_preference'
          else 'eligibility_not_cleared'
        end
      )
    where eligibility_id = new.id
      and status = 'pending'
      and job_type like 'certificate_%';

    return new;
  end if;

  v_early_active := now() <= new.early_price_expires_at;
  v_standard_reminder_at := greatest(new.passed_at + interval '14 days', now() + interval '1 day');

  -- Immediate notification is sent at clearance time so a delayed integrity
  -- review does not leave the candidate unaware of the certificate offer.
  insert into public.agilecert_automation_jobs (
    candidate_id,
    eligibility_id,
    job_type,
    scheduled_for,
    payload
  )
  values (
    new.candidate_id,
    new.id,
    case when v_early_active
      then 'certificate_offer_immediate'
      else 'certificate_standard_price_offer'
    end,
    now(),
    jsonb_build_object(
      'source', 'eligibility_created',
      'stage', case when v_early_active then 'immediate' else 'standard_price' end,
      'earlyPriceExpiresAt', new.early_price_expires_at
    )
  )
  on conflict do nothing;

  if v_early_active then
    if new.passed_at + interval '2 days' > now() then
      insert into public.agilecert_automation_jobs (
        candidate_id, eligibility_id, job_type, scheduled_for, payload
      ) values (
        new.candidate_id,
        new.id,
        'certificate_reminder_day_2',
        new.passed_at + interval '2 days',
        jsonb_build_object(
          'source', 'eligibility_created',
          'stage', 'day_2',
          'earlyPriceExpiresAt', new.early_price_expires_at
        )
      ) on conflict do nothing;
    end if;

    if new.passed_at + interval '5 days' > now() then
      insert into public.agilecert_automation_jobs (
        candidate_id, eligibility_id, job_type, scheduled_for, payload
      ) values (
        new.candidate_id,
        new.id,
        'certificate_reminder_day_5',
        new.passed_at + interval '5 days',
        jsonb_build_object(
          'source', 'eligibility_created',
          'stage', 'day_5',
          'earlyPriceExpiresAt', new.early_price_expires_at
        )
      ) on conflict do nothing;
    end if;

    if new.early_price_expires_at > now() then
      insert into public.agilecert_automation_jobs (
        candidate_id, eligibility_id, job_type, scheduled_for, payload
      ) values (
        new.candidate_id,
        new.id,
        'certificate_reminder_day_7',
        new.early_price_expires_at,
        jsonb_build_object(
          'source', 'eligibility_created',
          'stage', 'final_day',
          'earlyPriceExpiresAt', new.early_price_expires_at
        )
      ) on conflict do nothing;
    end if;
  end if;

  insert into public.agilecert_automation_jobs (
    candidate_id,
    eligibility_id,
    job_type,
    scheduled_for,
    payload
  )
  values (
    new.candidate_id,
    new.id,
    'certificate_standard_price_reminder',
    v_standard_reminder_at,
    jsonb_build_object(
      'source', 'eligibility_created',
      'stage', 'standard_price'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Re-run the scheduler when a staff review changes integrity or eligibility.
drop trigger if exists agilecert_schedule_certificate_followups_trigger
  on public.agilecert_certificate_eligibilities;
create trigger agilecert_schedule_certificate_followups_trigger
  after insert or update of eligibility_status, integrity_status
  on public.agilecert_certificate_eligibilities
  for each row
  execute function public.agilecert_schedule_certificate_followups();

-- Clean up jobs created by the original insert-only trigger for results that
-- are not currently eligible and cleared.
update public.agilecert_automation_jobs j
set
  status = 'cancelled',
  updated_at = now(),
  payload = coalesce(j.payload, '{}'::jsonb) || jsonb_build_object(
    'stoppedReason', 'eligibility_not_cleared'
  )
from public.agilecert_certificate_eligibilities e
where j.eligibility_id = e.id
  and j.status = 'pending'
  and j.job_type like 'certificate_%'
  and (
    e.eligibility_status <> 'eligible'
    or e.integrity_status <> 'cleared'
  );

-- Respect candidates who have disabled certificate email updates.
update public.agilecert_automation_jobs j
set
  status = 'suppressed',
  updated_at = now(),
  payload = coalesce(j.payload, '{}'::jsonb) || jsonb_build_object(
    'stoppedReason', 'candidate_email_preference'
  )
from public.agilecert_candidate_profiles p
where p.user_id = j.candidate_id
  and not p.certificate_email_updates
  and j.status = 'pending'
  and j.job_type like 'certificate_%';

comment on function public.agilecert_schedule_certificate_followups() is
  'Schedules certificate conversion communications only for integrity-cleared eligible results and honours candidate email settings.';

commit;
