begin;

-- Original Roadmap Phase 5 completion, unit 5 of 6:
-- candidate and administrator RPC workspaces and controlled lifecycle decisions.

create or replace function public.record_my_agilecert_identity_proctoring_consent(
  p_examination_id uuid,
  p_identity_processing_accepted boolean,
  p_proctoring_processing_accepted boolean,
  p_camera_permission_accepted boolean default false,
  p_microphone_permission_accepted boolean default false,
  p_fullscreen_monitoring_accepted boolean default false,
  p_automated_processing_accepted boolean default false,
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then raise exception 'An active candidate account is required.'; end if;

  select * into v_policy from public.agilecert_identity_proctoring_policies
  where examination_id = p_examination_id and active = true;
  if not found then raise exception 'The examination identity and proctoring policy is unavailable.'; end if;

  if not coalesce(p_identity_processing_accepted, false)
     or not coalesce(p_proctoring_processing_accepted, false) then
    raise exception 'Identity and proctoring processing consent is required for this examination.';
  end if;
  if v_policy.require_camera and not coalesce(p_camera_permission_accepted, false) then
    raise exception 'Camera permission consent is required for this examination.';
  end if;
  if v_policy.require_microphone_permission and not coalesce(p_microphone_permission_accepted, false) then
    raise exception 'Microphone permission consent is required for this examination.';
  end if;
  if v_policy.require_fullscreen and not coalesce(p_fullscreen_monitoring_accepted, false) then
    raise exception 'Fullscreen monitoring consent is required for this examination.';
  end if;
  if (v_policy.external_kyc_enabled or v_policy.automated_face_match_enabled or v_policy.liveness_check_enabled)
     and not coalesce(p_automated_processing_accepted, false) then
    raise exception 'Automated identity-processing consent is required by the active policy.';
  end if;

  insert into public.agilecert_identity_proctoring_consents (
    candidate_id, examination_id, policy_version, consent_version,
    identity_processing_accepted, proctoring_processing_accepted,
    camera_permission_accepted, microphone_permission_accepted,
    fullscreen_monitoring_accepted, automated_processing_accepted,
    notice_snapshot, accepted_at, withdrawn_at, withdrawal_reason, client_fingerprint
  ) values (
    v_candidate_id, p_examination_id, v_policy.policy_version, v_policy.consent_version,
    true, true,
    coalesce(p_camera_permission_accepted, false),
    coalesce(p_microphone_permission_accepted, false),
    coalesce(p_fullscreen_monitoring_accepted, false),
    coalesce(p_automated_processing_accepted, false),
    v_policy.privacy_notice, now(), null, null, coalesce(p_client_fingerprint, '{}'::jsonb)
  )
  on conflict (candidate_id, examination_id, policy_version, consent_version)
  do update set
    identity_processing_accepted = excluded.identity_processing_accepted,
    proctoring_processing_accepted = excluded.proctoring_processing_accepted,
    camera_permission_accepted = excluded.camera_permission_accepted,
    microphone_permission_accepted = excluded.microphone_permission_accepted,
    fullscreen_monitoring_accepted = excluded.fullscreen_monitoring_accepted,
    automated_processing_accepted = excluded.automated_processing_accepted,
    notice_snapshot = excluded.notice_snapshot,
    accepted_at = now(), withdrawn_at = null, withdrawal_reason = null,
    client_fingerprint = excluded.client_fingerprint, updated_at = now()
  returning * into v_consent;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, entity_type, entity_id, action, metadata
  ) values (
    v_candidate_id, v_candidate_id, p_examination_id, 'consent', v_consent.id,
    'candidate_consent_recorded',
    jsonb_build_object('policyVersion', v_policy.policy_version, 'consentVersion', v_policy.consent_version)
  );

  return jsonb_build_object(
    'id', v_consent.id, 'examinationId', v_consent.examination_id,
    'policyVersion', v_consent.policy_version, 'consentVersion', v_consent.consent_version,
    'acceptedAt', v_consent.accepted_at
  );
end;
$$;

