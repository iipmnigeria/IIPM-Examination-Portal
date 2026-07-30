begin;

-- Mandatory candidate onboarding, administrator people directory and auditable
-- administrator-originated email queueing. Existing examination, payment and
-- communications authorities remain server-owned.

alter table public.agilecert_candidate_profiles
  add column if not exists profile_update_required boolean not null default true,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists examination_policy_accepted_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_version text;

create or replace function public.agilecert_candidate_profile_is_complete(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      not cp.profile_update_required
      and length(trim(coalesce(cp.legal_name, ''))) >= 3
      and length(trim(coalesce(cp.phone, ''))) >= 7
      and coalesce(cp.country_code, '') ~ '^[A-Z]{2}$'
      and coalesce(cp.preferred_currency, '') in ('NGN', 'USD')
      and length(trim(coalesce(cp.timezone, ''))) >= 3
      and cp.privacy_accepted_at is not null
      and cp.terms_accepted_at is not null
      and cp.examination_policy_accepted_at is not null
      and cp.onboarding_completed_at is not null
    from public.agilecert_candidate_profiles cp
    where cp.user_id = p_user_id
  ), false)
$$;

create or replace function public.get_my_agilecert_onboarding_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_complete boolean;
  v_missing text[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'complete', false,
      'profileExists', false,
      'profileUpdateRequired', true,
      'completionPercent', 0,
      'missingFields', jsonb_build_array(
        'legalName', 'phone', 'countryCode', 'preferredCurrency', 'timezone',
        'privacyAcceptance', 'termsAcceptance', 'examinationPolicyAcceptance'
      ),
      'onboardingVersion', '2026-07'
    );
  end if;

  if length(trim(coalesce(v_profile.legal_name, ''))) < 3 then v_missing := array_append(v_missing, 'legalName'); end if;
  if length(trim(coalesce(v_profile.phone, ''))) < 7 then v_missing := array_append(v_missing, 'phone'); end if;
  if coalesce(v_profile.country_code, '') !~ '^[A-Z]{2}$' then v_missing := array_append(v_missing, 'countryCode'); end if;
  if coalesce(v_profile.preferred_currency, '') not in ('NGN', 'USD') then v_missing := array_append(v_missing, 'preferredCurrency'); end if;
  if length(trim(coalesce(v_profile.timezone, ''))) < 3 then v_missing := array_append(v_missing, 'timezone'); end if;
  if v_profile.privacy_accepted_at is null then v_missing := array_append(v_missing, 'privacyAcceptance'); end if;
  if v_profile.terms_accepted_at is null then v_missing := array_append(v_missing, 'termsAcceptance'); end if;
  if v_profile.examination_policy_accepted_at is null then v_missing := array_append(v_missing, 'examinationPolicyAcceptance'); end if;
  if v_profile.profile_update_required then v_missing := array_append(v_missing, 'administratorRequiredUpdate'); end if;

  v_complete := public.agilecert_candidate_profile_is_complete(v_user_id);

  return jsonb_build_object(
    'complete', v_complete,
    'profileExists', true,
    'profileUpdateRequired', v_profile.profile_update_required,
    'completionPercent', greatest(0, round(((8 - least(array_length(v_missing, 1), 8))::numeric / 8) * 100)),
    'missingFields', to_jsonb(v_missing),
    'onboardingCompletedAt', v_profile.onboarding_completed_at,
    'onboardingVersion', coalesce(v_profile.onboarding_version, '2026-07')
  );
end;
$$;

