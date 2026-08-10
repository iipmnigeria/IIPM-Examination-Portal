-- Require a verified live camera preflight for all CIPMN mock examinations.
-- Questions stay server-protected until a proctoring session confirms camera permission.

alter function public.start_exam_secure(uuid, jsonb)
  rename to start_exam_secure_profile_base;

revoke all on function public.start_exam_secure_profile_base(uuid, jsonb)
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
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_payload jsonb;
  v_protected boolean := false;
begin
  v_payload := public.start_exam_secure_profile_base(
    p_examination_id,
    coalesce(p_client_fingerprint, '{}'::jsonb)
  );

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = p_examination_id
    and active = true;

  if found then
    v_protected := v_policy.require_camera
      or v_policy.live_event_capture_enabled
      or v_policy.ai_visual_analysis_enabled;
  end if;

  if not v_protected then
    return v_payload;
  end if;

  return (v_payload - 'questions') || jsonb_build_object(
    'questions', '[]'::jsonb,
    'proctorPreflightRequired', true,
    'identityCheckRequired', false,
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

revoke all on function public.start_exam_secure(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_exam_secure(uuid, jsonb)
  to authenticated;

update public.agilecert_identity_proctoring_policies p
set require_camera = true,
    ai_visual_analysis_enabled = true,
    live_event_capture_enabled = true,
    policy_version = p.policy_version + 1,
    consent_version = 'cipmn-camera-v1',
    active = true,
    updated_at = now()
from public.examinations e
where e.id = p.examination_id
  and e.code like 'CIPMN-MOD-%';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.examinations e
  join public.agilecert_identity_proctoring_policies p
    on p.examination_id = e.id
  where e.code like 'CIPMN-MOD-%'
    and p.active = true
    and p.require_camera = true
    and p.ai_visual_analysis_enabled = true
    and p.live_event_capture_enabled = true;

  if v_count <> 12 then
    raise exception 'Expected 12 mandatory CIPMN camera policies, found %.', v_count;
  end if;
end;
$$;