create or replace function public.submit_my_agilecert_sensitive_identity(
  p_examination_id uuid,
  p_document_type text,
  p_document_number text,
  p_issuer_country text,
  p_issued_on date,
  p_expires_on date,
  p_document_object_path text,
  p_document_filename text,
  p_document_mime_type text,
  p_document_size_bytes bigint,
  p_selfie_object_path text default null,
  p_selfie_filename text default null,
  p_selfie_mime_type text default null,
  p_selfie_size_bytes bigint default null,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, extensions
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
  v_previous public.agilecert_sensitive_identity_documents%rowtype;
  v_created public.agilecert_sensitive_identity_documents%rowtype;
  v_number text := regexp_replace(upper(trim(coalesce(p_document_number, ''))), '[^A-Z0-9]', '', 'g');
  v_digest text;
  v_last4 text;
  v_doc_type text := lower(trim(coalesce(p_document_type, '')));
  v_country text := upper(trim(coalesce(p_issuer_country, '')));
  v_doc_path text := trim(coalesce(p_document_object_path, ''));
  v_selfie_path text := nullif(trim(coalesce(p_selfie_object_path, '')), '');
  v_duplicate boolean := false;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then raise exception 'An active candidate account is required.'; end if;
  if not coalesce(p_attestation, false) then raise exception 'Confirm the identity-data accuracy and privacy attestation.'; end if;

  select * into v_policy from public.agilecert_identity_proctoring_policies
  where examination_id = p_examination_id and active = true;
  if not found then raise exception 'The examination identity policy is unavailable.'; end if;

  select * into v_consent
  from public.agilecert_identity_proctoring_consents
  where candidate_id = v_candidate_id and examination_id = p_examination_id
    and policy_version = v_policy.policy_version and consent_version = v_policy.consent_version
    and withdrawn_at is null
  order by accepted_at desc limit 1;
  if not found then raise exception 'Accept the current identity and proctoring consent before submitting sensitive identity evidence.'; end if;

  if v_doc_type not in ('passport','national_identity','driving_licence','voter_identity','residence_permit','other_government_identity') then
    raise exception 'Select a supported government identity document type.';
  end if;
  if length(v_number) < 4 or length(v_number) > 64 then raise exception 'Enter a valid government identity document number.'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'Issuer country must be a two-letter country code.'; end if;
  if p_expires_on is not null and p_expires_on <= current_date then raise exception 'The government identity document is expired.'; end if;
  if p_issued_on is not null and p_expires_on is not null and p_expires_on <= p_issued_on then raise exception 'Document expiry must be after its issue date.'; end if;
  if lower(coalesce(p_document_mime_type, '')) not in ('application/pdf','image/jpeg','image/png') then raise exception 'Government identity evidence must be PDF, JPG or PNG.'; end if;
  if coalesce(p_document_size_bytes, 0) < 1 or p_document_size_bytes > 12582912 then raise exception 'Government identity evidence must not exceed 12 MB.'; end if;
  if v_doc_path !~ ('^' || v_candidate_id::text || '/[A-Za-z0-9._/-]+$') then raise exception 'The government identity file path is not owned by the signed-in candidate.'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'agilecert-sensitive-identity' and o.name = v_doc_path) then raise exception 'The private government identity upload was not found.'; end if;

  if v_policy.require_selfie and v_selfie_path is null then raise exception 'A candidate selfie is required by the active examination policy.'; end if;
  if v_selfie_path is not null then
    if v_selfie_path !~ ('^' || v_candidate_id::text || '/[A-Za-z0-9._/-]+$') then raise exception 'The selfie file path is not owned by the signed-in candidate.'; end if;
    if lower(coalesce(p_selfie_mime_type, '')) not in ('image/jpeg','image/png') then raise exception 'The selfie must be JPG or PNG.'; end if;
    if coalesce(p_selfie_size_bytes, 0) < 1 or p_selfie_size_bytes > 12582912 then raise exception 'The selfie must not exceed 12 MB.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'agilecert-sensitive-identity' and o.name = v_selfie_path) then raise exception 'The private selfie upload was not found.'; end if;
  end if;

  v_digest := encode(extensions.digest(v_number, 'sha256'), 'hex');
  v_last4 := right(v_number, least(4, length(v_number)));
  select exists (
    select 1 from public.agilecert_sensitive_identity_documents d
    where d.document_number_digest = v_digest and d.issuer_country = v_country
      and d.candidate_id <> v_candidate_id and d.status not in ('withdrawn','deleted')
  ) into v_duplicate;

  select * into v_previous from public.agilecert_sensitive_identity_documents
  where candidate_id = v_candidate_id
    and status in ('draft','submitted','under_review','changes_requested','approved')
  order by created_at desc limit 1 for update;
  if found and v_previous.status in ('submitted','under_review','approved') then
    raise exception 'Withdraw or complete the current sensitive identity review before submitting another.';
  end if;
  if found then
    update public.agilecert_sensitive_identity_documents
    set status = 'withdrawn', updated_at = now(), metadata = metadata || jsonb_build_object('supersededAt', now())
    where id = v_previous.id;
  end if;

  insert into public.agilecert_sensitive_identity_documents (
    candidate_id, document_type, document_number_digest, document_number_last4,
    issuer_country, issued_on, expires_on, document_object_path, document_filename,
    document_mime_type, document_size_bytes, selfie_object_path, selfie_filename,
    selfie_mime_type, selfie_size_bytes, status, submitted_at, retention_delete_after,
    duplicate_digest_detected, metadata
  ) values (
    v_candidate_id, v_doc_type, v_digest, v_last4, v_country, p_issued_on, p_expires_on,
    v_doc_path, left(trim(p_document_filename),240), lower(p_document_mime_type), p_document_size_bytes,
    v_selfie_path, case when v_selfie_path is null then null else left(trim(p_selfie_filename),240) end,
    case when v_selfie_path is null then null else lower(p_selfie_mime_type) end,
    case when v_selfie_path is null then null else p_selfie_size_bytes end,
    'submitted', now(), now() + make_interval(days => v_policy.identity_retention_days),
    v_duplicate,
    jsonb_build_object('examinationId', p_examination_id, 'consentId', v_consent.id, 'rawDocumentNumberStored', false)
  ) returning * into v_created;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, entity_type, entity_id, action, metadata
  ) values (
    v_candidate_id, v_candidate_id, p_examination_id, 'identity_document', v_created.id,
    'sensitive_identity_submitted',
    jsonb_build_object('documentType', v_doc_type, 'issuerCountry', v_country, 'last4', v_last4, 'duplicateDigestDetected', v_duplicate)
  );

  return jsonb_build_object('id', v_created.id, 'status', v_created.status, 'documentType', v_created.document_type,
    'documentNumberLast4', v_created.document_number_last4, 'issuerCountry', v_created.issuer_country,
    'expiresOn', v_created.expires_on, 'duplicateReviewRequired', v_created.duplicate_digest_detected,
    'submittedAt', v_created.submitted_at);
end;
$$;

create or replace function public.submit_my_agilecert_exam_identity_check(
  p_session_id uuid,
  p_exam_day_selfie_object_path text default null,
  p_exam_day_selfie_filename text default null,
  p_exam_day_selfie_mime_type text default null,
  p_exam_day_selfie_size_bytes bigint default null,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_session public.exam_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
  v_document public.agilecert_sensitive_identity_documents%rowtype;
  v_check public.agilecert_exam_identity_checks%rowtype;
  v_path text := nullif(trim(coalesce(p_exam_day_selfie_object_path, '')), '');
  v_status text;
begin
  if not coalesce(p_attestation, false) then raise exception 'Confirm the examination-day identity attestation.'; end if;
  select * into v_session from public.exam_sessions where id = p_session_id and candidate_id = v_candidate_id and status = 'active';
  if not found then raise exception 'The active examination session was not found.'; end if;
  select * into v_policy from public.agilecert_identity_proctoring_policies where examination_id = v_session.examination_id and active = true;
  if not found then raise exception 'The examination identity policy is unavailable.'; end if;
  select * into v_consent from public.agilecert_identity_proctoring_consents
  where candidate_id = v_candidate_id and examination_id = v_session.examination_id
    and policy_version = v_policy.policy_version and consent_version = v_policy.consent_version and withdrawn_at is null
  order by accepted_at desc limit 1;
  if not found then raise exception 'Accept the current identity and proctoring consent first.'; end if;

  select * into v_document from public.agilecert_sensitive_identity_documents
  where candidate_id = v_candidate_id and status = 'approved'
    and (approved_until is null or approved_until > now())
    and (expires_on is null or expires_on > current_date)
  order by reviewed_at desc nulls last, created_at desc limit 1;
  if v_policy.require_government_id and not found then raise exception 'An approved unexpired government identity document is required.'; end if;
  if v_policy.require_existing_identity_approval and not public.agilecert_identity_is_approved(v_candidate_id, null) then
    raise exception 'Approved IIPM identity assurance is required for this examination.';
  end if;

  if (v_policy.require_selfie or v_policy.require_exam_day_identity_check) and v_path is null then
    raise exception 'An examination-day selfie is required by the active policy.';
  end if;
  if v_path is not null then
    if v_path !~ ('^' || v_candidate_id::text || '/[A-Za-z0-9._/-]+$') then raise exception 'The examination-day selfie path is not owned by the signed-in candidate.'; end if;
    if lower(coalesce(p_exam_day_selfie_mime_type,'')) not in ('image/jpeg','image/png') then raise exception 'The examination-day selfie must be JPG or PNG.'; end if;
    if coalesce(p_exam_day_selfie_size_bytes,0) < 1 or p_exam_day_selfie_size_bytes > 12582912 then raise exception 'The examination-day selfie must not exceed 12 MB.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id='agilecert-sensitive-identity' and o.name=v_path) then raise exception 'The private examination-day selfie upload was not found.'; end if;
  end if;

  v_status := case when v_policy.require_exam_day_identity_check then 'submitted' else 'approved' end;
  insert into public.agilecert_exam_identity_checks (
    session_id, examination_id, candidate_id, consent_id, identity_document_id,
    status, candidate_attested_at, exam_day_selfie_object_path, exam_day_selfie_filename,
    exam_day_selfie_mime_type, exam_day_selfie_size_bytes, manual_face_match, metadata
  ) values (
    v_session.id, v_session.examination_id, v_candidate_id, v_consent.id, v_document.id,
    v_status, now(), v_path,
    case when v_path is null then null else left(trim(p_exam_day_selfie_filename),240) end,
    case when v_path is null then null else lower(p_exam_day_selfie_mime_type) end,
    case when v_path is null then null else p_exam_day_selfie_size_bytes end,
    case when v_path is null then 'not_required' else null end,
    jsonb_build_object('policyVersion', v_policy.policy_version, 'automatedFaceMatchEnabled', v_policy.automated_face_match_enabled, 'livenessEnabled', v_policy.liveness_check_enabled)
  )
  on conflict (session_id) do update set
    consent_id=excluded.consent_id, identity_document_id=excluded.identity_document_id,
    status=excluded.status, candidate_attested_at=excluded.candidate_attested_at,
    exam_day_selfie_object_path=excluded.exam_day_selfie_object_path,
    exam_day_selfie_filename=excluded.exam_day_selfie_filename,
    exam_day_selfie_mime_type=excluded.exam_day_selfie_mime_type,
    exam_day_selfie_size_bytes=excluded.exam_day_selfie_size_bytes,
    reviewed_at=null, reviewed_by=null, review_note=null, updated_at=now()
  returning * into v_check;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, session_id, entity_type, entity_id, action, metadata
  ) values (
    v_candidate_id, v_candidate_id, v_session.examination_id, v_session.id,
    'identity_check', v_check.id, 'exam_day_identity_check_submitted', jsonb_build_object('status', v_check.status)
  );

  return jsonb_build_object('id', v_check.id, 'sessionId', v_check.session_id, 'status', v_check.status,
    'candidateAttestedAt', v_check.candidate_attested_at, 'canOpenProctoringSession', v_check.status in ('submitted','approved','not_required'));
