begin;

-- Original Roadmap Phase 5 completion, unit 6 of 6:
-- privacy/permission hardening and server-side secure-exam preflight.

-- Conservative rollout: existing and future examinations remain unblocked until
-- an administrator deliberately enables live proctoring or identity requirements.
alter table public.agilecert_identity_proctoring_policies
  alter column live_event_capture_enabled set default false;

update public.agilecert_identity_proctoring_policies
set live_event_capture_enabled = false,
    updated_at = now()
where policy_version = 1
  and require_existing_identity_approval = false
  and require_government_id = false
  and require_selfie = false
  and require_exam_day_identity_check = false
  and require_camera = false
  and require_microphone_permission = false
  and require_fullscreen = false
  and ai_visual_analysis_enabled = false
  and external_kyc_enabled = false
  and automated_face_match_enabled = false
  and liveness_check_enabled = false;

-- Allow examination-day identity review to be completed before the timed secure
-- session is created. The approved check is linked to the session at start.
alter table public.agilecert_exam_identity_checks
  add column if not exists assignment_id uuid references public.exam_assignments(id) on delete cascade;

update public.agilecert_exam_identity_checks c
set assignment_id = s.assignment_id
from public.exam_sessions s
where c.session_id = s.id and c.assignment_id is null;

alter table public.agilecert_exam_identity_checks
  alter column session_id drop not null;

create unique index if not exists agilecert_exam_identity_check_assignment_uidx
  on public.agilecert_exam_identity_checks(assignment_id)
  where assignment_id is not null and status not in ('expired', 'rejected');

create or replace function public.prepare_my_agilecert_exam_identity_check(
  p_examination_id uuid,
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
  v_assignment public.exam_assignments%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
  v_document public.agilecert_sensitive_identity_documents%rowtype;
  v_check public.agilecert_exam_identity_checks%rowtype;
  v_path text := nullif(trim(coalesce(p_exam_day_selfie_object_path, '')), '');
  v_status text;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;
  if not coalesce(p_attestation, false) then
    raise exception 'Confirm the examination-day identity attestation.';
  end if;

  select * into v_assignment
  from public.exam_assignments
  where examination_id = p_examination_id
    and candidate_id = v_candidate_id
    and status = 'assigned'
    and (available_from is null or available_from <= now())
    and (expires_at is null or expires_at > now())
  for update;
  if not found then
    raise exception 'An active examination assignment is required for the identity check.';
  end if;

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = p_examination_id and active = true;
  if not found then
    raise exception 'The examination identity policy is unavailable.';
  end if;

  select * into v_consent
  from public.agilecert_identity_proctoring_consents
  where candidate_id = v_candidate_id
    and examination_id = p_examination_id
    and policy_version = v_policy.policy_version
    and consent_version = v_policy.consent_version
    and withdrawn_at is null
  order by accepted_at desc
  limit 1;
  if not found then
    raise exception 'Accept the current identity and proctoring consent first.';
  end if;

  select * into v_document
  from public.agilecert_sensitive_identity_documents
  where candidate_id = v_candidate_id
    and status = 'approved'
    and (approved_until is null or approved_until > now())
    and (expires_on is null or expires_on > current_date)
  order by reviewed_at desc nulls last, created_at desc
  limit 1;
  if v_policy.require_government_id and not found then
    raise exception 'An approved unexpired government identity document is required.';
  end if;
  if v_policy.require_existing_identity_approval
     and not public.agilecert_identity_is_approved(v_candidate_id, null) then
    raise exception 'Approved IIPM identity assurance is required for this examination.';
  end if;

  if (v_policy.require_selfie or v_policy.require_exam_day_identity_check) and v_path is null then
    raise exception 'An examination-day selfie is required by the active policy.';
  end if;
  if v_path is not null then
    if v_path !~ ('^' || v_candidate_id::text || '/[A-Za-z0-9._/-]+$') then
      raise exception 'The examination-day selfie path is not owned by the signed-in candidate.';
    end if;
    if lower(coalesce(p_exam_day_selfie_mime_type, '')) not in ('image/jpeg', 'image/png') then
      raise exception 'The examination-day selfie must be JPG or PNG.';
    end if;
    if coalesce(p_exam_day_selfie_size_bytes, 0) < 1 or p_exam_day_selfie_size_bytes > 12582912 then
      raise exception 'The examination-day selfie must not exceed 12 MB.';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'agilecert-sensitive-identity' and o.name = v_path
    ) then
      raise exception 'The private examination-day selfie upload was not found.';
    end if;
  end if;

  v_status := case
    when v_policy.require_exam_day_identity_check then 'submitted'
    else 'approved'
  end;

  insert into public.agilecert_exam_identity_checks (
    assignment_id, session_id, examination_id, candidate_id, consent_id,
    identity_document_id, status, candidate_attested_at,
    exam_day_selfie_object_path, exam_day_selfie_filename,
    exam_day_selfie_mime_type, exam_day_selfie_size_bytes,
    manual_face_match, metadata
  ) values (
    v_assignment.id, null, p_examination_id, v_candidate_id, v_consent.id,
    v_document.id, v_status, now(), v_path,
    case when v_path is null then null else left(trim(p_exam_day_selfie_filename), 240) end,
    case when v_path is null then null else lower(p_exam_day_selfie_mime_type) end,
    case when v_path is null then null else p_exam_day_selfie_size_bytes end,
    case when v_path is null then 'not_required' else null end,
    jsonb_build_object(
      'policyVersion', v_policy.policy_version,
      'preparedBeforeSecureSession', true,
      'automatedFaceMatchEnabled', false,
      'livenessEnabled', false
    )
  )
  on conflict (assignment_id) where assignment_id is not null and status not in ('expired', 'rejected')
  do update set
    consent_id = excluded.consent_id,
    identity_document_id = excluded.identity_document_id,
    session_id = null,
    status = excluded.status,
    candidate_attested_at = excluded.candidate_attested_at,
    exam_day_selfie_object_path = excluded.exam_day_selfie_object_path,
    exam_day_selfie_filename = excluded.exam_day_selfie_filename,
    exam_day_selfie_mime_type = excluded.exam_day_selfie_mime_type,
    exam_day_selfie_size_bytes = excluded.exam_day_selfie_size_bytes,
    manual_document_match = null,
    manual_face_match = excluded.manual_face_match,
    reviewed_at = null,
    reviewed_by = null,
    review_note = null,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into v_check;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, entity_type, entity_id, action, metadata
  ) values (
    v_candidate_id, v_candidate_id, p_examination_id,
    'identity_check', v_check.id, 'pre_exam_identity_check_submitted',
    jsonb_build_object('assignmentId', v_assignment.id, 'status', v_check.status)
  );

  return jsonb_build_object(
    'id', v_check.id,
    'assignmentId', v_check.assignment_id,
    'examinationId', v_check.examination_id,
    'status', v_check.status,
    'candidateAttestedAt', v_check.candidate_attested_at,
    'reviewRequired', v_policy.require_exam_day_identity_check
  );