create or replace function public.complete_my_agilecert_candidate_onboarding(
  p_legal_name text,
  p_phone text,
  p_country_code text,
  p_preferred_currency text,
  p_timezone text,
  p_accept_privacy boolean,
  p_accept_terms boolean,
  p_accept_examination_policy boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_legal_name text := trim(coalesce(p_legal_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_country_code text := upper(trim(coalesce(p_country_code, '')));
  v_currency text := upper(trim(coalesce(p_preferred_currency, '')));
  v_timezone text := trim(coalesce(p_timezone, ''));
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'Only an active candidate account may complete candidate onboarding.';
  end if;
  if length(v_legal_name) < 3 then raise exception 'Enter your full legal name.'; end if;
  if length(v_phone) < 7 then raise exception 'Enter a valid telephone number.'; end if;
  if v_country_code !~ '^[A-Z]{2}$' then raise exception 'Country code must contain two letters.'; end if;
  if v_currency not in ('NGN', 'USD') then raise exception 'Preferred currency must be NGN or USD.'; end if;
  if length(v_timezone) < 3 then raise exception 'Select a valid time zone.'; end if;
  if not coalesce(p_accept_privacy, false)
     or not coalesce(p_accept_terms, false)
     or not coalesce(p_accept_examination_policy, false) then
    raise exception 'Privacy, terms and examination policy acceptance are required.';
  end if;

  insert into public.agilecert_candidate_profiles (
    user_id, legal_name, phone, country_code, preferred_currency, timezone,
    profile_update_required, privacy_accepted_at, terms_accepted_at,
    examination_policy_accepted_at, onboarding_completed_at, onboarding_version
  ) values (
    v_user_id, v_legal_name, v_phone, v_country_code, v_currency, v_timezone,
    false, v_now, v_now, v_now, v_now, '2026-07'
  )
  on conflict (user_id) do update set
    legal_name = excluded.legal_name,
    phone = excluded.phone,
    country_code = excluded.country_code,
    preferred_currency = excluded.preferred_currency,
    timezone = excluded.timezone,
    profile_update_required = false,
    privacy_accepted_at = coalesce(public.agilecert_candidate_profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    terms_accepted_at = coalesce(public.agilecert_candidate_profiles.terms_accepted_at, excluded.terms_accepted_at),
    examination_policy_accepted_at = coalesce(public.agilecert_candidate_profiles.examination_policy_accepted_at, excluded.examination_policy_accepted_at),
    onboarding_completed_at = v_now,
    onboarding_version = '2026-07',
    updated_at = v_now;

  update public.profiles
  set full_name = v_legal_name, phone = v_phone, updated_at = v_now
  where id = v_user_id;

  insert into public.agilecert_communication_preferences(candidate_id)
  values (v_user_id)
  on conflict (candidate_id) do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id, 'complete_candidate_onboarding', 'candidate_profile', v_user_id::text,
    jsonb_build_object('version', '2026-07', 'countryCode', v_country_code, 'preferredCurrency', v_currency)
  );

  return public.get_my_agilecert_onboarding_status();
end;
$$;

create or replace function public.enforce_agilecert_candidate_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agilecert_candidate_profile_is_complete(new.candidate_id) then
    raise exception 'Complete your mandatory candidate profile before purchasing or starting an examination.';
  end if;
  return new;
end;
$$;

drop trigger if exists agilecert_exam_order_profile_gate on public.exam_orders;
create trigger agilecert_exam_order_profile_gate
  before insert on public.exam_orders
  for each row execute function public.enforce_agilecert_candidate_onboarding();

drop trigger if exists agilecert_exam_session_profile_gate on public.exam_sessions;
create trigger agilecert_exam_session_profile_gate
  before insert on public.exam_sessions
  for each row execute function public.enforce_agilecert_candidate_onboarding();

-- Also block reuse of an already-active session while the profile is incomplete.
create or replace function public.start_exam_secure(
  p_examination_id uuid,
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_exam public.examinations%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_session public.exam_sessions%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
  v_expiry timestamptz;
  v_test jsonb;
begin
  if v_candidate_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (
    select 1 from public.profiles where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then raise exception 'Only an active candidate account may start an examination.'; end if;
  if not public.agilecert_candidate_profile_is_complete(v_candidate_id) then
    raise exception 'Complete your mandatory candidate profile before starting an examination.';
  end if;

  select * into v_exam from public.examinations where id = p_examination_id for update;
  if not found or v_exam.status <> 'published' then raise exception 'This examination is not available.'; end if;
  if v_exam.starts_at is not null and v_exam.starts_at > now() then raise exception 'This examination has not opened.'; end if;
  if v_exam.ends_at is not null and v_exam.ends_at <= now() then raise exception 'This examination has closed.'; end if;

  select * into v_assignment from public.exam_assignments
  where examination_id = p_examination_id and candidate_id = v_candidate_id for update;
  if not found then
    if v_exam.requires_payment then
      raise exception 'Payment or an approved scholarship coupon is required before this examination can be launched.';
    end if;
    raise exception 'You have not been granted access to this examination.';
  end if;
  if v_assignment.status <> 'assigned' then raise exception 'This examination access is not active.'; end if;
  if v_assignment.available_from is not null and v_assignment.available_from > now() then raise exception 'This examination access is not yet available.'; end if;
  if v_assignment.expires_at is not null and v_assignment.expires_at <= now() then
    update public.exam_assignments set status = 'expired' where id = v_assignment.id;
    raise exception 'This examination access has expired.';
  end if;

  update public.exam_sessions set status = 'expired', updated_at = now()
  where assignment_id = v_assignment.id and status = 'active' and expires_at <= now();
  select * into v_session from public.exam_sessions
  where assignment_id = v_assignment.id and status = 'active'
  order by started_at desc limit 1;

  if not found then
    select count(*) into v_attempt_count from public.attempts
    where examination_id = p_examination_id and candidate_id = v_candidate_id;
    v_max_attempts := coalesce(v_assignment.max_attempts_override, v_exam.max_attempts);
    if v_attempt_count >= v_max_attempts then
      update public.exam_assignments set status = 'completed' where id = v_assignment.id;
      raise exception 'The maximum number of attempts has been reached.';
    end if;
    v_expiry := now() + make_interval(mins => v_exam.duration_minutes);
    if v_exam.ends_at is not null then v_expiry := least(v_expiry, v_exam.ends_at); end if;
    if v_assignment.expires_at is not null then v_expiry := least(v_expiry, v_assignment.expires_at); end if;
    insert into public.exam_sessions(assignment_id, examination_id, candidate_id, expires_at, client_fingerprint)
    values (v_assignment.id, p_examination_id, v_candidate_id, v_expiry, coalesce(p_client_fingerprint, '{}'::jsonb))
    returning * into v_session;
  end if;

  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'course', p.code,
    'durationMinutes', greatest(1, ceil(extract(epoch from (v_session.expires_at - now())) / 60.0)::integer),
    'questionCount', (select count(*) from public.questions q where q.examination_id = e.id and q.is_active),
    'description', coalesce(p.description, e.instructions, ''),
    'sessionId', v_session.id, 'expiresAt', v_session.expires_at, 'assignmentId', v_assignment.id,
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.question_text,
      'options', coalesce((select jsonb_agg(qo.option_text order by qo.position)
        from public.question_options qo where qo.question_id = q.id), '[]'::jsonb)
    ) order by q.position) from public.questions q
      where q.examination_id = e.id and q.is_active), '[]'::jsonb)
  ) into v_test
  from public.examinations e join public.programmes p on p.id = e.programme_id
  where e.id = p_examination_id;
  return v_test;
