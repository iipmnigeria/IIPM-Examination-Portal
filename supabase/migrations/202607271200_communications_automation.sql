begin;

-- Communications are derived from authoritative examination, payment,
-- certificate and credential state. These records are never rewritten here.

create table if not exists public.agilecert_communication_settings (
  singleton boolean primary key default true check (singleton),
  provider text not null default 'resend' check (provider = 'resend'),
  provider_enabled boolean not null default false,
  from_name text not null default 'AgileCert Global',
  from_email text,
  reply_to_email text,
  portal_url text not null default 'https://iipmnigeria.github.io/IIPM-Examination-Portal/',
  hourly_batch_size integer not null default 40 check (hourly_batch_size between 1 and 100),
  max_attempts integer not null default 5 check (max_attempts between 1 and 12),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agilecert_communication_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.agilecert_communication_preferences (
  candidate_id uuid primary key references public.profiles(id) on delete cascade,
  certificate_reminders boolean not null default true,
  course_recommendations boolean not null default true,
  operational_messages boolean not null default true,
  optional_unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_communication_suppressions (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  reason text not null check (reason in ('unsubscribe', 'hard_bounce', 'complaint', 'manual')),
  scope text not null default 'all_optional'
    check (scope in ('certificate_reminders', 'course_recommendations', 'all_optional', 'all_email')),
  active boolean not null default true,
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_hash, reason, scope)
);

create table if not exists public.agilecert_communication_outbox (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  recipient_email_hash text not null,
  message_type text not null check (message_type in (
    'preparation_material_ready',
    'certificate_offer_immediate',
    'certificate_offer_day_2',
    'certificate_offer_day_5',
    'certificate_offer_day_7',
    'certificate_purchase_confirmation',
    'credential_ready',
    'course_recommendation'
  )),
  category text not null check (category in ('operational', 'certificate_reminder', 'marketing')),
  event_key text not null unique,
  due_at timestamptz not null,
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'sent', 'failed', 'cancelled', 'suppressed'
  )),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  provider text,
  provider_message_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  claimed_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_communication_outbox_dispatch_idx
  on public.agilecert_communication_outbox(status, due_at, next_attempt_at);
create index if not exists agilecert_communication_outbox_candidate_idx
  on public.agilecert_communication_outbox(candidate_id, created_at desc);
create index if not exists agilecert_communication_outbox_provider_idx
  on public.agilecert_communication_outbox(provider_message_id)
  where provider_message_id is not null;