end;
$$;

-- Repair the attempt/result-hold trigger so a future attempt UUID is never
-- referenced by an incident before the attempt row exists.
drop trigger if exists agilecert_link_attempt_to_proctoring_case_trigger on public.attempts;
drop function if exists public.agilecert_link_attempt_to_proctoring_case();

create or replace function public.agilecert_hold_attempt_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.agilecert_misconduct_cases c
    where c.session_id = new.session_id
      and c.result_hold = true
      and c.status <> 'closed'
  ) and new.status = 'submitted' then
    new.status := 'flagged';
  end if;
  return new;
end;
$$;

create or replace function public.agilecert_link_attempt_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_proctoring_incidents
  set attempt_id = new.id, updated_at = now()
  where session_id = new.session_id and attempt_id is null;

  update public.agilecert_misconduct_cases
  set attempt_id = new.id, updated_at = now()
  where session_id = new.session_id and attempt_id is null;

  return new;
end;
$$;

create trigger agilecert_hold_attempt_before_insert_trigger
before insert on public.attempts
for each row execute function public.agilecert_hold_attempt_before_insert();

create trigger agilecert_link_attempt_after_insert_trigger
after insert on public.attempts
for each row execute function public.agilecert_link_attempt_after_insert();

-- Preserve the proven secure-exam authorities behind wrappers that enforce
-- policy/consent/identity preconditions and withhold question payloads until the
-- live proctoring session is ready.
alter function public.start_exam_secure(uuid, jsonb)
  rename to start_exam_secure_phase5_base;