end;
$$;

-- Administrator directory. It returns only operational identity/profile fields,
-- never authentication secrets or protected examination answers.
create or replace function public.get_agilecert_people_directory(
  p_search text default null,
  p_role text default null,
  p_status text default null,
  p_profile_state text default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_result jsonb;
begin
  if not public.is_exam_admin() then raise exception 'Administrator access is required.'; end if;

  with filtered as (
    select
      p.id, p.full_name, p.email, p.role, p.candidate_code, p.phone, p.is_active,
      p.created_at, p.updated_at, au.email_confirmed_at, au.last_sign_in_at,
      cp.country_code, cp.preferred_currency, cp.timezone, cp.professional_headline,
      cp.employer, cp.industry, cp.marketing_consent, cp.certificate_email_updates,
      cp.course_recommendation_emails, cp.profile_update_required,
      cp.onboarding_completed_at, cp.updated_at as profile_updated_at,
      public.agilecert_candidate_profile_is_complete(p.id) as onboarding_complete,
      count(*) over() as total_count
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join public.agilecert_candidate_profiles cp on cp.user_id = p.id
    where
      (nullif(trim(coalesce(p_search, '')), '') is null
        or p.full_name ilike '%' || trim(p_search) || '%'
        or p.email ilike '%' || trim(p_search) || '%'
        or coalesce(p.candidate_code, '') ilike '%' || trim(p_search) || '%')
      and (nullif(trim(coalesce(p_role, '')), '') is null or p_role = 'all' or p.role = p_role)
      and (nullif(trim(coalesce(p_status, '')), '') is null or p_status = 'all'
        or (p_status = 'active' and p.is_active) or (p_status = 'inactive' and not p.is_active))
      and (nullif(trim(coalesce(p_profile_state, '')), '') is null or p_profile_state = 'all'
        or (p_profile_state = 'complete' and p.role = 'candidate' and public.agilecert_candidate_profile_is_complete(p.id))
        or (p_profile_state = 'incomplete' and p.role = 'candidate' and not public.agilecert_candidate_profile_is_complete(p.id))
        or (p_profile_state = 'staff' and p.role <> 'candidate'))
    order by p.created_at desc, p.full_name
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', coalesce(max(total_count), 0),
    'records', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'fullName', full_name, 'email', email, 'role', role,
      'candidateCode', candidate_code, 'phone', coalesce(phone, ''), 'isActive', is_active,
      'createdAt', created_at, 'updatedAt', updated_at, 'emailConfirmedAt', email_confirmed_at,
      'lastSignInAt', last_sign_in_at, 'countryCode', country_code,
      'preferredCurrency', preferred_currency, 'timezone', timezone,
      'professionalHeadline', professional_headline, 'employer', employer, 'industry', industry,
      'marketingConsent', coalesce(marketing_consent, false),
      'certificateEmailUpdates', coalesce(certificate_email_updates, true),
      'courseRecommendationEmails', coalesce(course_recommendation_emails, true),
      'profileUpdateRequired', coalesce(profile_update_required, role = 'candidate'),
      'onboardingComplete', case when role = 'candidate' then onboarding_complete else true end,
      'onboardingCompletedAt', onboarding_completed_at, 'profileUpdatedAt', profile_updated_at,
      'programmeCodes', coalesce((select to_jsonb(array(
        select distinct pr.code from public.exam_assignments ea
        join public.examinations ex on ex.id = ea.examination_id
        join public.programmes pr on pr.id = ex.programme_id
        where ea.candidate_id = filtered.id order by pr.code
      ))), '[]'::jsonb)
    ) order by created_at desc, full_name), '[]'::jsonb)
  ) into v_result
  from filtered;

  return coalesce(v_result, jsonb_build_object('total', 0, 'records', '[]'::jsonb));