end;
$$;

create or replace function public.open_my_agilecert_proctoring_session(
  p_session_id uuid,
  p_camera_permission text default 'not_requested',
  p_microphone_permission text default 'not_requested',
  p_fullscreen_status text default 'not_requested',
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_exam_session public.exam_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
  v_check public.agilecert_exam_identity_checks%rowtype;
  v_proctor public.agilecert_proctoring_sessions%rowtype;
  v_camera text := lower(trim(coalesce(p_camera_permission,'not_requested')));
  v_microphone text := lower(trim(coalesce(p_microphone_permission,'not_requested')));
  v_fullscreen text := lower(trim(coalesce(p_fullscreen_status,'not_requested')));
begin
  select * into v_exam_session from public.exam_sessions
  where id=p_session_id and candidate_id=v_candidate_id and status='active';
  if not found then raise exception 'The active examination session was not found.'; end if;
  select * into v_policy from public.agilecert_identity_proctoring_policies
  where examination_id=v_exam_session.examination_id and active=true;
  if not found then raise exception 'The examination proctoring policy is unavailable.'; end if;
  select * into v_consent from public.agilecert_identity_proctoring_consents
  where candidate_id=v_candidate_id and examination_id=v_exam_session.examination_id
    and policy_version=v_policy.policy_version and consent_version=v_policy.consent_version and withdrawn_at is null
  order by accepted_at desc limit 1;
  if not found then raise exception 'Accept the current examination identity and proctoring consent first.'; end if;
  if v_camera not in ('not_requested','granted','denied','unavailable') then raise exception 'Invalid camera permission status.'; end if;
  if v_microphone not in ('not_requested','granted','denied','unavailable') then raise exception 'Invalid microphone permission status.'; end if;
  if v_fullscreen not in ('not_requested','entered','exited','unavailable') then raise exception 'Invalid fullscreen status.'; end if;
  if v_policy.require_camera and v_camera <> 'granted' then raise exception 'Camera access is required before the examination can continue.'; end if;
  if v_policy.require_microphone_permission and v_microphone <> 'granted' then raise exception 'Microphone permission is required before the examination can continue.'; end if;
  if v_policy.require_fullscreen and v_fullscreen <> 'entered' then raise exception 'Fullscreen mode is required before the examination can continue.'; end if;

  select * into v_check from public.agilecert_exam_identity_checks where session_id=p_session_id;
  if v_policy.require_exam_day_identity_check and (not found or v_check.status not in ('submitted','approved','not_required')) then
    raise exception 'Complete the examination-day identity check before opening the proctored session.';
  end if;
  if v_policy.require_government_id and not exists (
    select 1 from public.agilecert_sensitive_identity_documents d
    where d.candidate_id=v_candidate_id and d.status='approved'
      and (d.approved_until is null or d.approved_until>now()) and (d.expires_on is null or d.expires_on>current_date)
  ) then raise exception 'An approved unexpired government identity document is required.'; end if;

  insert into public.agilecert_proctoring_sessions (
    session_id, examination_id, candidate_id, consent_id, identity_check_id,
    policy_version, status, camera_permission, microphone_permission,
    fullscreen_status, connectivity_status, client_fingerprint, metadata
  ) values (
    p_session_id, v_exam_session.examination_id, v_candidate_id, v_consent.id, v_check.id,
    v_policy.policy_version, 'active', v_camera, v_microphone, v_fullscreen, 'online',
    coalesce(p_client_fingerprint,'{}'::jsonb),
    jsonb_build_object('consentVersion',v_policy.consent_version,'liveEventCaptureEnabled',v_policy.live_event_capture_enabled)
  )
  on conflict (session_id) do update set
    consent_id=excluded.consent_id, identity_check_id=excluded.identity_check_id,
    camera_permission=excluded.camera_permission, microphone_permission=excluded.microphone_permission,
    fullscreen_status=excluded.fullscreen_status, client_fingerprint=excluded.client_fingerprint,
    status=case when public.agilecert_proctoring_sessions.status in ('submitted','expired','terminated','closed') then public.agilecert_proctoring_sessions.status else 'active' end,
    updated_at=now()
  returning * into v_proctor;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, session_id, entity_type, entity_id, action, metadata
  ) values (
    v_candidate_id,v_candidate_id,v_exam_session.examination_id,p_session_id,'proctoring_session',v_proctor.id,
    'proctoring_session_opened',jsonb_build_object('cameraPermission',v_camera,'microphonePermission',v_microphone,'fullscreenStatus',v_fullscreen)
  );

  return jsonb_build_object('id',v_proctor.id,'sessionId',v_proctor.session_id,'status',v_proctor.status,
    'riskScore',v_proctor.risk_score,'riskLevel',v_proctor.risk_level,'startedAt',v_proctor.started_at,
    'policy',jsonb_build_object('requireCamera',v_policy.require_camera,'requireMicrophone',v_policy.require_microphone_permission,
      'requireFullscreen',v_policy.require_fullscreen,'liveEventCaptureEnabled',v_policy.live_event_capture_enabled,
      'aiVisualAnalysisEnabled',v_policy.ai_visual_analysis_enabled,'retainWebcamImages',v_policy.retain_webcam_images));
end;
$$;