revoke all on function public.start_exam_secure_phase5_base(uuid, jsonb)
  from public, anon, authenticated;

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
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_consent public.agilecert_identity_proctoring_consents%rowtype;
  v_check public.agilecert_exam_identity_checks%rowtype;
  v_payload jsonb;
  v_session_id uuid;
  v_protected boolean := false;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = p_examination_id and active = true;

  if found then
    v_protected := v_policy.live_event_capture_enabled
      or v_policy.require_existing_identity_approval
      or v_policy.require_government_id
      or v_policy.require_selfie
      or v_policy.require_exam_day_identity_check
      or v_policy.require_camera
      or v_policy.require_microphone_permission
      or v_policy.require_fullscreen
      or v_policy.ai_visual_analysis_enabled;
  end if;

  if not v_protected then
    return public.start_exam_secure_phase5_base(p_examination_id, p_client_fingerprint);
  end if;

  select * into v_assignment
  from public.exam_assignments
  where examination_id = p_examination_id
    and candidate_id = v_candidate_id
    and status = 'assigned'
    and (available_from is null or available_from <= now())
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'An active examination assignment is required.';
  end if;

  select * into v_consent
  from public.agilecert_identity_proctoring_consents
  where candidate_id = v_candidate_id
    and examination_id = p_examination_id
    and policy_version = v_policy.policy_version
    and consent_version = v_policy.consent_version
    and withdrawn_at is null
  order by accepted_at desc
  limit 1;
  if not found then
    raise exception 'Accept the current identity and proctoring consent before starting this examination.';
  end if;

  if v_policy.require_existing_identity_approval
     and not public.agilecert_identity_is_approved(v_candidate_id, null) then
    raise exception 'Approved IIPM identity assurance is required for this examination.';
  end if;

  if v_policy.require_government_id and not exists (
    select 1
    from public.agilecert_sensitive_identity_documents d
    where d.candidate_id = v_candidate_id
      and d.status = 'approved'
      and (d.approved_until is null or d.approved_until > now())
      and (d.expires_on is null or d.expires_on > current_date)
  ) then
    raise exception 'An approved unexpired government identity document is required for this examination.';
  end if;

  if v_policy.require_exam_day_identity_check then
    select * into v_check
    from public.agilecert_exam_identity_checks
    where assignment_id = v_assignment.id
      and candidate_id = v_candidate_id
      and examination_id = p_examination_id
      and status = 'approved'
    order by reviewed_at desc nulls last, created_at desc
    limit 1;
    if not found then
      raise exception 'An approved pre-examination identity check is required before the secure session can start.';
    end if;
  end if;

  v_payload := public.start_exam_secure_phase5_base(p_examination_id, p_client_fingerprint);
  v_session_id := nullif(v_payload->>'sessionId', '')::uuid;

  if v_check.id is not null and v_check.session_id is null then
    update public.agilecert_exam_identity_checks
    set session_id = v_session_id, updated_at = now()
    where id = v_check.id;
  end if;

  return (v_payload - 'questions') || jsonb_build_object(
    'questions', '[]'::jsonb,
    'proctorPreflightRequired', true,
    'identityCheckRequired', v_policy.require_exam_day_identity_check,
    'proctoringPolicy', jsonb_build_object(
      'policyVersion', v_policy.policy_version,
      'consentVersion', v_policy.consent_version,
      'requireCamera', v_policy.require_camera,
      'requireMicrophone', v_policy.require_microphone_permission,
      'requireFullscreen', v_policy.require_fullscreen,
      'liveEventCaptureEnabled', v_policy.live_event_capture_enabled,
      'aiVisualAnalysisEnabled', v_policy.ai_visual_analysis_enabled,
      'retainWebcamImages', v_policy.retain_webcam_images
    )
  );
end;
$$;

