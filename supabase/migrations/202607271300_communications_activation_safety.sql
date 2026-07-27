begin;

alter table public.agilecert_communication_settings
  add column if not exists delivery_cutover_at timestamptz,
  add column if not exists initial_provider_activated_at timestamptz,
  add column if not exists last_provider_disabled_at timestamptz,
  add column if not exists verified_sender_domain text,
  add column if not exists activation_notes text;

alter table public.agilecert_communication_settings
  drop constraint if exists agilecert_communication_settings_activation_notes_length;
alter table public.agilecert_communication_settings
  add constraint agilecert_communication_settings_activation_notes_length
  check (activation_notes is null or char_length(activation_notes) <= 500);

create or replace function public.guard_agilecert_communication_outbox_cutover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutover timestamptz;
begin
  select settings.delivery_cutover_at
  into v_cutover
  from public.agilecert_communication_settings settings
  where settings.singleton;

  if v_cutover is not null
    and new.due_at < v_cutover
    and new.status in ('queued', 'failed') then
    new.status := 'cancelled';
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.failure_code := 'pre_activation_backlog';
    new.failure_message := 'This communication predates the controlled production delivery cutover.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_agilecert_communication_outbox_cutover()
  from public, anon, authenticated;

drop trigger if exists agilecert_communication_outbox_cutover_guard
  on public.agilecert_communication_outbox;
create trigger agilecert_communication_outbox_cutover_guard
before insert or update of due_at, status
on public.agilecert_communication_outbox
for each row execute function public.guard_agilecert_communication_outbox_cutover();