end;
$$;

create or replace function public.update_agilecert_person_admin(
  p_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_role text default null,
  p_is_active boolean default null,
  p_require_profile_update boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.current_user_role();
  v_target public.profiles%rowtype;
begin
  if v_role <> 'super_admin' then raise exception 'Only a Super Administrator may change account authority.'; end if;
  if p_user_id = v_actor and coalesce(p_is_active, true) = false then raise exception 'You cannot suspend your own Super Administrator account.'; end if;
  if p_role is not null and p_role not in ('candidate', 'auditor', 'exam_admin', 'super_admin') then raise exception 'Unsupported portal role.'; end if;

  update public.profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    phone = case when p_phone is null then phone else nullif(trim(p_phone), '') end,
    role = coalesce(p_role, role),
    is_active = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = p_user_id
  returning * into v_target;
  if not found then raise exception 'The selected portal account was not found.'; end if;

  if v_target.role = 'candidate' then
    insert into public.agilecert_candidate_profiles(user_id, legal_name, phone, profile_update_required)
    values (v_target.id, v_target.full_name, v_target.phone, coalesce(p_require_profile_update, true))
    on conflict (user_id) do update set
      legal_name = excluded.legal_name,
      phone = excluded.phone,
      profile_update_required = coalesce(p_require_profile_update, public.agilecert_candidate_profiles.profile_update_required),
      onboarding_completed_at = case when coalesce(p_require_profile_update, false) then null else public.agilecert_candidate_profiles.onboarding_completed_at end,
      updated_at = now();
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'update_portal_person', 'profile', p_user_id::text,
    jsonb_build_object('role', v_target.role, 'isActive', v_target.is_active,
      'requireProfileUpdate', p_require_profile_update));

  return jsonb_build_object('id', v_target.id, 'fullName', v_target.full_name,
    'email', v_target.email, 'role', v_target.role, 'isActive', v_target.is_active);
end;
$$;

-- Extend the existing provider queue with administrator-authored messages.
alter table public.agilecert_communication_outbox
  drop constraint if exists agilecert_communication_outbox_message_type_check;
alter table public.agilecert_communication_outbox
  add constraint agilecert_communication_outbox_message_type_check
  check (message_type in (
    'preparation_material_ready', 'certificate_offer_immediate', 'certificate_offer_day_2',
    'certificate_offer_day_5', 'certificate_offer_day_7', 'certificate_purchase_confirmation',
    'credential_ready', 'course_recommendation', 'admin_message'
  ));