create or replace function public.record_my_agilecert_proctoring_event(
  p_proctoring_session_id uuid,
  p_client_event_id text,
  p_event_type text,
  p_severity text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_proctor public.agilecert_proctoring_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_type text := lower(trim(coalesce(p_event_type,'')));
  v_severity text := lower(trim(coalesce(p_severity,'low')));
  v_weight numeric(5,2);
  v_event_id uuid;
  v_camera text;
  v_fullscreen text;
  v_connectivity text;
begin
  select * into v_proctor from public.agilecert_proctoring_sessions
  where id=p_proctoring_session_id and candidate_id=v_candidate_id and status='active' for update;
  if not found then raise exception 'The active proctoring session was not found.'; end if;
  select * into v_policy from public.agilecert_identity_proctoring_policies where examination_id=v_proctor.examination_id;
  if not coalesce(v_policy.live_event_capture_enabled,true) then raise exception 'Live proctor-event capture is disabled for this examination.'; end if;
  if v_type not in (
    'session_heartbeat','browser_focus_lost','visibility_hidden','fullscreen_exit','fullscreen_enter',
    'clipboard_copy','clipboard_cut','clipboard_paste','print_attempt','screenshot_attempt','developer_tools_attempt',
    'camera_granted','camera_denied','camera_unavailable','camera_disabled','microphone_granted','microphone_denied',
    'network_offline','network_online','network_unstable','multiple_people','no_face','phone_detected','notes_detected',
    'looking_away','identity_mismatch','manual_flag'
  ) then raise exception 'Unsupported proctor event type.'; end if;
  if v_severity not in ('low','medium','high') then raise exception 'Proctor event severity must be low, medium or high.'; end if;
  if p_occurred_at < v_proctor.started_at - interval '5 minutes' or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'The proctor event timestamp is outside the permitted session window.';
  end if;
  v_weight := case
    when v_type in ('session_heartbeat','fullscreen_enter','camera_granted','microphone_granted','network_online') then 0
    when v_severity='high' then v_policy.high_event_weight
    when v_severity='medium' then v_policy.medium_event_weight
    else v_policy.low_event_weight end;

  insert into public.proctor_events (
    session_id,candidate_id,event_type,severity,confidence,message,snapshot_path,metadata,occurred_at,
    proctoring_session_id,client_event_id,source,risk_weight
  ) values (
    v_proctor.session_id,v_candidate_id,v_type,v_severity,null,left(trim(coalesce(p_message,'Proctor event recorded.')),800),
    null,coalesce(p_metadata,'{}'::jsonb),coalesce(p_occurred_at,now()),
    v_proctor.id,nullif(trim(coalesce(p_client_event_id,'')),''),'live_browser',v_weight
  )
  on conflict (proctoring_session_id,client_event_id) where proctoring_session_id is not null and client_event_id is not null
  do nothing returning id into v_event_id;

  v_camera := case when v_type='camera_granted' then 'granted' when v_type='camera_denied' then 'denied'
    when v_type in ('camera_unavailable','camera_disabled') then 'unavailable' else null end;
  v_fullscreen := case when v_type='fullscreen_enter' then 'entered' when v_type='fullscreen_exit' then 'exited' else null end;
  v_connectivity := case when v_type='network_online' then 'online' when v_type='network_offline' then 'offline'
    when v_type='network_unstable' then 'unstable' else null end;
  update public.agilecert_proctoring_sessions set
    camera_permission=coalesce(v_camera,camera_permission), fullscreen_status=coalesce(v_fullscreen,fullscreen_status),
    connectivity_status=coalesce(v_connectivity,connectivity_status), updated_at=now()
  where id=v_proctor.id;
  perform public.agilecert_refresh_proctoring_session_risk(v_proctor.id);
  select * into v_proctor from public.agilecert_proctoring_sessions where id=v_proctor.id;

  return jsonb_build_object('accepted',v_event_id is not null,'eventId',v_event_id,
    'riskScore',v_proctor.risk_score,'riskLevel',v_proctor.risk_level,'eventCount',v_proctor.event_count);
end;
$$;

create or replace function public.submit_my_agilecert_incident_explanation(
  p_incident_id uuid,
  p_explanation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid:=auth.uid(); v_incident public.agilecert_proctoring_incidents%rowtype;
  v_text text:=nullif(trim(coalesce(p_explanation,'')),'');
begin
  if v_text is null or length(v_text)<20 then raise exception 'Provide an explanation of at least 20 characters.'; end if;
  select * into v_incident from public.agilecert_proctoring_incidents
  where id=p_incident_id and candidate_id=v_candidate_id and status in ('open','awaiting_candidate','under_investigation') for update;
  if not found then raise exception 'The incident is unavailable for candidate explanation.'; end if;
  update public.agilecert_proctoring_incidents set candidate_explanation=left(v_text,4000),
    candidate_explanation_submitted_at=now(),status='under_investigation',updated_at=now() where id=v_incident.id returning * into v_incident;
  update public.agilecert_misconduct_cases set status='under_review',updated_at=now() where incident_id=v_incident.id and status in ('open','awaiting_candidate');
  insert into public.agilecert_identity_proctoring_audits(candidate_id,actor_id,examination_id,session_id,attempt_id,entity_type,entity_id,action,metadata)
  values(v_candidate_id,v_candidate_id,v_incident.examination_id,v_incident.session_id,v_incident.attempt_id,'incident',v_incident.id,'candidate_explanation_submitted','{}'::jsonb);
  return jsonb_build_object('id',v_incident.id,'status',v_incident.status,'submittedAt',v_incident.candidate_explanation_submitted_at);
end;
$$;

create or replace function public.submit_my_agilecert_misconduct_appeal(
  p_misconduct_case_id uuid,
  p_grounds text,
  p_supporting_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid:=auth.uid(); v_case public.agilecert_misconduct_cases%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype; v_appeal public.agilecert_misconduct_appeals%rowtype;
  v_grounds text:=nullif(trim(coalesce(p_grounds,'')),'');
begin
  if v_grounds is null or length(v_grounds)<20 then raise exception 'Appeal grounds must contain at least 20 characters.'; end if;
  select * into v_case from public.agilecert_misconduct_cases
  where id=p_misconduct_case_id and candidate_id=v_candidate_id and status in ('decided','closed') and decision is not null for update;
  if not found then raise exception 'A decided misconduct case was not found for this account.'; end if;
  select * into v_policy from public.agilecert_identity_proctoring_policies where examination_id=v_case.examination_id;
  if v_case.decided_at + make_interval(days=>coalesce(v_policy.appeal_window_days,14)) < now() then raise exception 'The appeal window has closed.'; end if;
  insert into public.agilecert_misconduct_appeals(misconduct_case_id,candidate_id,grounds,supporting_reference,status)
  values(v_case.id,v_candidate_id,left(v_grounds,4000),nullif(left(trim(coalesce(p_supporting_reference,'')),1000),''),'submitted')
  returning * into v_appeal;
  update public.agilecert_misconduct_cases set status='appealed',updated_at=now() where id=v_case.id;
  insert into public.agilecert_identity_proctoring_audits(candidate_id,actor_id,examination_id,session_id,attempt_id,entity_type,entity_id,action,metadata)
  values(v_candidate_id,v_candidate_id,v_case.examination_id,v_case.session_id,v_case.attempt_id,'appeal',v_appeal.id,'candidate_appeal_submitted','{}'::jsonb);
  return jsonb_build_object('id',v_appeal.id,'status',v_appeal.status,'submittedAt',v_appeal.submitted_at);
end;
$$;

create or replace function public.get_my_agilecert_identity_proctoring_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_candidate_id uuid:=auth.uid(); v_payload jsonb;
begin
  if v_candidate_id is null or not exists(select 1 from public.profiles p where p.id=v_candidate_id and p.role='candidate' and p.is_active=true)
  then raise exception 'An active candidate account is required.'; end if;
  select jsonb_build_object(
    'policies',coalesce((select jsonb_agg(jsonb_build_object(
      'examinationId',e.id,'examinationTitle',e.title,'programmeCode',p.code,'policyVersion',ip.policy_version,'consentVersion',ip.consent_version,
      'privacyNotice',ip.privacy_notice,'requireExistingIdentityApproval',ip.require_existing_identity_approval,
      'requireGovernmentId',ip.require_government_id,'requireSelfie',ip.require_selfie,'requireExamDayIdentityCheck',ip.require_exam_day_identity_check,
      'requireCamera',ip.require_camera,'requireMicrophone',ip.require_microphone_permission,'requireFullscreen',ip.require_fullscreen,
      'liveEventCaptureEnabled',ip.live_event_capture_enabled,'aiVisualAnalysisEnabled',ip.ai_visual_analysis_enabled,
      'externalKycEnabled',ip.external_kyc_enabled,'automatedFaceMatchEnabled',ip.automated_face_match_enabled,'livenessEnabled',ip.liveness_check_enabled,
      'retainWebcamImages',ip.retain_webcam_images,'appealWindowDays',ip.appeal_window_days,
      'consented',exists(select 1 from public.agilecert_identity_proctoring_consents c where c.candidate_id=v_candidate_id and c.examination_id=e.id and c.policy_version=ip.policy_version and c.consent_version=ip.consent_version and c.withdrawn_at is null)
    ) order by e.title)
      from public.examinations e join public.programmes p on p.id=e.programme_id
      join public.agilecert_identity_proctoring_policies ip on ip.examination_id=e.id and ip.active=true
      where e.status='published' and (e.allow_self_enrollment or exists(select 1 from public.exam_assignments a where a.examination_id=e.id and a.candidate_id=v_candidate_id and a.status='assigned'))),'[]'::jsonb),
    'identityDocuments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'documentType',d.document_type,'documentNumberLast4',d.document_number_last4,'issuerCountry',d.issuer_country,
      'issuedOn',d.issued_on,'expiresOn',d.expires_on,'documentFilename',d.document_filename,'selfieFilename',d.selfie_filename,
      'status',d.status,'submittedAt',d.submitted_at,'reviewedAt',d.reviewed_at,'reviewNote',d.review_note,'approvedUntil',d.approved_until,
      'duplicateReviewRequired',d.duplicate_digest_detected,'retentionDeleteAfter',d.retention_delete_after
    ) order by d.created_at desc) from public.agilecert_sensitive_identity_documents d where d.candidate_id=v_candidate_id),'[]'::jsonb),
    'identityChecks',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'sessionId',c.session_id,'examinationId',c.examination_id,'examinationTitle',e.title,'status',c.status,
      'candidateAttestedAt',c.candidate_attested_at,'selfieFilename',c.exam_day_selfie_filename,'manualDocumentMatch',c.manual_document_match,
      'manualFaceMatch',c.manual_face_match,'reviewedAt',c.reviewed_at,'reviewNote',c.review_note
    ) order by c.created_at desc) from public.agilecert_exam_identity_checks c join public.examinations e on e.id=c.examination_id where c.candidate_id=v_candidate_id),'[]'::jsonb),
    'proctoringSessions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'sessionId',s.session_id,'examinationId',s.examination_id,'examinationTitle',e.title,'status',s.status,
      'startedAt',s.started_at,'endedAt',s.ended_at,'riskScore',s.risk_score,'riskLevel',s.risk_level,'eventCount',s.event_count,
      'cameraPermission',s.camera_permission,'fullscreenStatus',s.fullscreen_status,'connectivityStatus',s.connectivity_status
    ) order by s.started_at desc) from public.agilecert_proctoring_sessions s join public.examinations e on e.id=s.examination_id where s.candidate_id=v_candidate_id),'[]'::jsonb),
    'incidents',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'examinationId',i.examination_id,'examinationTitle',e.title,'category',i.category,'severity',i.severity,'status',i.status,
      'title',i.title,'summary',i.summary,'riskScore',i.risk_score_at_creation,'candidateExplanation',i.candidate_explanation,
      'explanationSubmittedAt',i.candidate_explanation_submitted_at,'resolutionSummary',i.resolution_summary,'createdAt',i.created_at
    ) order by i.created_at desc) from public.agilecert_proctoring_incidents i join public.examinations e on e.id=i.examination_id where i.candidate_id=v_candidate_id),'[]'::jsonb),
    'misconductCases',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'incidentId',m.incident_id,'examinationId',m.examination_id,'status',m.status,'resultHold',m.result_hold,
      'decision',m.decision,'decisionReason',m.decision_reason,'decidedAt',m.decided_at,'suspensionUntil',m.suspension_until,'createdAt',m.created_at
    ) order by m.created_at desc) from public.agilecert_misconduct_cases m where m.candidate_id=v_candidate_id),'[]'::jsonb),
    'appeals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'misconductCaseId',a.misconduct_case_id,'grounds',a.grounds,'supportingReference',a.supporting_reference,
      'status',a.status,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at,'decisionReason',a.decision_reason,'replacementDecision',a.replacement_decision
    ) order by a.submitted_at desc) from public.agilecert_misconduct_appeals a where a.candidate_id=v_candidate_id),'[]'::jsonb)
  ) into v_payload;
  return v_payload;