create or replace function public.configure_agilecert_communication_provider_activation(
  p_provider_enabled boolean,
  p_from_name text,
  p_from_email text,
  p_reply_to_email text,
  p_hourly_batch_size integer,
  p_max_attempts integer,
  p_verified_sender_domain text,
  p_reset_cutover boolean default false,
  p_activation_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_email text := lower(trim(coalesce(p_from_email, '')));
  v_domain text := lower(trim(coalesce(p_verified_sender_domain, '')));
  v_cutover timestamptz;
  v_cancelled integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-role communications activation authority is required.';
  end if;

  if coalesce(p_provider_enabled, false) then
    if v_email = '' or position('@' in v_email) = 0 then
      raise exception 'A valid verified sender email is required before enabling delivery.';
    end if;
    if v_domain = '' or split_part(v_email, '@', 2) <> v_domain then
      raise exception 'The verified sender domain must exactly match the sender email domain.';
    end if;
  end if;

  update public.agilecert_communication_settings settings
  set provider_enabled = coalesce(p_provider_enabled, false),
      from_name = coalesce(nullif(trim(p_from_name), ''), settings.from_name, 'AgileCert Global'),
      from_email = nullif(v_email, ''),
      reply_to_email = nullif(lower(trim(coalesce(p_reply_to_email, ''))), ''),
      hourly_batch_size = greatest(1, least(coalesce(p_hourly_batch_size, settings.hourly_batch_size, 40), 100)),
      max_attempts = greatest(1, least(coalesce(p_max_attempts, settings.max_attempts, 5), 12)),
      verified_sender_domain = case
        when coalesce(p_provider_enabled, false) then v_domain
        else coalesce(nullif(v_domain, ''), settings.verified_sender_domain)
      end,
      delivery_cutover_at = case
        when coalesce(p_provider_enabled, false)
          and (settings.delivery_cutover_at is null or coalesce(p_reset_cutover, false))
          then v_now
        else settings.delivery_cutover_at
      end,
      initial_provider_activated_at = case
        when coalesce(p_provider_enabled, false)
          then coalesce(settings.initial_provider_activated_at, v_now)
        else settings.initial_provider_activated_at
      end,
      last_provider_disabled_at = case
        when not coalesce(p_provider_enabled, false) then v_now
        else settings.last_provider_disabled_at
      end,
      activation_notes = nullif(left(trim(coalesce(p_activation_notes, '')), 500), ''),
      updated_at = v_now
  where settings.singleton
  returning delivery_cutover_at into v_cutover;

  if coalesce(p_provider_enabled, false) and v_cutover is not null then
    update public.agilecert_communication_outbox
    set status = 'cancelled',
        cancelled_at = v_now,
        updated_at = v_now,
        failure_code = 'pre_activation_backlog',
        failure_message = 'This communication predates the controlled production delivery cutover.'
    where status in ('queued', 'failed')
      and due_at < v_cutover;
    get diagnostics v_cancelled = row_count;
  end if;

  return jsonb_build_object(
    'providerEnabled', coalesce(p_provider_enabled, false),
    'fromName', coalesce(nullif(trim(p_from_name), ''), 'AgileCert Global'),
    'fromEmail', nullif(v_email, ''),
    'replyToEmail', nullif(lower(trim(coalesce(p_reply_to_email, ''))), ''),
    'verifiedSenderDomain', nullif(v_domain, ''),
    'deliveryCutoverAt', v_cutover,
    'cancelledPreActivationBacklog', v_cancelled,
    'configuredAt', v_now
  );
end;
$$;

revoke all on function public.configure_agilecert_communication_provider_activation(
  boolean, text, text, text, integer, integer, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.configure_agilecert_communication_provider_activation(
  boolean, text, text, text, integer, integer, text, boolean, text
) to service_role;

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
  v_current_enabled boolean;
  v_current_email text;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.is_active = true and p.role = 'super_admin'
  ) then
    raise exception 'Only a Super Administrator may update communication settings.';
  end if;

  select settings.provider_enabled, settings.from_email
  into v_current_enabled, v_current_email
  from public.agilecert_communication_settings settings
  where settings.singleton;

  if coalesce(p_provider_enabled, false) and not coalesce(v_current_enabled, false) then
    raise exception 'Provider activation requires the controlled credential and verified-domain workflow.';
  end if;

  if coalesce(v_current_enabled, false)
    and coalesce(p_provider_enabled, false)
    and lower(trim(coalesce(p_from_email, ''))) is distinct from lower(trim(coalesce(v_current_email, ''))) then
    raise exception 'Change the verified sender through the controlled activation workflow.';
  end if;

  update public.agilecert_communication_settings
  set provider_enabled = case
        when coalesce(v_current_enabled, false) and coalesce(p_provider_enabled, false) then true
        else false
      end,
      from_name = coalesce(nullif(trim(p_from_name), ''), 'AgileCert Global'),
      from_email = nullif(lower(trim(coalesce(p_from_email, ''))), ''),
      reply_to_email = nullif(lower(trim(coalesce(p_reply_to_email, ''))), ''),
      hourly_batch_size = greatest(1, least(coalesce(p_hourly_batch_size, 40), 100)),
      max_attempts = greatest(1, least(coalesce(p_max_attempts, 5), 12)),
      last_provider_disabled_at = case
        when coalesce(v_current_enabled, false) and not coalesce(p_provider_enabled, false) then now()
        else last_provider_disabled_at
      end,
      updated_by = v_actor,
      updated_at = now()
  where singleton;

  return public.get_agilecert_communications_admin_console();
end;
$$;

revoke all on function public.update_agilecert_communication_settings(boolean, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.update_agilecert_communication_settings(boolean, text, text, text, integer, integer)
  to authenticated;

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
      and settings.delivery_cutover_at is not null
      and box.due_at >= settings.delivery_cutover_at
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
  set status = 'processing',
      claimed_at = p_now,
      attempts = attempts + 1,
      updated_at = p_now
  from candidates
  where box.id = candidates.id
  returning box.*;
end;
$$;

revoke all on function public.claim_agilecert_communication_outbox(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_agilecert_communication_outbox(integer, timestamptz)
  to service_role;

comment on function public.configure_agilecert_communication_provider_activation(
  boolean, text, text, text, integer, integer, text, boolean, text
) is 'Service-role-only activation authority with first-delivery cutover and pre-activation backlog cancellation.';
comment on function public.guard_agilecert_communication_outbox_cutover() is
  'Cancels newly derived communications whose due time predates the controlled delivery cutover.';

commit;