create table if not exists public.agilecert_communication_events (
  id bigint generated always as identity primary key,
  outbox_id uuid references public.agilecert_communication_outbox(id) on delete set null,
  candidate_id uuid references public.profiles(id) on delete set null,
  provider_message_id text,
  event_type text not null check (event_type in (
    'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced',
    'complained', 'unsubscribed', 'suppressed', 'failed', 'cancelled', 'conversion'
  )),
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_communication_events_outbox_idx
  on public.agilecert_communication_events(outbox_id, event_at desc);
create index if not exists agilecert_communication_events_provider_idx
  on public.agilecert_communication_events(provider_message_id, event_at desc);

alter table public.agilecert_communication_settings enable row level security;
alter table public.agilecert_communication_preferences enable row level security;
alter table public.agilecert_communication_suppressions enable row level security;
alter table public.agilecert_communication_outbox enable row level security;
alter table public.agilecert_communication_events enable row level security;

revoke all on public.agilecert_communication_settings from anon, authenticated;
revoke all on public.agilecert_communication_preferences from anon, authenticated;
revoke all on public.agilecert_communication_suppressions from anon, authenticated;
revoke all on public.agilecert_communication_outbox from anon, authenticated;
revoke all on public.agilecert_communication_events from anon, authenticated;
grant select on public.agilecert_communication_preferences to authenticated;

drop policy if exists agilecert_communication_preferences_select_own
  on public.agilecert_communication_preferences;
create policy agilecert_communication_preferences_select_own
  on public.agilecert_communication_preferences
  for select to authenticated
  using (candidate_id = auth.uid());

create or replace function public.get_my_agilecert_communication_preferences()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_preferences public.agilecert_communication_preferences%rowtype;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  insert into public.agilecert_communication_preferences(candidate_id)
  values (v_candidate_id)
  on conflict (candidate_id) do nothing;

  select * into v_preferences
  from public.agilecert_communication_preferences
  where candidate_id = v_candidate_id;

  return jsonb_build_object(
    'certificateReminders', v_preferences.certificate_reminders,
    'courseRecommendations', v_preferences.course_recommendations,
    'operationalMessages', v_preferences.operational_messages,
    'optionalUnsubscribedAt', v_preferences.optional_unsubscribed_at,
    'updatedAt', v_preferences.updated_at
  );
end;
$$;

create or replace function public.update_my_agilecert_communication_preferences(
  p_certificate_reminders boolean,
  p_course_recommendations boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  insert into public.agilecert_communication_preferences(
    candidate_id, certificate_reminders, course_recommendations,
    optional_unsubscribed_at, updated_at
  ) values (
    v_candidate_id,
    coalesce(p_certificate_reminders, true),
    coalesce(p_course_recommendations, true),
    case when coalesce(p_certificate_reminders, true) or coalesce(p_course_recommendations, true)
      then null else now() end,
    now()
  )
  on conflict (candidate_id) do update set
    certificate_reminders = excluded.certificate_reminders,
    course_recommendations = excluded.course_recommendations,
    optional_unsubscribed_at = excluded.optional_unsubscribed_at,
    updated_at = now();

  update public.agilecert_communication_outbox
  set status = 'cancelled', cancelled_at = now(), updated_at = now(),
      failure_code = 'preference_disabled'
  where candidate_id = v_candidate_id
    and status in ('queued', 'failed')
    and (
      not coalesce(p_certificate_reminders, true) and category = 'certificate_reminder'
      or not coalesce(p_course_recommendations, true) and category = 'marketing'
    );

  return public.get_my_agilecert_communication_preferences();
end;
$$;

revoke all on function public.get_my_agilecert_communication_preferences()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_communication_preferences() to authenticated;
revoke all on function public.update_my_agilecert_communication_preferences(boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_my_agilecert_communication_preferences(boolean, boolean)
  to authenticated;

create or replace function public.register_agilecert_communication_unsubscribe(
  p_candidate_id uuid,
  p_email_hash text,
  p_scope text default 'all_optional',
  p_source text default 'email_link'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := lower(trim(coalesce(p_scope, 'all_optional')));
begin
  if v_scope not in ('certificate_reminders', 'course_recommendations', 'all_optional', 'all_email') then
    raise exception 'Unsupported communication unsubscribe scope.';
  end if;

  insert into public.agilecert_communication_preferences(
    candidate_id, certificate_reminders, course_recommendations,
    operational_messages, optional_unsubscribed_at, updated_at
  ) values (
    p_candidate_id,
    v_scope not in ('certificate_reminders', 'all_optional', 'all_email'),
    v_scope not in ('course_recommendations', 'all_optional', 'all_email'),
    v_scope <> 'all_email', now(), now()
  )
  on conflict (candidate_id) do update set
    certificate_reminders = case when v_scope in ('certificate_reminders', 'all_optional', 'all_email')
      then false else public.agilecert_communication_preferences.certificate_reminders end,
    course_recommendations = case when v_scope in ('course_recommendations', 'all_optional', 'all_email')
      then false else public.agilecert_communication_preferences.course_recommendations end,
    operational_messages = case when v_scope = 'all_email' then false
      else public.agilecert_communication_preferences.operational_messages end,
    optional_unsubscribed_at = now(),
    updated_at = now();

  insert into public.agilecert_communication_suppressions(
    email_hash, reason, scope, active, source, metadata
  ) values (
    lower(trim(p_email_hash)), 'unsubscribe', v_scope, true,
    left(trim(coalesce(p_source, 'email_link')), 80),
    jsonb_build_object('candidateId', p_candidate_id)
  )
  on conflict (email_hash, reason, scope) do update set
    active = true, source = excluded.source, metadata = excluded.metadata, updated_at = now();

  update public.agilecert_communication_outbox
  set status = 'cancelled', cancelled_at = now(), updated_at = now(), failure_code = 'unsubscribed'
  where candidate_id = p_candidate_id and status in ('queued', 'failed')
    and (
      v_scope in ('all_optional', 'all_email') and category in ('certificate_reminder', 'marketing')
      or v_scope = 'certificate_reminders' and category = 'certificate_reminder'
      or v_scope = 'course_recommendations' and category = 'marketing'
      or v_scope = 'all_email'
    );
end;
$$;

revoke all on function public.register_agilecert_communication_unsubscribe(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_agilecert_communication_unsubscribe(uuid, text, text, text)
  to service_role;

create or replace function public.refresh_agilecert_communication_outbox(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inserted integer := 0;
  v_cancelled integer := 0;
  v_rows integer := 0;
begin
  insert into public.agilecert_communication_preferences(candidate_id)
  select distinct candidate_id
  from (
    select er.candidate_id from public.agilecert_certificate_eligibility_records er
    union select o.candidate_id from public.agilecert_certificate_orders o
    union select o.candidate_id from public.exam_orders o
  ) candidates
  on conflict (candidate_id) do nothing;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  )
  select o.candidate_id, lower(u.email), encode(digest(lower(u.email), 'sha256'), 'hex'),
    'preparation_material_ready', 'operational', 'exam-material-ready:' || o.id,
    coalesce(o.fulfilled_at, o.updated_at, o.created_at),
    jsonb_build_object(
      'orderId', o.id, 'examinationId', o.examination_id,
      'examinationTitle', e.title, 'reference', o.reference
    )
  from public.exam_orders o
  join auth.users u on u.id = o.candidate_id and u.email is not null
  join public.examinations e on e.id = o.examination_id
  join public.agilecert_communication_preferences pref on pref.candidate_id = o.candidate_id
  where o.status in ('paid', 'waived') and o.fulfilled_at is not null
    and pref.operational_messages
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  with eligible as (
    select er.id as eligibility_id, er.candidate_id, er.examination_id,
      er.score, er.pass_mark, e.title as examination_title,
      coalesce(a.submitted_at, a.graded_at, er.evaluated_at) as passed_at,
      lower(u.email) as email,
      encode(digest(lower(u.email), 'sha256'), 'hex') as email_hash
    from public.agilecert_certificate_eligibility_records er
    join public.attempts a on a.id = er.attempt_id
    join public.examinations e on e.id = er.examination_id
    join auth.users u on u.id = er.candidate_id and u.email is not null
    join public.agilecert_communication_preferences pref on pref.candidate_id = er.candidate_id
    where er.eligibility_status in ('eligible', 'requested')
      and er.integrity_status = 'cleared'
      and pref.certificate_reminders
      and not exists (
        select 1 from public.agilecert_certificate_orders o
        where o.eligibility_id = er.id and o.status in ('paid', 'waived')
      )
  ), cadence as (
    select * from (values
      ('certificate_offer_immediate'::text, 'immediate'::text, interval '0 days'),
      ('certificate_offer_day_2'::text, 'day-2'::text, interval '2 days'),
      ('certificate_offer_day_5'::text, 'day-5'::text, interval '5 days'),
      ('certificate_offer_day_7'::text, 'day-7'::text, interval '6 days 20 hours')
    ) as c(message_type, cadence_key, delay)
  )
  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  )
  select eligible.candidate_id, eligible.email, eligible.email_hash,
    cadence.message_type, 'certificate_reminder',
    'certificate-offer:' || eligible.eligibility_id || ':' || cadence.cadence_key,
    eligible.passed_at + cadence.delay,
    jsonb_build_object(
      'eligibilityId', eligible.eligibility_id,
      'examinationId', eligible.examination_id,
      'examinationTitle', eligible.examination_title,
      'score', eligible.score, 'passMark', eligible.pass_mark,
      'passedAt', eligible.passed_at,
      'earlyPriceExpiresAt', eligible.passed_at + interval '7 days'
    )
  from eligible cross join cadence
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  update public.agilecert_communication_outbox box
  set status = 'cancelled', cancelled_at = p_now, updated_at = p_now,
      failure_code = 'certificate_offer_no_longer_due'
  where box.category = 'certificate_reminder'
    and box.status in ('queued', 'failed')
    and (
      exists (
        select 1 from public.agilecert_certificate_orders o
        where box.event_key like 'certificate-offer:' || o.eligibility_id || ':%'
          and o.status in ('paid', 'waived')
      )
      or not exists (
        select 1 from public.agilecert_certificate_eligibility_records er
        where box.event_key like 'certificate-offer:' || er.id || ':%'
          and er.eligibility_status in ('eligible', 'requested')
          and er.integrity_status = 'cleared'
      )
    );
  get diagnostics v_cancelled = row_count;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  )
  select o.candidate_id, lower(u.email), encode(digest(lower(u.email), 'sha256'), 'hex'),
    'certificate_purchase_confirmation', 'operational', 'certificate-purchase:' || o.id,
    coalesce(o.fulfilled_at, o.paid_at, o.waived_at, o.updated_at),
    jsonb_build_object(
      'orderId', o.id, 'eligibilityId', o.eligibility_id,
      'productCode', o.product_code, 'productTitle', product.title,
      'reference', o.reference, 'currency', o.currency,
      'amountMinor', o.payable_amount_minor
    )
  from public.agilecert_certificate_orders o
  join auth.users u on u.id = o.candidate_id and u.email is not null
  join public.agilecert_certificate_products product on product.code = o.product_code
  join public.agilecert_communication_preferences pref on pref.candidate_id = o.candidate_id
  where o.status in ('paid', 'waived') and pref.operational_messages
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  )
  select credential.candidate_id, lower(u.email), encode(digest(lower(u.email), 'sha256'), 'hex'),
    'credential_ready', 'operational', 'credential-ready:' || credential.id,
    credential.issued_at,
    jsonb_build_object(
      'credentialId', credential.id, 'productCode', credential.product_code,
      'credentialCode', credential.credential_code,
      'verificationUrl', credential.verification_url,
      'linkedinCredentialName', credential.linkedin_credential_name
    )
  from public.agilecert_paid_credentials credential
  join auth.users u on u.id = credential.candidate_id and u.email is not null
  join public.agilecert_communication_preferences pref on pref.candidate_id = credential.candidate_id
  where credential.status = 'active' and pref.operational_messages
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  )
  select credential.candidate_id, lower(u.email), encode(digest(lower(u.email), 'sha256'), 'hex'),
    'course_recommendation', 'marketing', 'course-recommendation:' || credential.id,
    credential.issued_at + interval '1 day',
    jsonb_build_object(
      'credentialId', credential.id, 'productCode', credential.product_code,
      'sourceExaminationId', cert.examination_id,
      'sourceExaminationTitle', cert.examination_title
    )
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates cert on cert.id = credential.certificate_id
  join auth.users u on u.id = credential.candidate_id and u.email is not null
  join public.agilecert_communication_preferences pref on pref.candidate_id = credential.candidate_id
  where credential.status = 'active' and pref.course_recommendations
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  insert into public.agilecert_communication_events(outbox_id, candidate_id, event_type, metadata)
  select box.id, box.candidate_id, 'queued', jsonb_build_object('messageType', box.message_type)
  from public.agilecert_communication_outbox box
  where box.created_at >= p_now - interval '10 seconds'
    and not exists (
      select 1 from public.agilecert_communication_events event
      where event.outbox_id = box.id and event.event_type = 'queued'
    );

  return jsonb_build_object(
    'inserted', v_inserted, 'cancelled', v_cancelled, 'refreshedAt', p_now
  );
end;
$$;

revoke all on function public.refresh_agilecert_communication_outbox(timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_agilecert_communication_outbox(timestamptz)
  to service_role;

create or replace function public.claim_agilecert_communication_outbox(
  p_batch_size integer default 40,
  p_now timestamptz default now()
)
returns setof public.agilecert_communication_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select box.id
    from public.agilecert_communication_outbox box
    join public.agilecert_communication_settings settings on settings.singleton
    join public.agilecert_communication_preferences pref on pref.candidate_id = box.candidate_id
    where settings.provider_enabled
      and box.status in ('queued', 'failed')
      and box.due_at <= p_now
      and coalesce(box.next_attempt_at, box.due_at) <= p_now
      and box.attempts < settings.max_attempts
      and (
        box.category = 'operational' and pref.operational_messages
        or box.category = 'certificate_reminder' and pref.certificate_reminders
        or box.category = 'marketing' and pref.course_recommendations
      )
      and not exists (
        select 1 from public.agilecert_communication_suppressions suppression
        where suppression.email_hash = box.recipient_email_hash and suppression.active
          and (
            suppression.scope = 'all_email'
            or suppression.scope = 'all_optional' and box.category <> 'operational'
            or suppression.scope = 'certificate_reminders' and box.category = 'certificate_reminder'
            or suppression.scope = 'course_recommendations' and box.category = 'marketing'
          )
      )
    order by box.due_at, box.created_at
    limit greatest(1, least(coalesce(p_batch_size, 40), 100))
    for update skip locked
  )
  update public.agilecert_communication_outbox box
  set status = 'processing', claimed_at = p_now,
      attempts = attempts + 1, updated_at = p_now
  from candidates
  where box.id = candidates.id
  returning box.*;
end;
$$;

revoke all on function public.claim_agilecert_communication_outbox(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_agilecert_communication_outbox(integer, timestamptz)
  to service_role;

create or replace function public.complete_agilecert_communication_delivery(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_subject text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.agilecert_communication_outbox%rowtype;
  v_max_attempts integer;
begin
  select settings.max_attempts into v_max_attempts
  from public.agilecert_communication_settings settings where settings.singleton;

  select * into v_box
  from public.agilecert_communication_outbox where id = p_outbox_id for update;
  if v_box.id is null then raise exception 'Communication outbox item not found.'; end if;

  update public.agilecert_communication_outbox
  set status = case when coalesce(p_succeeded, false) then 'sent' else 'failed' end,
      provider = nullif(trim(coalesce(p_provider, '')), ''),
      provider_message_id = nullif(trim(coalesce(p_provider_message_id, '')), ''),
      subject = nullif(left(trim(coalesce(p_subject, '')), 300), ''),
      provider_metadata = coalesce(p_provider_metadata, '{}'::jsonb),
      failure_code = case when coalesce(p_succeeded, false) then null
        else nullif(left(trim(coalesce(p_failure_code, 'delivery_failed')), 120), '') end,
      failure_message = case when coalesce(p_succeeded, false) then null
        else nullif(left(trim(coalesce(p_failure_message, '')), 1000), '') end,
      next_attempt_at = case
        when coalesce(p_succeeded, false) or attempts >= coalesce(v_max_attempts, 5) then null
        else now() + make_interval(mins => least(360, greatest(5, attempts * attempts * 5)))
      end,
      sent_at = case when coalesce(p_succeeded, false) then now() else sent_at end,
      updated_at = now()
  where id = p_outbox_id;

  insert into public.agilecert_communication_events(
    outbox_id, candidate_id, provider_message_id, event_type, metadata
  ) values (
    p_outbox_id, v_box.candidate_id,
    nullif(trim(coalesce(p_provider_message_id, '')), ''),
    case when coalesce(p_succeeded, false) then 'sent' else 'failed' end,
    jsonb_build_object('messageType', v_box.message_type, 'attempt', v_box.attempts + 1,
      'failureCode', p_failure_code)
  );
end;
$$;

revoke all on function public.complete_agilecert_communication_delivery(
  uuid, boolean, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_agilecert_communication_delivery(
  uuid, boolean, text, text, text, text, text, jsonb
) to service_role;

create or replace function public.record_agilecert_communication_provider_event(
  p_provider_message_id text,
  p_event_type text,
  p_email_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text := lower(trim(coalesce(p_event_type, '')));
  v_box public.agilecert_communication_outbox%rowtype;
begin
  if v_event not in ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') then
    raise exception 'Unsupported communication provider event.';
  end if;

  select * into v_box
  from public.agilecert_communication_outbox
  where provider_message_id = nullif(trim(coalesce(p_provider_message_id, '')), '')
  order by sent_at desc nulls last limit 1;

  insert into public.agilecert_communication_events(
    outbox_id, candidate_id, provider_message_id, event_type, metadata
  ) values (
    v_box.id, v_box.candidate_id,
    nullif(trim(coalesce(p_provider_message_id, '')), ''),
    v_event, coalesce(p_metadata, '{}'::jsonb)
  );

  if v_event in ('bounced', 'complained')
    and nullif(trim(coalesce(p_email_hash, '')), '') is not null then
    insert into public.agilecert_communication_suppressions(
      email_hash, reason, scope, active, source, metadata
    ) values (
      lower(trim(p_email_hash)),
      case when v_event = 'bounced' then 'hard_bounce' else 'complaint' end,
      'all_email', true, 'provider_webhook', coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (email_hash, reason, scope) do update set
      active = true, source = excluded.source,
      metadata = excluded.metadata, updated_at = now();

    update public.agilecert_communication_outbox
    set status = 'suppressed', updated_at = now(), failure_code = v_event
    where recipient_email_hash = lower(trim(p_email_hash))
      and status in ('queued', 'failed');
  end if;
end;
$$;

revoke all on function public.record_agilecert_communication_provider_event(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_agilecert_communication_provider_event(text, text, text, jsonb)
  to service_role;

create or replace function public.get_agilecert_communications_admin_console()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.is_active = true and p.role in ('exam_admin', 'super_admin')
  ) then
    raise exception 'Active examination-administrator access is required.';
  end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'settings', (
      select to_jsonb(settings) - 'updated_by'
      from public.agilecert_communication_settings settings where settings.singleton
    ),
    'counts', jsonb_build_object(
      'queued', (select count(*) from public.agilecert_communication_outbox where status = 'queued'),
      'processing', (select count(*) from public.agilecert_communication_outbox where status = 'processing'),
      'sent', (select count(*) from public.agilecert_communication_outbox where status = 'sent'),
      'failed', (select count(*) from public.agilecert_communication_outbox where status = 'failed'),
      'suppressed', (select count(*) from public.agilecert_communication_outbox where status = 'suppressed'),
      'cancelled', (select count(*) from public.agilecert_communication_outbox where status = 'cancelled')
    ),
    'recentOutbox', coalesce((
      select jsonb_agg(to_jsonb(recent) - 'recipient_email' order by recent.created_at desc)
      from (
        select * from public.agilecert_communication_outbox
        order by created_at desc limit 100
      ) recent
    ), '[]'::jsonb),
    'recentEvents', coalesce((
      select jsonb_agg(to_jsonb(recent) order by recent.event_at desc)
      from (
        select * from public.agilecert_communication_events
        order by event_at desc limit 100
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_agilecert_communication_settings(
  p_provider_enabled boolean,
  p_from_name text,
  p_from_email text,
  p_reply_to_email text,
  p_hourly_batch_size integer,
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.is_active = true and p.role = 'super_admin'
  ) then
    raise exception 'Only a Super Administrator may update communication settings.';
  end if;

  if coalesce(p_provider_enabled, false) and (
    nullif(trim(coalesce(p_from_email, '')), '') is null
    or position('@' in trim(p_from_email)) = 0
  ) then
    raise exception 'A valid verified sender email is required before enabling delivery.';
  end if;

  update public.agilecert_communication_settings
  set provider_enabled = coalesce(p_provider_enabled, false),
      from_name = coalesce(nullif(trim(p_from_name), ''), 'AgileCert Global'),
      from_email = nullif(lower(trim(coalesce(p_from_email, ''))), ''),
      reply_to_email = nullif(lower(trim(coalesce(p_reply_to_email, ''))), ''),
      hourly_batch_size = greatest(1, least(coalesce(p_hourly_batch_size, 40), 100)),
      max_attempts = greatest(1, least(coalesce(p_max_attempts, 5), 12)),
      updated_by = v_actor, updated_at = now()
  where singleton;

  return public.get_agilecert_communications_admin_console();
end;
$$;

revoke all on function public.get_agilecert_communications_admin_console()
  from public, anon, authenticated;
grant execute on function public.get_agilecert_communications_admin_console()
  to authenticated;
revoke all on function public.update_agilecert_communication_settings(boolean, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.update_agilecert_communication_settings(boolean, text, text, text, integer, integer)
  to authenticated;

comment on table public.agilecert_communication_outbox is
  'Idempotent email outbox derived from authoritative examination, payment, certificate and credential state.';
comment on function public.refresh_agilecert_communication_outbox(timestamptz) is
  'Service-role-only derivation of due operational, certificate reminder and post-purchase communications.';
comment on function public.claim_agilecert_communication_outbox(integer, timestamptz) is
  'Claims due communications with preference, suppression and retry controls.';

commit;