end;
$$;

create or replace function public.get_agilecert_identity_proctoring_admin_console(p_limit integer default 150)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_admin_id uuid:=public.agilecert_require_identity_proctor_admin(); v_limit integer:=greatest(1,least(coalesce(p_limit,150),500));
begin
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(jsonb_build_object('examinationId',ip.examination_id,'examinationTitle',e.title,'programmeCode',p.code,
      'policyVersion',ip.policy_version,'consentVersion',ip.consent_version,'privacyNotice',ip.privacy_notice,
      'requireExistingIdentityApproval',ip.require_existing_identity_approval,'requireGovernmentId',ip.require_government_id,
      'requireSelfie',ip.require_selfie,'requireExamDayIdentityCheck',ip.require_exam_day_identity_check,'requireCamera',ip.require_camera,
      'requireMicrophone',ip.require_microphone_permission,'requireFullscreen',ip.require_fullscreen,'liveEventCaptureEnabled',ip.live_event_capture_enabled,
      'aiVisualAnalysisEnabled',ip.ai_visual_analysis_enabled,'externalKycEnabled',ip.external_kyc_enabled,
      'automatedFaceMatchEnabled',ip.automated_face_match_enabled,'livenessEnabled',ip.liveness_check_enabled,'retainWebcamImages',ip.retain_webcam_images,
      'incidentThreshold',ip.incident_threshold,'criticalThreshold',ip.critical_threshold,'identityRetentionDays',ip.identity_retention_days,
      'proctorEventRetentionDays',ip.proctor_event_retention_days,'incidentRetentionDays',ip.incident_retention_days,'appealWindowDays',ip.appeal_window_days,'active',ip.active)
      order by e.title) from public.agilecert_identity_proctoring_policies ip join public.examinations e on e.id=ip.examination_id join public.programmes p on p.id=e.programme_id),'[]'::jsonb),
    'identityDocuments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'candidateId',d.candidate_id,'candidateName',p.full_name,'candidateEmail',p.email,
      'documentType',d.document_type,'documentNumberLast4',d.document_number_last4,'issuerCountry',d.issuer_country,'issuedOn',d.issued_on,'expiresOn',d.expires_on,
      'documentObjectPath',d.document_object_path,'documentFilename',d.document_filename,'selfieObjectPath',d.selfie_object_path,'selfieFilename',d.selfie_filename,
      'status',d.status,'submittedAt',d.submitted_at,'reviewedAt',d.reviewed_at,'reviewNote',d.review_note,'approvedUntil',d.approved_until,
      'duplicateReviewRequired',d.duplicate_digest_detected,'retentionDeleteAfter',d.retention_delete_after) order by coalesce(d.submitted_at,d.created_at) desc)
      from (select * from public.agilecert_sensitive_identity_documents order by coalesce(submitted_at,created_at) desc limit v_limit) d join public.profiles p on p.id=d.candidate_id),'[]'::jsonb),
    'identityChecks',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'sessionId',c.session_id,'candidateId',c.candidate_id,'candidateName',p.full_name,
      'candidateEmail',p.email,'examinationId',c.examination_id,'examinationTitle',e.title,'status',c.status,'identityDocumentId',c.identity_document_id,
      'selfieObjectPath',c.exam_day_selfie_object_path,'selfieFilename',c.exam_day_selfie_filename,'manualDocumentMatch',c.manual_document_match,
      'manualFaceMatch',c.manual_face_match,'candidateAttestedAt',c.candidate_attested_at,'reviewedAt',c.reviewed_at,'reviewNote',c.review_note) order by c.created_at desc)
      from (select * from public.agilecert_exam_identity_checks order by created_at desc limit v_limit) c join public.profiles p on p.id=c.candidate_id join public.examinations e on e.id=c.examination_id),'[]'::jsonb),
    'proctoringSessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'sessionId',s.session_id,'candidateId',s.candidate_id,'candidateName',p.full_name,
      'candidateEmail',p.email,'examinationId',s.examination_id,'examinationTitle',e.title,'status',s.status,'startedAt',s.started_at,'endedAt',s.ended_at,
      'riskScore',s.risk_score,'riskLevel',s.risk_level,'eventCount',s.event_count,'lowEventCount',s.low_event_count,'mediumEventCount',s.medium_event_count,
      'highEventCount',s.high_event_count,'cameraPermission',s.camera_permission,'microphonePermission',s.microphone_permission,'fullscreenStatus',s.fullscreen_status,
      'connectivityStatus',s.connectivity_status) order by s.started_at desc)
      from (select * from public.agilecert_proctoring_sessions order by started_at desc limit v_limit) s join public.profiles p on p.id=s.candidate_id join public.examinations e on e.id=s.examination_id),'[]'::jsonb),
    'incidents',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'proctoringSessionId',i.proctoring_session_id,'sessionId',i.session_id,'attemptId',i.attempt_id,
      'candidateId',i.candidate_id,'candidateName',p.full_name,'candidateEmail',p.email,'examinationId',i.examination_id,'examinationTitle',e.title,
      'category',i.category,'severity',i.severity,'status',i.status,'title',i.title,'summary',i.summary,'riskScore',i.risk_score_at_creation,
      'candidateExplanation',i.candidate_explanation,'explanationSubmittedAt',i.candidate_explanation_submitted_at,'assignedTo',i.assigned_to,
      'investigationNotes',i.investigation_notes,'resolutionSummary',i.resolution_summary,'createdAt',i.created_at) order by i.created_at desc)
      from (select * from public.agilecert_proctoring_incidents order by created_at desc limit v_limit) i join public.profiles p on p.id=i.candidate_id join public.examinations e on e.id=i.examination_id),'[]'::jsonb),
    'misconductCases',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'incidentId',m.incident_id,'attemptId',m.attempt_id,'candidateId',m.candidate_id,
      'candidateName',p.full_name,'candidateEmail',p.email,'examinationId',m.examination_id,'examinationTitle',e.title,'status',m.status,'resultHold',m.result_hold,
      'decision',m.decision,'decisionReason',m.decision_reason,'decidedAt',m.decided_at,'suspensionUntil',m.suspension_until,'createdAt',m.created_at) order by m.created_at desc)
      from (select * from public.agilecert_misconduct_cases order by created_at desc limit v_limit) m join public.profiles p on p.id=m.candidate_id join public.examinations e on e.id=m.examination_id),'[]'::jsonb),
    'appeals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'misconductCaseId',a.misconduct_case_id,'candidateId',a.candidate_id,'candidateName',p.full_name,
      'candidateEmail',p.email,'grounds',a.grounds,'supportingReference',a.supporting_reference,'status',a.status,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at,
      'decisionReason',a.decision_reason,'replacementDecision',a.replacement_decision) order by a.submitted_at desc)
      from (select * from public.agilecert_misconduct_appeals order by submitted_at desc limit v_limit) a join public.profiles p on p.id=a.candidate_id),'[]'::jsonb),
    'auditEvents',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'candidateId',a.candidate_id,'actorId',a.actor_id,'examinationId',a.examination_id,
      'sessionId',a.session_id,'attemptId',a.attempt_id,'entityType',a.entity_type,'entityId',a.entity_id,'action',a.action,'metadata',a.metadata,'createdAt',a.created_at) order by a.created_at desc)
      from (select * from public.agilecert_identity_proctoring_audits order by created_at desc limit v_limit) a),'[]'::jsonb),
    'counts',jsonb_build_object(
      'identityPending',(select count(*) from public.agilecert_sensitive_identity_documents where status in ('submitted','under_review','changes_requested')),
      'identityChecksPending',(select count(*) from public.agilecert_exam_identity_checks where status in ('submitted','under_review','changes_requested')),
      'highRiskSessions',(select count(*) from public.agilecert_proctoring_sessions where risk_level in ('high','critical')),
      'openIncidents',(select count(*) from public.agilecert_proctoring_incidents where status not in ('closed','dismissed')),
      'resultHolds',(select count(*) from public.agilecert_misconduct_cases where result_hold=true and status<>'closed'),
      'appealsPending',(select count(*) from public.agilecert_misconduct_appeals where status in ('submitted','under_review'))
    ),'adminId',v_admin_id
  );