create or replace function public.get_my_agilecert_proctored_exam_payload(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_session public.exam_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_proctor public.agilecert_proctoring_sessions%rowtype;
  v_payload jsonb;
begin
  select * into v_session
  from public.exam_sessions
  where id = p_session_id
    and candidate_id = v_candidate_id
    and status = 'active'
    and expires_at > now();
  if not found then
    raise exception 'The active secure examination session was not found.';
  end if;

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = v_session.examination_id and active = true;
  if not found then
    raise exception 'The examination proctoring policy is unavailable.';
  end if;

  select * into v_proctor
  from public.agilecert_proctoring_sessions
  where session_id = p_session_id
    and candidate_id = v_candidate_id
    and status = 'active';
  if not found then
    raise exception 'Open the live proctoring session before accessing examination questions.';
  end if;

  if v_policy.require_camera and v_proctor.camera_permission <> 'granted' then
    raise exception 'Camera access is required before examination questions can be accessed.';
  end if;
  if v_policy.require_microphone_permission and v_proctor.microphone_permission <> 'granted' then
    raise exception 'Microphone permission is required before examination questions can be accessed.';
  end if;
  if v_policy.require_fullscreen and v_proctor.fullscreen_status <> 'entered' then
    raise exception 'Fullscreen mode is required before examination questions can be accessed.';
  end if;
  if v_policy.require_exam_day_identity_check and not exists (
    select 1 from public.agilecert_exam_identity_checks c
    where c.session_id = p_session_id and c.candidate_id = v_candidate_id and c.status = 'approved'
  ) then
    raise exception 'The approved examination-day identity check is unavailable.';
  end if;

  v_payload := public.start_exam_secure_phase5_base(
    v_session.examination_id,
    v_session.client_fingerprint
  );

  return v_payload || jsonb_build_object(
    'proctorPreflightRequired', false,
    'proctoringSessionId', v_proctor.id,
    'proctoringRiskScore', v_proctor.risk_score,
    'proctoringRiskLevel', v_proctor.risk_level
  );
end;
$$;

alter function public.submit_exam_secure(uuid, jsonb, jsonb, integer)
  rename to submit_exam_secure_phase5_base;

revoke all on function public.submit_exam_secure_phase5_base(uuid, jsonb, jsonb, integer)
  from public, anon, authenticated;

create or replace function public.submit_exam_secure(
  p_session_id uuid,
  p_answers jsonb,
  p_logs jsonb default '[]'::jsonb,
  p_tab_away_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_has_live_proctoring boolean := false;
  v_result jsonb;
  v_attempt_id uuid;
begin
  select exists (
    select 1
    from public.agilecert_proctoring_sessions ps
    where ps.session_id = p_session_id
      and ps.candidate_id = v_candidate_id
  ) into v_has_live_proctoring;

  v_result := public.submit_exam_secure_phase5_base(
    p_session_id,
    p_answers,
    case when v_has_live_proctoring then '[]'::jsonb else coalesce(p_logs, '[]'::jsonb) end,
    p_tab_away_count
  );

  begin
    v_attempt_id := nullif(v_result->>'id', '')::uuid;
  exception when invalid_text_representation then
    v_attempt_id := null;
  end;

  if v_has_live_proctoring then
    update public.agilecert_proctoring_sessions
    set status = 'submitted', ended_at = coalesce(ended_at, now()), updated_at = now()
    where session_id = p_session_id and candidate_id = v_candidate_id;

    update public.agilecert_proctoring_incidents
    set attempt_id = coalesce(attempt_id, v_attempt_id), updated_at = now()
    where session_id = p_session_id;

    update public.agilecert_misconduct_cases
    set attempt_id = coalesce(attempt_id, v_attempt_id), updated_at = now()
    where session_id = p_session_id;
  end if;

  return v_result;
end;
$$;

-- Retention reporting. File deletion remains an explicit administrator/storage
-- operation so no database function silently destroys sensitive evidence.
create or replace function public.get_agilecert_identity_proctoring_retention_queue(
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_identity_proctor_admin();
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 1000));
begin
  return jsonb_build_object(
    'identityDocuments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'candidateId', d.candidate_id,
        'documentObjectPath', d.document_object_path,
        'selfieObjectPath', d.selfie_object_path,
        'status', d.status,
        'retentionDeleteAfter', d.retention_delete_after
      ) order by d.retention_delete_after)
      from (
        select * from public.agilecert_sensitive_identity_documents
        where retention_delete_after <= now() and status <> 'deleted'
        order by retention_delete_after
        limit v_limit
      ) d
    ), '[]'::jsonb),
    'expiredProctorEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', pe.id,
        'proctoringSessionId', pe.proctoring_session_id,
        'occurredAt', pe.occurred_at
      ) order by pe.occurred_at)
      from public.proctor_events pe
      join public.agilecert_proctoring_sessions ps on ps.id = pe.proctoring_session_id
      join public.agilecert_identity_proctoring_policies ip on ip.examination_id = ps.examination_id
      where pe.occurred_at + make_interval(days => ip.proctor_event_retention_days) <= now()
      limit v_limit
    ), '[]'::jsonb),
    'adminId', v_admin_id,
    'generatedAt', now()
  );
end;
$$;

