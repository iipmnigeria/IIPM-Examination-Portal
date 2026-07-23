begin;

alter table public.agilecert_automation_jobs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz;

create unique index if not exists agilecert_automation_provider_message_idx
  on public.agilecert_automation_jobs(provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.agilecert_email_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  candidate_id uuid references auth.users(id) on delete set null,
  automation_job_id uuid references public.agilecert_automation_jobs(id) on delete set null,
  recipient_email text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (provider, provider_event_id)
);

create index if not exists agilecert_email_event_message_idx
  on public.agilecert_email_events(provider, provider_message_id, occurred_at desc);

alter table public.agilecert_email_events enable row level security;

-- No browser-facing policies are intentionally created. Only trusted server
-- processes may read or write provider event records.

create or replace function public.claim_due_agilecert_automation_jobs(
  p_limit integer default 25,
  p_worker_id text default null
)
returns setof public.agilecert_automation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  -- Recover jobs abandoned by an interrupted worker. Five total attempts are
  -- permitted before the job remains failed for operational review.
  update public.agilecert_automation_jobs
  set
    status = case when attempt_count >= 5 then 'failed' else 'pending' end,
    scheduled_for = case
      when attempt_count >= 5 then scheduled_for
      else now() + make_interval(mins => greatest(5, attempt_count * 10))
    end,
    last_error = coalesce(last_error, 'Recovered from stale processing state.'),
    processing_started_at = null,
    updated_at = now()
  where status = 'processing'
    and processing_started_at < now() - interval '20 minutes';

  return query
  with due as (
    select j.id
    from public.agilecert_automation_jobs j
    where j.status = 'pending'
      and j.scheduled_for <= now()
      and j.attempt_count < 5
      and j.job_type <> 'credential_generate_assets'
    order by j.scheduled_for, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.agilecert_automation_jobs j
  set
    status = 'processing',
    attempt_count = j.attempt_count + 1,
    processing_started_at = now(),
    last_error = null,
    payload = coalesce(j.payload, '{}'::jsonb) || jsonb_build_object(
      'workerId', coalesce(nullif(trim(p_worker_id), ''), 'unspecified'),
      'claimedAt', now()
    ),
    updated_at = now()
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_due_agilecert_automation_jobs(integer, text) from public;
grant execute on function public.claim_due_agilecert_automation_jobs(integer, text) to service_role;

create or replace function public.finish_agilecert_automation_job(
  p_job_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_provider_status text default null,
  p_last_error text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.agilecert_automation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.agilecert_automation_jobs;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  if p_status not in ('sent', 'failed', 'cancelled', 'suppressed', 'pending') then
    raise exception 'Unsupported automation completion status %.', p_status;
  end if;

  update public.agilecert_automation_jobs
  set
    status = p_status,
    provider = coalesce(nullif(trim(p_provider), ''), provider),
    provider_message_id = coalesce(nullif(trim(p_provider_message_id), ''), provider_message_id),
    provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
    last_error = nullif(trim(p_last_error), ''),
    sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
    scheduled_for = case
      when p_status = 'pending' then now() + make_interval(mins => greatest(5, attempt_count * 10))
      else scheduled_for
    end,
    processing_started_at = null,
    payload = coalesce(payload, '{}'::jsonb) || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where id = p_job_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Automation job % was not found.', p_job_id;
  end if;

  return v_job;
end;
$$;

revoke all on function public.finish_agilecert_automation_job(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.finish_agilecert_automation_job(uuid, text, text, text, text, text, jsonb) to service_role;

create or replace function public.record_agilecert_email_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_recipient_email text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns public.agilecert_email_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.agilecert_automation_jobs;
  v_event public.agilecert_email_events;
  v_event_status text := lower(trim(p_event_type));
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  select * into v_job
  from public.agilecert_automation_jobs
  where provider = lower(trim(p_provider))
    and provider_message_id = nullif(trim(p_provider_message_id), '')
  limit 1;

  insert into public.agilecert_email_events (
    provider,
    provider_event_id,
    provider_message_id,
    event_type,
    candidate_id,
    automation_job_id,
    recipient_email,
    occurred_at,
    payload
  ) values (
    lower(trim(p_provider)),
    trim(p_provider_event_id),
    nullif(trim(p_provider_message_id), ''),
    v_event_status,
    v_job.candidate_id,
    v_job.id,
    lower(nullif(trim(p_recipient_email), '')),
    p_occurred_at,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do update
  set
    payload = excluded.payload,
    received_at = now()
  returning * into v_event;

  if v_job.id is not null then
    update public.agilecert_automation_jobs
    set
      provider_status = v_event_status,
      delivered_at = case when v_event_status = 'email.delivered' then coalesce(delivered_at, p_occurred_at, now()) else delivered_at end,
      bounced_at = case when v_event_status = 'email.bounced' then coalesce(bounced_at, p_occurred_at, now()) else bounced_at end,
      complained_at = case when v_event_status = 'email.complained' then coalesce(complained_at, p_occurred_at, now()) else complained_at end,
      opened_at = case when v_event_status = 'email.opened' then coalesce(opened_at, p_occurred_at, now()) else opened_at end,
      clicked_at = case when v_event_status = 'email.clicked' then coalesce(clicked_at, p_occurred_at, now()) else clicked_at end,
      updated_at = now()
    where id = v_job.id;

    if v_event_status in ('email.bounced', 'email.complained', 'email.suppressed', 'email.failed') then
      update public.agilecert_candidate_profiles
      set
        certificate_email_updates = false,
        course_recommendation_emails = false,
        marketing_consent = false,
        updated_at = now()
      where user_id = v_job.candidate_id;

      update public.agilecert_automation_jobs
      set
        status = 'suppressed',
        last_error = 'Email communication suppressed after provider event ' || v_event_status,
        updated_at = now()
      where candidate_id = v_job.candidate_id
        and status = 'pending'
        and job_type in (
          'certificate_offer_immediate',
          'certificate_reminder_day_2',
          'certificate_reminder_day_5',
          'certificate_reminder_day_7',
          'certificate_standard_price_offer',
          'certificate_standard_price_reminder',
          'course_cross_sell'
        );
    end if;
  end if;

  return v_event;
end;
$$;

revoke all on function public.record_agilecert_email_event(text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.record_agilecert_email_event(text, text, text, text, text, timestamptz, jsonb) to service_role;

comment on function public.claim_due_agilecert_automation_jobs(integer, text) is
  'Atomically claims due AgileCert communication jobs with SKIP LOCKED and stale-worker recovery.';
comment on function public.finish_agilecert_automation_job(uuid, text, text, text, text, text, jsonb) is
  'Completes, retries, suppresses or cancels an AgileCert automation job and stores provider metadata.';
comment on function public.record_agilecert_email_event(text, text, text, text, text, timestamptz, jsonb) is
  'Records verified email-provider events and suppresses future communication after hard failure or complaint.';

commit;