end;
$$;

create or replace function public.upsert_agilecert_identity_proctoring_policy(
  p_examination_id uuid,p_consent_version text,p_privacy_notice text,
  p_require_existing_identity_approval boolean,p_require_government_id boolean,p_require_selfie boolean,
  p_require_exam_day_identity_check boolean,p_require_camera boolean,p_require_microphone_permission boolean,p_require_fullscreen boolean,
  p_live_event_capture_enabled boolean,p_ai_visual_analysis_enabled boolean,p_external_kyc_enabled boolean,
  p_automated_face_match_enabled boolean,p_liveness_check_enabled boolean,p_retain_webcam_images boolean,
  p_incident_threshold numeric,p_critical_threshold numeric,p_identity_retention_days integer,
  p_proctor_event_retention_days integer,p_incident_retention_days integer,p_appeal_window_days integer,p_active boolean
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=public.agilecert_require_identity_proctor_admin(); v_policy public.agilecert_identity_proctoring_policies%rowtype;
begin
  if not exists(select 1 from public.examinations where id=p_examination_id) then raise exception 'The examination was not found.'; end if;
  if coalesce(p_external_kyc_enabled,false) or coalesce(p_automated_face_match_enabled,false) or coalesce(p_liveness_check_enabled,false) then
    raise exception 'External KYC, automated face matching and liveness scoring remain disabled pending approved provider, consent and retention decisions.';
  end if;
  insert into public.agilecert_identity_proctoring_policies(
    examination_id,policy_version,consent_version,privacy_notice,require_existing_identity_approval,require_government_id,require_selfie,
    require_exam_day_identity_check,require_camera,require_microphone_permission,require_fullscreen,live_event_capture_enabled,
    ai_visual_analysis_enabled,external_kyc_enabled,automated_face_match_enabled,liveness_check_enabled,retain_webcam_images,
    incident_threshold,critical_threshold,identity_retention_days,proctor_event_retention_days,incident_retention_days,appeal_window_days,
    active,created_by,updated_by
  ) values(p_examination_id,1,trim(p_consent_version),trim(p_privacy_notice),coalesce(p_require_existing_identity_approval,false),
    coalesce(p_require_government_id,false),coalesce(p_require_selfie,false),coalesce(p_require_exam_day_identity_check,false),
    coalesce(p_require_camera,false),coalesce(p_require_microphone_permission,false),coalesce(p_require_fullscreen,false),
    coalesce(p_live_event_capture_enabled,true),coalesce(p_ai_visual_analysis_enabled,false),false,false,false,
    coalesce(p_retain_webcam_images,false),p_incident_threshold,p_critical_threshold,p_identity_retention_days,p_proctor_event_retention_days,
    p_incident_retention_days,p_appeal_window_days,coalesce(p_active,true),v_admin,v_admin)
  on conflict(examination_id) do update set
    policy_version=public.agilecert_identity_proctoring_policies.policy_version+1,consent_version=excluded.consent_version,
    privacy_notice=excluded.privacy_notice,require_existing_identity_approval=excluded.require_existing_identity_approval,
    require_government_id=excluded.require_government_id,require_selfie=excluded.require_selfie,
    require_exam_day_identity_check=excluded.require_exam_day_identity_check,require_camera=excluded.require_camera,
    require_microphone_permission=excluded.require_microphone_permission,require_fullscreen=excluded.require_fullscreen,
    live_event_capture_enabled=excluded.live_event_capture_enabled,ai_visual_analysis_enabled=excluded.ai_visual_analysis_enabled,
    external_kyc_enabled=false,automated_face_match_enabled=false,liveness_check_enabled=false,
    retain_webcam_images=excluded.retain_webcam_images,incident_threshold=excluded.incident_threshold,critical_threshold=excluded.critical_threshold,
    identity_retention_days=excluded.identity_retention_days,proctor_event_retention_days=excluded.proctor_event_retention_days,
    incident_retention_days=excluded.incident_retention_days,appeal_window_days=excluded.appeal_window_days,active=excluded.active,
    updated_by=v_admin,updated_at=now() returning * into v_policy;
  insert into public.agilecert_identity_proctoring_audits(actor_id,examination_id,entity_type,entity_id,action,metadata)
  values(v_admin,p_examination_id,'policy',p_examination_id,'identity_proctoring_policy_updated',jsonb_build_object('policyVersion',v_policy.policy_version));
  return jsonb_build_object('examinationId',v_policy.examination_id,'policyVersion',v_policy.policy_version,'consentVersion',v_policy.consent_version,'active',v_policy.active);
end; $$;

create or replace function public.review_agilecert_sensitive_identity(
  p_document_id uuid,p_decision text,p_review_note text,p_approval_months integer default 24
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=public.agilecert_require_identity_proctor_admin(); v_doc public.agilecert_sensitive_identity_documents%rowtype;
  v_decision text:=lower(trim(coalesce(p_decision,''))); v_note text:=nullif(trim(coalesce(p_review_note,'')),'');
begin
  if v_decision not in ('under_review','changes_requested','approved','rejected','expired') then raise exception 'Invalid sensitive identity decision.'; end if;
  if v_decision in ('changes_requested','rejected') and (v_note is null or length(v_note)<5) then raise exception 'A clear review note is required.'; end if;
  select * into v_doc from public.agilecert_sensitive_identity_documents where id=p_document_id for update;
  if not found then raise exception 'The sensitive identity record was not found.'; end if;
  update public.agilecert_sensitive_identity_documents set status=v_decision,
    review_started_at=case when v_decision='under_review' then coalesce(review_started_at,now()) else review_started_at end,
    reviewed_at=case when v_decision in ('approved','changes_requested','rejected','expired') then now() else reviewed_at end,
    reviewed_by=v_admin,review_note=v_note,verified_name=case when v_decision='approved' then coalesce(verified_name,(select full_name from public.profiles where id=v_doc.candidate_id)) else verified_name end,
    approved_until=case when v_decision='approved' then least(now()+make_interval(months=>greatest(1,least(coalesce(p_approval_months,24),120))),
      coalesce(v_doc.expires_on::timestamptz,'infinity'::timestamptz)) when v_decision in ('rejected','expired') then now() else approved_until end,
    updated_at=now() where id=v_doc.id returning * into v_doc;
  insert into public.agilecert_identity_proctoring_audits(candidate_id,actor_id,entity_type,entity_id,action,metadata)
  values(v_doc.candidate_id,v_admin,'identity_document',v_doc.id,'sensitive_identity_'||v_decision,jsonb_build_object('note',v_note,'last4',v_doc.document_number_last4));
  return jsonb_build_object('id',v_doc.id,'status',v_doc.status,'reviewedAt',v_doc.reviewed_at,'approvedUntil',v_doc.approved_until);
end; $$;

create or replace function public.review_agilecert_exam_identity_check(
  p_check_id uuid,p_decision text,p_document_match text,p_face_match text,p_review_note text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=public.agilecert_require_identity_proctor_admin(); v_check public.agilecert_exam_identity_checks%rowtype;
  v_decision text:=lower(trim(coalesce(p_decision,''))); v_doc text:=lower(trim(coalesce(p_document_match,''))); v_face text:=lower(trim(coalesce(p_face_match,'')));
begin
  if v_decision not in ('under_review','approved','changes_requested','rejected','expired') then raise exception 'Invalid examination identity-check decision.'; end if;
  if v_doc not in ('match','mismatch','inconclusive') then raise exception 'Document match must be match, mismatch or inconclusive.'; end if;
  if v_face not in ('match','mismatch','inconclusive','not_required') then raise exception 'Face match must be match, mismatch, inconclusive or not required.'; end if;
  if v_decision='approved' and (v_doc<>'match' or v_face not in ('match','not_required')) then raise exception 'An approved check requires matching document and face outcomes.'; end if;
  select * into v_check from public.agilecert_exam_identity_checks where id=p_check_id for update;
  if not found then raise exception 'The examination identity check was not found.'; end if;
  update public.agilecert_exam_identity_checks set status=v_decision,manual_document_match=v_doc,manual_face_match=v_face,
    reviewed_at=case when v_decision<>'under_review' then now() else reviewed_at end,reviewed_by=v_admin,
    review_note=nullif(trim(coalesce(p_review_note,'')),''),updated_at=now() where id=v_check.id returning * into v_check;
  if v_decision='rejected' then
    insert into public.agilecert_proctoring_incidents(proctoring_session_id,session_id,examination_id,candidate_id,incident_source,category,severity,status,title,summary,risk_score_at_creation,metadata)
    select ps.id,v_check.session_id,v_check.examination_id,v_check.candidate_id,'administrator','identity_mismatch','critical','under_investigation',
      'Examination-day identity mismatch','Administrator review rejected the examination-day identity check.',greatest(ps.risk_score,80),jsonb_build_object('identityCheckId',v_check.id)
    from public.agilecert_proctoring_sessions ps where ps.session_id=v_check.session_id
    on conflict do nothing;
  end if;
  return jsonb_build_object('id',v_check.id,'status',v_check.status,'manualDocumentMatch',v_check.manual_document_match,'manualFaceMatch',v_check.manual_face_match,'reviewedAt',v_check.reviewed_at);
end; $$;

create or replace function public.decide_agilecert_misconduct_case(
  p_case_id uuid,p_decision text,p_reason text,p_suspension_until timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=public.agilecert_require_identity_proctor_admin(); v_case public.agilecert_misconduct_cases%rowtype;
  v_decision text:=lower(trim(coalesce(p_decision,''))); v_reason text:=nullif(trim(coalesce(p_reason,'')),''); v_role text;
begin
  if v_decision not in ('no_violation','warning','flag_attempt','invalidate_attempt','suspend_candidate') then raise exception 'Invalid misconduct decision.'; end if;
  if v_reason is null or length(v_reason)<10 then raise exception 'A decision reason of at least 10 characters is required.'; end if;
  select role into v_role from public.profiles where id=v_admin;
  if v_decision='suspend_candidate' and v_role<>'super_admin' then raise exception 'Only a Super Admin may suspend a candidate account.'; end if;
  select * into v_case from public.agilecert_misconduct_cases where id=p_case_id for update;
  if not found then raise exception 'The misconduct case was not found.'; end if;
  update public.agilecert_misconduct_cases set status='decided',result_hold=false,decision=v_decision,decision_reason=left(v_reason,4000),
    decided_at=now(),decided_by=v_admin,suspension_until=case when v_decision='suspend_candidate' then p_suspension_until else null end,updated_at=now()
    where id=v_case.id returning * into v_case;
  update public.agilecert_proctoring_incidents set status='decision_issued',resolved_at=now(),resolved_by=v_admin,resolution_summary=left(v_reason,2000),updated_at=now()
    where id=v_case.incident_id;
  if v_case.attempt_id is not null then
    update public.attempts set status=case v_decision when 'no_violation' then 'reviewed' when 'warning' then 'reviewed'
      when 'flag_attempt' then 'flagged' else 'terminated' end,reviewed_by=v_admin,review_notes=left(v_reason,2000),updated_at=now() where id=v_case.attempt_id;
  end if;
  if v_decision='suspend_candidate' then update public.profiles set is_active=false,updated_at=now() where id=v_case.candidate_id; end if;
  insert into public.agilecert_identity_proctoring_audits(candidate_id,actor_id,examination_id,session_id,attempt_id,entity_type,entity_id,action,metadata)
  values(v_case.candidate_id,v_admin,v_case.examination_id,v_case.session_id,v_case.attempt_id,'misconduct_case',v_case.id,'misconduct_decision_issued',jsonb_build_object('decision',v_decision,'reason',left(v_reason,1000)));
  return jsonb_build_object('id',v_case.id,'status',v_case.status,'decision',v_case.decision,'decidedAt',v_case.decided_at,'resultHold',v_case.result_hold);
end; $$;

create or replace function public.decide_agilecert_misconduct_appeal(
  p_appeal_id uuid,p_outcome text,p_reason text,p_replacement_decision text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=public.agilecert_require_identity_proctor_admin(); v_appeal public.agilecert_misconduct_appeals%rowtype;
  v_case public.agilecert_misconduct_cases%rowtype; v_outcome text:=lower(trim(coalesce(p_outcome,''))); v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_replacement text:=nullif(lower(trim(coalesce(p_replacement_decision,''))),'');
begin
  if v_outcome not in ('upheld','partially_upheld','rejected') then raise exception 'Invalid appeal outcome.'; end if;
  if v_reason is null or length(v_reason)<10 then raise exception 'An appeal decision reason of at least 10 characters is required.'; end if;
  if v_outcome in ('upheld','partially_upheld') and v_replacement not in ('no_violation','warning','flag_attempt','invalidate_attempt','suspend_candidate') then
    raise exception 'A valid replacement misconduct decision is required.'; end if;
  select * into v_appeal from public.agilecert_misconduct_appeals where id=p_appeal_id and status in ('submitted','under_review') for update;
  if not found then raise exception 'The active appeal was not found.'; end if;
  select * into v_case from public.agilecert_misconduct_cases where id=v_appeal.misconduct_case_id for update;
  update public.agilecert_misconduct_appeals set status=v_outcome,reviewed_at=now(),reviewed_by=v_admin,decision_reason=left(v_reason,4000),
    replacement_decision=case when v_outcome in ('upheld','partially_upheld') then v_replacement else null end,updated_at=now()
    where id=v_appeal.id returning * into v_appeal;
  if v_outcome in ('upheld','partially_upheld') then
    update public.agilecert_misconduct_cases set status='closed',decision=v_replacement,decision_reason=left(v_reason,4000),decided_at=now(),decided_by=v_admin,result_hold=false,updated_at=now() where id=v_case.id;
    if v_case.attempt_id is not null then update public.attempts set status=case v_replacement when 'no_violation' then 'reviewed' when 'warning' then 'reviewed' when 'flag_attempt' then 'flagged' else 'terminated' end,
      reviewed_by=v_admin,review_notes=left(v_reason,2000),updated_at=now() where id=v_case.attempt_id; end if;
  else update public.agilecert_misconduct_cases set status='closed',result_hold=false,updated_at=now() where id=v_case.id; end if;
  insert into public.agilecert_identity_proctoring_audits(candidate_id,actor_id,examination_id,session_id,attempt_id,entity_type,entity_id,action,metadata)
  values(v_case.candidate_id,v_admin,v_case.examination_id,v_case.session_id,v_case.attempt_id,'appeal',v_appeal.id,'appeal_decided',jsonb_build_object('outcome',v_outcome,'replacementDecision',v_replacement));
  return jsonb_build_object('id',v_appeal.id,'status',v_appeal.status,'replacementDecision',v_appeal.replacement_decision,'reviewedAt',v_appeal.reviewed_at);
end; $$;

commit;
