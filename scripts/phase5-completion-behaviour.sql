\set ON_ERROR_STOP on

begin;

do $$
declare
  v_admin_id uuid := '00000000-0000-0000-0000-00000000a005';
  v_candidate_id uuid := '00000000-0000-0000-0000-00000000c005';
  v_programme_id uuid := extensions.gen_random_uuid();
  v_exam_id uuid := extensions.gen_random_uuid();
  v_assignment_id uuid := extensions.gen_random_uuid();
  v_question_id uuid := extensions.gen_random_uuid();
  v_correct_option_id uuid := extensions.gen_random_uuid();
  v_wrong_option_id uuid := extensions.gen_random_uuid();
  v_session_id uuid;
  v_proctoring_session_id uuid;
  v_attempt_id uuid;
  v_incident_id uuid;
  v_case_id uuid;
  v_appeal_id uuid;
  v_result jsonb;
  v_payload jsonb;
  v_workspace jsonb;
  v_status text;
  v_decision text;
  v_score numeric;
  v_count integer;
  v_expected_error boolean;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (
      v_admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase5-admin@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 5 Administrator'), now(), now()
    ),
    (
      v_candidate_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase5-candidate@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 5 Candidate'), now(), now()
    );

  update public.profiles
  set role = 'super_admin', full_name = 'Phase 5 Administrator', is_active = true
  where id = v_admin_id;
  update public.profiles
  set role = 'candidate', full_name = 'Phase 5 Candidate', is_active = true
  where id = v_candidate_id;

  insert into public.programmes (id, code, name, description, is_active)
  values (
    v_programme_id,
    'P5-COMPLETE',
    'Original Phase 5 Completion Test',
    'Isolated identity, proctoring, misconduct and appeal lifecycle validation.',
    true
  );

  insert into public.examinations (
    id, programme_id, title, instructions, duration_minutes, pass_mark,
    status, max_attempts, randomize_questions, randomize_options,
    allow_self_enrollment
  ) values (
    v_exam_id, v_programme_id, 'Original Phase 5 Protected Examination',
    'Complete the protected examination under the configured integrity policy.',
    60, 70, 'published', 1, false, false, false
  );

  insert into public.questions (
    id, examination_id, question_text, question_type, position, points, is_active
  ) values (
    v_question_id, v_exam_id,
    'Which control keeps identity and proctoring decisions server authoritative?',
    'single_choice', 1, 1, true
  );

  insert into public.question_options (id, question_id, option_text, position)
  values
    (v_correct_option_id, v_question_id, 'Controlled authenticated RPCs and protected database rules', 1),
    (v_wrong_option_id, v_question_id, 'Unverified browser-only state', 2);

  insert into public.question_answer_keys (question_id, correct_option_id, explanation)
  values (
    v_question_id,
    v_correct_option_id,
    'Identity, risk and decision authority must remain on the server.'
  );

  insert into public.exam_assignments (
    id, examination_id, candidate_id, assigned_by, available_from,
    expires_at, max_attempts_override, status
  ) values (
    v_assignment_id, v_exam_id, v_candidate_id, v_admin_id,
    now() - interval '1 minute', now() + interval '1 day', 1, 'assigned'
  );

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.upsert_agilecert_identity_proctoring_policy(
    v_exam_id,
    'phase5-completion-v1',
    'This isolated notice authorises privacy-bounded identity and live proctoring processing for examination integrity validation only.',
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    40,
    60,
    365,
    365,
    730,
    14,
    true
  );

  if (v_result->>'active')::boolean is not true then
    raise exception 'The protected Phase 5 policy was not activated: %', v_result;
  end if;

  v_expected_error := false;
  begin
    perform public.upsert_agilecert_identity_proctoring_policy(
      v_exam_id,
      'phase5-forbidden-automated-processing',
      'This notice is intentionally used to verify that unapproved automated biometric processing cannot be enabled.',
      false, true, true, false, true, false, false,
      true, true, true, true, true, true,
      40, 60, 365, 365, 730, 14, true
    );
  exception when others then
    if position('remain disabled' in sqlerrm) > 0 then
      v_expected_error := true;
    else
      raise;
    end if;
  end;
  if not v_expected_error then
    raise exception 'External KYC or automated biometric processing was enabled unexpectedly.';
  end if;

  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.record_my_agilecert_identity_proctoring_consent(
    v_exam_id,
    true,
    true,
    false,
    false,
    false,
    false,
    jsonb_build_object('test', 'phase5-completion')
  );

  if nullif(v_result->>'id', '') is null then
    raise exception 'Candidate consent was not recorded: %', v_result;
  end if;

  v_payload := public.start_exam_secure(
    v_exam_id,
    jsonb_build_object('test', 'phase5-completion', 'browser', 'isolated')
  );
  v_session_id := nullif(v_payload->>'sessionId', '')::uuid;

  if v_session_id is null then
    raise exception 'The protected secure examination session was not created: %', v_payload;
  end if;
  if coalesce((v_payload->>'proctorPreflightRequired')::boolean, false) is not true then
    raise exception 'Protected examination did not require server-authorised preflight: %', v_payload;
  end if;
  if jsonb_array_length(coalesce(v_payload->'questions', '[]'::jsonb)) <> 0 then
    raise exception 'Questions were exposed before proctoring preflight: %', v_payload;
  end if;

  v_expected_error := false;
  begin
    perform public.get_my_agilecert_proctored_exam_payload(v_session_id);
  exception when others then
    if position('Open the live proctoring session' in sqlerrm) > 0 then
      v_expected_error := true;
    else
      raise;
    end if;
  end;
  if not v_expected_error then
    raise exception 'Question payload was available before the live proctoring session opened.';
  end if;

  v_result := public.open_my_agilecert_proctoring_session(
    v_session_id,
    'not_requested',
    'not_requested',
    'not_requested',
    jsonb_build_object('test', 'phase5-completion')
  );
  v_proctoring_session_id := nullif(v_result->>'id', '')::uuid;

  if v_proctoring_session_id is null or v_result->>'status' <> 'active' then
    raise exception 'The live proctoring session was not opened: %', v_result;
  end if;

  v_payload := public.get_my_agilecert_proctored_exam_payload(v_session_id);
  if jsonb_array_length(coalesce(v_payload->'questions', '[]'::jsonb)) <> 1 then
    raise exception 'Questions were not released after authorised preflight: %', v_payload;
  end if;
  if coalesce((v_payload->>'proctorPreflightRequired')::boolean, true) is not false then
    raise exception 'The hydrated protected payload still requires preflight: %', v_payload;
  end if;

  v_expected_error := false;
  begin
    perform public.record_my_agilecert_proctoring_event(
      v_proctoring_session_id,
      'privacy-forbidden-event',
      'browser_focus_lost',
      'high',
      'This event intentionally attempts to include prohibited answer metadata.',
      jsonb_build_object('answer', 'must-not-be-stored'),
      now()
    );
  exception when others then
    if position('must not contain examination questions, answers or answer keys' in sqlerrm) > 0 then
      v_expected_error := true;
    else
      raise;
    end if;
  end;
  if not v_expected_error then
    raise exception 'Prohibited question or answer metadata was accepted in a proctor event.';
  end if;

  perform public.record_my_agilecert_proctoring_event(
    v_proctoring_session_id,
    'phase5-high-event-1',
    'browser_focus_lost',
    'high',
    'The examination window lost focus during isolated validation.',
    jsonb_build_object('source', 'behaviour_test'),
    now()
  );
  perform public.record_my_agilecert_proctoring_event(
    v_proctoring_session_id,
    'phase5-high-event-2',
    'clipboard_copy',
    'high',
    'Clipboard copy activity was detected during isolated validation.',
    jsonb_build_object('source', 'behaviour_test'),
    now()
  );

  select risk_score into v_score
  from public.agilecert_proctoring_sessions
  where id = v_proctoring_session_id;
  if v_score < 40 then
    raise exception 'Server-authoritative proctoring risk did not reach the configured threshold: %', v_score;
  end if;

  select i.id, m.id
  into v_incident_id, v_case_id
  from public.agilecert_proctoring_incidents i
  join public.agilecert_misconduct_cases m on m.incident_id = i.id
  where i.proctoring_session_id = v_proctoring_session_id;

  if v_incident_id is null or v_case_id is null then
    raise exception 'Threshold risk did not create an incident and misconduct case.';
  end if;

  v_result := public.submit_exam_secure(
    v_session_id,
    jsonb_build_object(v_question_id::text, 0),
    '[]'::jsonb,
    0
  );
  v_attempt_id := nullif(v_result->>'id', '')::uuid;

  if v_attempt_id is null then
    raise exception 'The protected examination was not submitted: %', v_result;
  end if;
  if v_result->>'status' <> 'flagged' then
    raise exception 'Submission response did not expose the authoritative result hold: %', v_result;
  end if;

  select status, percentage into v_status, v_score
  from public.attempts
  where id = v_attempt_id;
  if v_status <> 'flagged' or v_score <> 100 then
    raise exception 'The held attempt status or score is invalid: status %, score %', v_status, v_score;
  end if;

  if not exists (
    select 1 from public.agilecert_proctoring_incidents
    where id = v_incident_id and attempt_id = v_attempt_id
  ) or not exists (
    select 1 from public.agilecert_misconduct_cases
    where id = v_case_id and attempt_id = v_attempt_id and result_hold = true
  ) then
    raise exception 'The submitted attempt was not linked to the incident and result hold.';
  end if;

  v_result := public.submit_my_agilecert_incident_explanation(
    v_incident_id,
    'The focus and clipboard events were deliberately generated by the isolated Phase 5 lifecycle validation.'
  );
  if v_result->>'status' <> 'under_investigation' then
    raise exception 'Candidate incident explanation did not move the case into investigation: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.decide_agilecert_misconduct_case(
    v_case_id,
    'flag_attempt',
    'The first decision retains the integrity flag so the candidate appeal workflow can be validated.',
    null
  );
  if v_result->>'decision' <> 'flag_attempt' or (v_result->>'resultHold')::boolean is not false then
    raise exception 'The administrator misconduct decision was not recorded correctly: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.submit_my_agilecert_misconduct_appeal(
    v_case_id,
    'The recorded browser events were generated by the authorised isolated validation and do not represent candidate misconduct.',
    'Original Phase 5 automated lifecycle evidence'
  );
  v_appeal_id := nullif(v_result->>'id', '')::uuid;
  if v_appeal_id is null or v_result->>'status' <> 'submitted' then
    raise exception 'The candidate appeal was not submitted: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.decide_agilecert_misconduct_appeal(
    v_appeal_id,
    'upheld',
    'The isolated evidence confirms no actual candidate violation and releases the examination result.',
    'no_violation'
  );
  if v_result->>'status' <> 'upheld' or v_result->>'replacementDecision' <> 'no_violation' then
    raise exception 'The appeal outcome was not recorded correctly: %', v_result;
  end if;

  select status, percentage into v_status, v_score
  from public.attempts
  where id = v_attempt_id;
  if v_status <> 'submitted' or v_score <> 100 then
    raise exception 'The upheld appeal did not restore a completed valid attempt: status %, score %', v_status, v_score;
  end if;

  select decision into v_decision
  from public.agilecert_misconduct_cases
  where id = v_case_id and status = 'closed' and result_hold = false;
  if v_decision <> 'no_violation' then
    raise exception 'The closed misconduct case does not carry the replacement no-violation decision: %', v_decision;
  end if;

  if not exists (
    select 1
    from public.agilecert_certificate_eligibility_records er
    where er.attempt_id = v_attempt_id
      and er.integrity_status = 'cleared'
      and er.eligibility_status = 'eligible'
  ) then
    raise exception 'The cleared appeal did not restore Phase 3 certificate eligibility.';
  end if;

  if not exists (
    select 1
    from public.question_answer_keys ak
    where ak.question_id = v_question_id and ak.correct_option_id = v_correct_option_id
  ) then
    raise exception 'The Phase 5 lifecycle changed a protected answer key.';
  end if;

  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_workspace := public.get_my_agilecert_identity_proctoring_workspace();
  if position('documentNumberDigest' in v_workspace::text) > 0
     or position('document_number_digest' in v_workspace::text) > 0 then
    raise exception 'Sensitive government identity digest leaked into the candidate workspace.';
  end if;

  select count(*) into v_count
  from public.agilecert_identity_proctoring_audits
  where candidate_id = v_candidate_id
    and action in (
      'candidate_consent_recorded',
      'proctoring_session_opened',
      'automatic_incident_created',
      'candidate_explanation_submitted',
      'misconduct_decision_issued',
      'candidate_appeal_submitted',
      'appeal_decided'
    );
  if v_count < 7 then
    raise exception 'The complete Phase 5 audit trail is incomplete: % expected lifecycle events found.', v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_sensitive_identity_documents'
      and column_name in ('document_number', 'raw_document_number')
  ) then
    raise exception 'A raw government identity number column exists unexpectedly.';
  end if;

  raise notice 'Original Phase 5 lifecycle validation passed: attempt %, incident %, case %, appeal %.',
    v_attempt_id, v_incident_id, v_case_id, v_appeal_id;
end;
$$;

rollback;