-- Direct table access is prohibited. All candidate and administrator operations
-- use the security-definer RPCs above, with explicit role checks.
revoke all on table public.agilecert_identity_proctoring_policies from public, anon, authenticated;
revoke all on table public.agilecert_identity_proctoring_consents from public, anon, authenticated;
revoke all on table public.agilecert_identity_proctoring_audits from public, anon, authenticated;
revoke all on table public.agilecert_sensitive_identity_documents from public, anon, authenticated;
revoke all on table public.agilecert_exam_identity_checks from public, anon, authenticated;
revoke all on table public.agilecert_proctoring_sessions from public, anon, authenticated;
revoke all on table public.agilecert_proctoring_incidents from public, anon, authenticated;
revoke all on table public.agilecert_misconduct_cases from public, anon, authenticated;
revoke all on table public.agilecert_misconduct_appeals from public, anon, authenticated;

revoke all on function public.agilecert_require_identity_proctor_admin() from public, anon, authenticated;
revoke all on function public.agilecert_seed_identity_proctoring_policy() from public, anon, authenticated;
revoke all on function public.agilecert_guard_proctor_event_privacy() from public, anon, authenticated;
revoke all on function public.agilecert_refresh_proctoring_session_risk(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_refresh_proctoring_session_risk_trigger() from public, anon, authenticated;
revoke all on function public.agilecert_sync_proctoring_session_from_exam_session() from public, anon, authenticated;
revoke all on function public.agilecert_create_threshold_incident() from public, anon, authenticated;
revoke all on function public.agilecert_hold_attempt_before_insert() from public, anon, authenticated;
revoke all on function public.agilecert_link_attempt_after_insert() from public, anon, authenticated;

revoke all on function public.record_my_agilecert_identity_proctoring_consent(uuid, boolean, boolean, boolean, boolean, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.submit_my_agilecert_sensitive_identity(uuid, text, text, text, date, date, text, text, text, bigint, text, text, text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.submit_my_agilecert_exam_identity_check(uuid, text, text, text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.prepare_my_agilecert_exam_identity_check(uuid, text, text, text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.open_my_agilecert_proctoring_session(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_my_agilecert_proctoring_event(uuid, text, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_my_agilecert_incident_explanation(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_my_agilecert_misconduct_appeal(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_my_agilecert_identity_proctoring_workspace() from public, anon, authenticated;
revoke all on function public.get_agilecert_identity_proctoring_admin_console(integer) from public, anon, authenticated;
revoke all on function public.upsert_agilecert_identity_proctoring_policy(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, numeric, numeric, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.review_agilecert_sensitive_identity(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.review_agilecert_exam_identity_check(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.decide_agilecert_misconduct_case(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.decide_agilecert_misconduct_appeal(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.get_my_agilecert_proctored_exam_payload(uuid) from public, anon, authenticated;
revoke all on function public.get_agilecert_identity_proctoring_retention_queue(integer) from public, anon, authenticated;
revoke all on function public.start_exam_secure(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) from public, anon, authenticated;

grant execute on function public.record_my_agilecert_identity_proctoring_consent(uuid, boolean, boolean, boolean, boolean, boolean, boolean, jsonb) to authenticated;
grant execute on function public.submit_my_agilecert_sensitive_identity(uuid, text, text, text, date, date, text, text, text, bigint, text, text, text, bigint, boolean) to authenticated;
grant execute on function public.submit_my_agilecert_exam_identity_check(uuid, text, text, text, bigint, boolean) to authenticated;
grant execute on function public.prepare_my_agilecert_exam_identity_check(uuid, text, text, text, bigint, boolean) to authenticated;
grant execute on function public.open_my_agilecert_proctoring_session(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.record_my_agilecert_proctoring_event(uuid, text, text, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.submit_my_agilecert_incident_explanation(uuid, text) to authenticated;
grant execute on function public.submit_my_agilecert_misconduct_appeal(uuid, text, text) to authenticated;
grant execute on function public.get_my_agilecert_identity_proctoring_workspace() to authenticated;
grant execute on function public.get_agilecert_identity_proctoring_admin_console(integer) to authenticated;
grant execute on function public.upsert_agilecert_identity_proctoring_policy(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, numeric, numeric, integer, integer, integer, integer, boolean) to authenticated;
grant execute on function public.review_agilecert_sensitive_identity(uuid, text, text, integer) to authenticated;
grant execute on function public.review_agilecert_exam_identity_check(uuid, text, text, text, text) to authenticated;
grant execute on function public.decide_agilecert_misconduct_case(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.decide_agilecert_misconduct_appeal(uuid, text, text, text) to authenticated;
grant execute on function public.get_my_agilecert_proctored_exam_payload(uuid) to authenticated;
grant execute on function public.get_agilecert_identity_proctoring_retention_queue(integer) to authenticated;
grant execute on function public.start_exam_secure(uuid, jsonb) to authenticated;
grant execute on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) to authenticated;

commit;
