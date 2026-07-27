\set ON_ERROR_STOP on

begin;

do $$
declare
  v_candidate uuid := '00000000-0000-0000-0000-00000000c201';
  v_other_candidate uuid := '00000000-0000-0000-0000-00000000c202';
  v_admin uuid := '00000000-0000-0000-0000-00000000a201';
  v_programme uuid := '00000000-0000-0000-0000-00000000b201';
  v_exam uuid := '00000000-0000-0000-0000-00000000e201';
  v_next_exam uuid := '00000000-0000-0000-0000-00000000e202';
  v_assignment uuid := '00000000-0000-0000-0000-00000000d201';
  v_session uuid := '00000000-0000-0000-0000-00000000d202';
  v_attempt uuid := '00000000-0000-0000-0000-00000000d203';
  v_eligibility uuid;
  v_exam_order uuid := '00000000-0000-0000-0000-00000000d205';
  v_certificate_order uuid := '00000000-0000-0000-0000-00000000d206';
  v_certificate uuid := '00000000-0000-0000-0000-00000000d207';
  v_credential uuid := '00000000-0000-0000-0000-00000000d208';
  v_claimed integer;
  v_sent_reminder uuid;
  v_sent_material uuid;
  v_refresh jsonb;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_candidate, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'communications-candidate@example.test', crypt('temporary-password', gen_salt('bf')), now(),
      '{}'::jsonb, jsonb_build_object('full_name', 'Communications Candidate'), now(), now()),
    (v_other_candidate, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'communications-other@example.test', crypt('temporary-password', gen_salt('bf')), now(),
      '{}'::jsonb, jsonb_build_object('full_name', 'Other Candidate'), now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'communications-admin@example.test', crypt('temporary-password', gen_salt('bf')), now(),
      '{}'::jsonb, jsonb_build_object('full_name', 'Communications Admin'), now(), now());

  update public.profiles set role = 'candidate', is_active = true
  where id in (v_candidate, v_other_candidate);
  update public.profiles set role = 'super_admin', is_active = true where id = v_admin;

  insert into public.programmes(id, code, name, description, created_by)
  values (v_programme, 'COMM-TEST', 'Communications Test Programme',
    'Validation programme for automated communications.', v_admin);

  insert into public.examinations(
    id, programme_id, title, duration_minutes, pass_mark, status,
    max_attempts, randomize_questions, randomize_options, created_by
  ) values
    (v_exam, v_programme, 'Communications Automation Examination', 60, 70, 'published', 1, false, false, v_admin),
    (v_next_exam, v_programme, 'Advanced Communications Leadership', 60, 70, 'published', 1, false, false, v_admin);

  insert into public.exam_assignments(
    id, examination_id, candidate_id, assigned_by, status
  ) values (v_assignment, v_exam, v_candidate, v_admin, 'completed');

  insert into public.exam_sessions(
    id, assignment_id, examination_id, candidate_id, status,
    started_at, expires_at, submitted_at
  ) values (
    v_session, v_assignment, v_exam, v_candidate, 'submitted',
    now() - interval '1 hour', now() + interval '1 hour', now() - interval '10 minutes'
  );

  insert into public.attempts(
    id, session_id, examination_id, candidate_id, raw_score, maximum_score,
    percentage, status, suspicious_score, started_at, submitted_at, graded_at
  ) values (
    v_attempt, v_session, v_exam, v_candidate, 82, 100,
    82, 'submitted', 0, now() - interval '1 hour',
    now() - interval '10 minutes', now() - interval '9 minutes'
  );

  insert into public.agilecert_certificate_eligibility_records(
    candidate_id, examination_id, attempt_id, score, pass_mark,
    suspicious_score, attempt_status, integrity_status, eligibility_status,
    reason_code, evaluated_at
  ) values (
    v_candidate, v_exam, v_attempt, 82, 70,
    0, 'submitted', 'cleared', 'eligible', 'passed', now() - interval '9 minutes'
  )
  on conflict (attempt_id) do update set
    candidate_id = excluded.candidate_id,
    examination_id = excluded.examination_id,
    score = excluded.score,
    pass_mark = excluded.pass_mark,
    suspicious_score = excluded.suspicious_score,
    attempt_status = excluded.attempt_status,
    integrity_status = excluded.integrity_status,
    eligibility_status = excluded.eligibility_status,
    reason_code = excluded.reason_code,
    evaluated_at = excluded.evaluated_at,
    updated_at = now()
  returning id into v_eligibility;

  insert into public.exam_orders(
    id, reference, candidate_id, examination_id, currency,
    list_amount_minor, discount_amount_minor, payable_amount_minor,
    status, paid_at, fulfilled_at
  ) values (
    v_exam_order, 'COMM-EXAM-ORDER-001', v_candidate, v_exam, 'NGN',
    2500000, 0, 2500000, 'paid', now() - interval '30 minutes', now() - interval '29 minutes'
  );

  v_refresh := public.refresh_agilecert_communication_outbox(now());
  if (v_refresh->>'inserted')::integer <> 5 then
    raise exception 'Expected five initial communications, received %.', v_refresh;
  end if;

  if (select count(*) from public.agilecert_communication_outbox where candidate_id = v_candidate) <> 5 then
    raise exception 'Initial preparation and four certificate reminder records were not created.';
  end if;

  -- Provider-disabled state must never claim email.
  select count(*) into v_claimed
  from public.claim_agilecert_communication_outbox(40, now());
  if v_claimed <> 0 then
    raise exception 'Provider-disabled communication records were claimed.';
  end if;

  update public.agilecert_communication_settings
  set provider_enabled = true,
      from_email = 'verified-sender@example.test',
      reply_to_email = 'support@example.test';

  select count(*) into v_claimed
  from public.claim_agilecert_communication_outbox(40, now());
  if v_claimed <> 2 then
    raise exception 'Expected the preparation and immediate certificate records to be claimed, received %.', v_claimed;
  end if;

  select id into v_sent_material
  from public.agilecert_communication_outbox
  where candidate_id = v_candidate and message_type = 'preparation_material_ready';
  select id into v_sent_reminder
  from public.agilecert_communication_outbox
  where candidate_id = v_candidate and message_type = 'certificate_offer_immediate';

  perform public.complete_agilecert_communication_delivery(
    v_sent_material, true, 'resend', 'provider-material-001',
    'Preparation access ready', null, null, jsonb_build_object('mock', true)
  );
  perform public.complete_agilecert_communication_delivery(
    v_sent_reminder, true, 'resend', 'provider-reminder-001',
    'Certificate offer', null, null, jsonb_build_object('mock', true)
  );

  insert into public.agilecert_certificate_orders(
    id, reference, candidate_id, eligibility_id, product_code, currency,
    pricing_window, list_amount_minor, discount_amount_minor, payable_amount_minor,
    status, paid_at, fulfilled_at
  ) values (
    v_certificate_order, 'COMM-CERT-ORDER-001', v_candidate, v_eligibility,
    'achievement', 'NGN', 'early', 2000000, 0, 2000000,
    'paid', now(), now()
  );

  perform public.refresh_agilecert_communication_outbox(now());

  if (select count(*) from public.agilecert_communication_outbox
      where candidate_id = v_candidate and category = 'certificate_reminder'
        and status = 'cancelled') <> 3 then
    raise exception 'Future certificate reminders were not cancelled after verified purchase.';
  end if;

  if not exists (
    select 1 from public.agilecert_communication_outbox
    where event_key = 'certificate-purchase:' || v_certificate_order
  ) then
    raise exception 'Certificate purchase confirmation was not queued.';
  end if;

  if not exists (
    select 1 from public.agilecert_communication_events
    where outbox_id = v_sent_reminder and event_type = 'conversion'
  ) then
    raise exception 'Certificate purchase was not attributed to the sent reminder.';
  end if;

  update public.agilecert_certificate_eligibility_records
  set eligibility_status = 'issued', issued_at = now()
  where id = v_eligibility;

  insert into public.agilecert_issued_certificates(
    id, certificate_number, verification_code, candidate_id, eligibility_id,
    examination_id, attempt_id, holder_name, certificate_title,
    examination_title, programme_code, score, pass_mark, issued_by, status
  ) values (
    v_certificate, 'COMM-CERT-0001', 'COMM-VERIFY-0001', v_candidate, v_eligibility,
    v_exam, v_attempt, 'Communications Candidate', 'Certificate of Achievement',
    'Communications Automation Examination', 'COMM-TEST', 82, 70, v_admin, 'active'
  );

  insert into public.agilecert_paid_credentials(
    id, order_id, certificate_id, candidate_id, product_code,
    credential_code, badge_code, verification_url,
    linkedin_credential_name, status, issued_at
  ) values (
    v_credential, v_certificate_order, v_certificate, v_candidate, 'achievement',
    'COMM-CREDENTIAL-0001', 'COMM-BADGE-0001',
    'https://example.test/verify/COMM-CREDENTIAL-0001',
    'AgileCert Communications Automation', 'active', now()
  );

  perform public.refresh_agilecert_communication_outbox(now());

  if not exists (
    select 1 from public.agilecert_communication_outbox
    where event_key = 'credential-ready:' || v_credential
  ) or not exists (
    select 1 from public.agilecert_communication_outbox
    where event_key = 'course-recommendation:' || v_credential
  ) then
    raise exception 'Credential-ready and course-recommendation messages were not created.';
  end if;

  -- Candidate preference updates must cancel optional work only.
  perform set_config('request.jwt.claim.sub', v_candidate::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.update_my_agilecert_communication_preferences(false, false);

  if exists (
    select 1 from public.agilecert_communication_outbox
    where candidate_id = v_candidate
      and category in ('certificate_reminder', 'marketing')
      and status in ('queued', 'failed')
  ) then
    raise exception 'Optional queued messages survived candidate opt-out.';
  end if;

  if not exists (
    select 1 from public.agilecert_communication_outbox
    where candidate_id = v_candidate
      and category = 'operational'
      and status in ('queued', 'processing', 'sent')
  ) then
    raise exception 'Operational delivery was incorrectly removed by optional opt-out.';
  end if;

  perform public.record_agilecert_communication_provider_event(
    'provider-material-001', 'bounced',
    encode(extensions.digest('communications-candidate@example.test', 'sha256'), 'hex'),
    jsonb_build_object('mock', true)
  );

  if not exists (
    select 1 from public.agilecert_communication_suppressions
    where email_hash = encode(extensions.digest('communications-candidate@example.test', 'sha256'), 'hex')
      and reason = 'hard_bounce' and scope = 'all_email' and active
  ) then
    raise exception 'Hard-bounce suppression was not created.';
  end if;
end;
$$;

-- Browser roles may read only their own preference row, never outbox or events.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c202', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (select count(*) from public.agilecert_communication_preferences) <> 0 then
    raise exception 'A candidate could read another candidate communication preferences.';
  end if;

  if has_table_privilege('authenticated', 'public.agilecert_communication_outbox', 'SELECT')
     or has_table_privilege('authenticated', 'public.agilecert_communication_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.agilecert_communication_suppressions', 'SELECT')
     or has_table_privilege('authenticated', 'public.agilecert_communication_outbox', 'INSERT')
     or has_table_privilege('authenticated', 'public.agilecert_communication_preferences', 'UPDATE') then
    raise exception 'Authenticated browser roles received prohibited communications authority.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.refresh_agilecert_communication_outbox(timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_agilecert_communication_outbox(integer,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated browser roles received service-only delivery authority.';
  end if;
end;
$$;

reset role;
rollback;
