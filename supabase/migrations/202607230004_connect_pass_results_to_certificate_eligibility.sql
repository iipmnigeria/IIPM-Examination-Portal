begin;

-- Create and maintain AgileCert certificate eligibility exclusively from the
-- authoritative examination-attempt record. Browser code cannot call this
-- trigger function or manufacture a passing timestamp.
create or replace function public.sync_agilecert_certificate_eligibility_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.examinations%rowtype;
  v_programme_code text;
  v_window_days integer := 7;
  v_integrity_status text;
  v_eligibility_status text;
begin
  select *
  into v_exam
  from public.examinations
  where id = new.examination_id;

  if not found then
    raise exception 'The examination linked to attempt % was not found.', new.id;
  end if;

  select p.code
  into v_programme_code
  from public.programmes p
  where p.id = v_exam.programme_id;

  select coalesce(s.early_price_window_days, 7)
  into v_window_days
  from public.agilecert_platform_settings s
  where s.singleton;

  v_window_days := coalesce(v_window_days, 7);

  -- A result that no longer meets the pass mark cannot retain an active
  -- certificate entitlement. Keep the record for audit but revoke the offer.
  if new.percentage < v_exam.pass_mark then
    update public.agilecert_certificate_eligibilities
    set
      eligibility_status = 'revoked',
      integrity_status = case
        when new.status = 'terminated' then 'rejected'
        when new.status = 'flagged' or new.suspicious_score >= 50 then 'flagged'
        else integrity_status
      end,
      source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object(
        'resultStatus', new.status,
        'suspiciousScore', new.suspicious_score,
        'revokedReason', 'result_below_pass_mark',
        'syncedAt', now()
      ),
      updated_at = now()
    where attempt_id = new.id
      and eligibility_status <> 'revoked';

    return new;
  end if;

  v_integrity_status := case
    when new.status = 'terminated' then 'rejected'
    when new.status = 'flagged' or new.suspicious_score >= 50 then 'flagged'
    when new.status in ('submitted', 'reviewed') then 'cleared'
    else 'pending'
  end;

  v_eligibility_status := case
    when v_integrity_status = 'cleared' then 'eligible'
    else 'blocked'
  end;

  insert into public.agilecert_certificate_eligibilities (
    candidate_id,
    examination_id,
    attempt_id,
    examination_title,
    programme_code,
    score,
    pass_mark,
    passed_at,
    early_price_expires_at,
    integrity_status,
    eligibility_status,
    source_metadata
  )
  values (
    new.candidate_id,
    new.examination_id,
    new.id,
    v_exam.title,
    v_programme_code,
    new.percentage,
    v_exam.pass_mark,
    new.submitted_at,
    new.submitted_at + make_interval(days => v_window_days),
    v_integrity_status,
    v_eligibility_status,
    jsonb_build_object(
      'source', 'attempts_trigger',
      'sessionId', new.session_id,
      'resultStatus', new.status,
      'suspiciousScore', new.suspicious_score,
      'gradedAt', new.graded_at,
      'syncedAt', now()
    )
  )
  on conflict (attempt_id) do update
  set
    candidate_id = excluded.candidate_id,
    examination_id = excluded.examination_id,
    examination_title = excluded.examination_title,
    programme_code = excluded.programme_code,
    score = excluded.score,
    pass_mark = excluded.pass_mark,
    passed_at = excluded.passed_at,
    early_price_expires_at = excluded.early_price_expires_at,
    integrity_status = excluded.integrity_status,
    eligibility_status = excluded.eligibility_status,
    source_metadata = excluded.source_metadata,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_agilecert_certificate_eligibility_from_attempt() from public;

-- Re-evaluate eligibility whenever the authoritative grade, review status,
-- suspicious score or completion time changes.
drop trigger if exists agilecert_sync_certificate_eligibility_trigger on public.attempts;
create trigger agilecert_sync_certificate_eligibility_trigger
  after insert or update of percentage, status, suspicious_score, submitted_at
  on public.attempts
  for each row
  execute function public.sync_agilecert_certificate_eligibility_from_attempt();

-- Backfill already-completed passing attempts so current candidates can see
-- their certificate options. The eligibility-insert trigger in the foundation
-- schedules follow-ups automatically.
insert into public.agilecert_certificate_eligibilities (
  candidate_id,
  examination_id,
  attempt_id,
  examination_title,
  programme_code,
  score,
  pass_mark,
  passed_at,
  early_price_expires_at,
  integrity_status,
  eligibility_status,
  source_metadata
)
select
  a.candidate_id,
  a.examination_id,
  a.id,
  e.title,
  p.code,
  a.percentage,
  e.pass_mark,
  a.submitted_at,
  a.submitted_at + make_interval(days => coalesce(s.early_price_window_days, 7)),
  case
    when a.status = 'terminated' then 'rejected'
    when a.status = 'flagged' or a.suspicious_score >= 50 then 'flagged'
    when a.status in ('submitted', 'reviewed') then 'cleared'
    else 'pending'
  end,
  case
    when a.status in ('submitted', 'reviewed') and a.suspicious_score < 50 then 'eligible'
    else 'blocked'
  end,
  jsonb_build_object(
    'source', 'migration_backfill',
    'sessionId', a.session_id,
    'resultStatus', a.status,
    'suspiciousScore', a.suspicious_score,
    'gradedAt', a.graded_at,
    'syncedAt', now()
  )
from public.attempts a
join public.examinations e on e.id = a.examination_id
join public.programmes p on p.id = e.programme_id
cross join public.agilecert_platform_settings s
where s.singleton
  and a.percentage >= e.pass_mark
on conflict (attempt_id) do update
set
  examination_title = excluded.examination_title,
  programme_code = excluded.programme_code,
  score = excluded.score,
  pass_mark = excluded.pass_mark,
  passed_at = excluded.passed_at,
  early_price_expires_at = excluded.early_price_expires_at,
  integrity_status = excluded.integrity_status,
  eligibility_status = excluded.eligibility_status,
  source_metadata = excluded.source_metadata,
  updated_at = now();

-- Avoid sending a burst of expired early-price reminders when legacy passes
-- are backfilled. Their standard-price offer remains available in the portal.
update public.agilecert_automation_jobs j
set
  status = 'cancelled',
  updated_at = now(),
  payload = coalesce(j.payload, '{}'::jsonb) || jsonb_build_object(
    'cancelledReason', 'historic_backfill_outside_early_window'
  )
from public.agilecert_certificate_eligibilities e
where j.eligibility_id = e.id
  and e.early_price_expires_at <= now()
  and j.status = 'pending'
  and j.job_type like 'certificate_%';

comment on function public.sync_agilecert_certificate_eligibility_from_attempt() is
  'Creates, updates, blocks or revokes AgileCert certificate eligibility from authoritative examination results.';

commit;