create or replace function public.queue_agilecert_admin_message(
  p_recipient_ids uuid[],
  p_subject text,
  p_body text,
  p_category text default 'operational',
  p_group_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_subject text := trim(coalesce(p_subject, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_category text := lower(trim(coalesce(p_category, 'operational')));
  v_profile record;
  v_outbox_id uuid;
  v_queued integer := 0;
  v_skipped integer := 0;
begin
  if not public.is_exam_admin() then raise exception 'Administrator access is required.'; end if;
  if coalesce(array_length(p_recipient_ids, 1), 0) < 1 then raise exception 'Select at least one recipient.'; end if;
  if array_length(p_recipient_ids, 1) > 500 then raise exception 'A maximum of 500 recipients may be queued at once.'; end if;
  if length(v_subject) < 3 or length(v_subject) > 180 then raise exception 'Subject must contain between 3 and 180 characters.'; end if;
  if length(v_body) < 10 or length(v_body) > 10000 then raise exception 'Message must contain between 10 and 10,000 characters.'; end if;
  if v_category not in ('operational', 'marketing') then raise exception 'Message category must be operational or marketing.'; end if;

  for v_profile in
    select distinct p.id, p.full_name, lower(trim(p.email)) as email, p.role,
      coalesce(cp.marketing_consent, false) as marketing_consent,
      coalesce(pref.course_recommendations, true) as course_recommendations
    from public.profiles p
    left join public.agilecert_candidate_profiles cp on cp.user_id = p.id
    left join public.agilecert_communication_preferences pref on pref.candidate_id = p.id
    where p.id = any(p_recipient_ids) and p.is_active = true and p.email like '%@%'
  loop
    if v_category = 'marketing' and v_profile.role = 'candidate'
       and (not v_profile.marketing_consent or not v_profile.course_recommendations) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.agilecert_communication_outbox(
      candidate_id, recipient_email, recipient_email_hash, message_type, category,
      event_key, due_at, status, subject, payload
    ) values (
      v_profile.id, v_profile.email,
      encode(extensions.digest(v_profile.email, 'sha256'), 'hex'),
      'admin_message', v_category,
      'admin-message:' || gen_random_uuid()::text, now(), 'queued', v_subject,
      jsonb_build_object(
        'subject', v_subject, 'body', v_body, 'recipientName', v_profile.full_name,
        'groupLabel', nullif(trim(coalesce(p_group_label, '')), ''),
        'senderId', v_actor, 'senderName', (select full_name from public.profiles where id = v_actor)
      )
    ) returning id into v_outbox_id;

    insert into public.agilecert_communication_events(outbox_id, candidate_id, event_type, metadata)
    values (v_outbox_id, v_profile.id, 'queued', jsonb_build_object('source', 'admin_people_messaging'));
    v_queued := v_queued + 1;
  end loop;

  insert into public.audit_logs(actor_id, action, entity_type, metadata)
  values (v_actor, 'queue_admin_message', 'communication_campaign',
    jsonb_build_object('subject', v_subject, 'category', v_category,
      'groupLabel', p_group_label, 'queued', v_queued, 'skipped', v_skipped));

  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped,
    'category', v_category, 'subject', v_subject);
end;
$$;

revoke all on function public.agilecert_candidate_profile_is_complete(uuid) from public, anon, authenticated;
revoke all on function public.get_my_agilecert_onboarding_status() from public, anon, authenticated;
revoke all on function public.complete_my_agilecert_candidate_onboarding(text, text, text, text, text, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.get_agilecert_people_directory(text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.update_agilecert_person_admin(uuid, text, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.queue_agilecert_admin_message(uuid[], text, text, text, text) from public, anon, authenticated;

grant execute on function public.get_my_agilecert_onboarding_status() to authenticated;
grant execute on function public.complete_my_agilecert_candidate_onboarding(text, text, text, text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.get_agilecert_people_directory(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.update_agilecert_person_admin(uuid, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.queue_agilecert_admin_message(uuid[], text, text, text, text) to authenticated;
revoke all on function public.start_exam_secure(uuid, jsonb) from public;
grant execute on function public.start_exam_secure(uuid, jsonb) to authenticated;

comment on function public.get_my_agilecert_onboarding_status() is
  'Returns the authenticated candidate mandatory profile onboarding status.';
comment on function public.get_agilecert_people_directory(text, text, text, text, integer, integer) is
  'Returns an administrator-authorised operational directory of portal people and profile completion.';
comment on function public.queue_agilecert_admin_message(uuid[], text, text, text, text) is
  'Queues auditable individual, selected or group administrator email through the existing communications outbox.';

commit;
