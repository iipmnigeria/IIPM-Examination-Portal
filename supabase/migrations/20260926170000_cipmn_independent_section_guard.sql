-- CIPMN independent-section hotfix
-- Prevent a new MCQ launch from silently terminating an unfinished Theory session.
-- This migration changes only start_cipmn_mcq_attempt orchestration.

create or replace function public.start_cipmn_mcq_attempt(
  p_examination_id uuid,
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 v_uid uuid:=auth.uid();
 v_exam public.examinations%rowtype;
 v_assignment public.exam_assignments%rowtype;
 v_session public.exam_sessions%rowtype;
 v_programme_code text;
 v_expiry timestamptz;
 v_policy public.agilecert_identity_proctoring_policies%rowtype;
 v_protected boolean:=false;
begin
 if v_uid is null then raise exception 'Authentication is required.'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and role='candidate' and is_active=true) then
   raise exception 'Only an active candidate account may start an examination.';
 end if;
 if not public.agilecert_candidate_profile_is_complete(v_uid) then
   raise exception 'Complete your mandatory candidate profile before starting an examination.';
 end if;

 select * into v_exam from public.examinations where id=p_examination_id for update;
 if not found or v_exam.status<>'published' then raise exception 'This examination is not available.'; end if;
 select code into v_programme_code from public.programmes where id=v_exam.programme_id;
 if v_programme_code<>'CIPMN-MOCK' or v_exam.exam_format<>'cipmn_mixed' then
   raise exception 'The section-aware MCQ launcher is only available for CIPMN mixed examinations.';
 end if;
 if v_exam.starts_at is not null and v_exam.starts_at>now() then raise exception 'This examination has not opened.'; end if;
 if v_exam.ends_at is not null and v_exam.ends_at<=now() then raise exception 'This examination has closed.'; end if;

 select * into v_assignment
 from public.exam_assignments
 where examination_id=p_examination_id and candidate_id=v_uid
 for update;

 if not found then raise exception 'You have not been granted access to this examination.'; end if;
 if v_assignment.status not in ('assigned','completed') then raise exception 'This examination access is not active.'; end if;
 if v_assignment.available_from is not null and v_assignment.available_from>now() then raise exception 'This examination access is not yet available.'; end if;
 if v_assignment.expires_at is not null and v_assignment.expires_at<=now() then raise exception 'This examination access has expired.'; end if;

 update public.exam_sessions
 set status='expired',updated_at=now()
 where assignment_id=v_assignment.id and status='active' and expires_at<=now();

 select * into v_session
 from public.exam_sessions
 where assignment_id=v_assignment.id and status='active'
 order by started_at desc
 limit 1;

 if found then
   if v_session.current_section='theory' then
     raise exception 'Theory is already ready or in progress for this module. Complete or submit Theory before starting another MCQ attempt.';
   end if;
   if v_session.current_section<>'mcq' then
     raise exception 'An examination session is already active for this module.';
   end if;
 else
   v_expiry:=now()+make_interval(mins=>v_exam.duration_minutes);
   if v_exam.ends_at is not null then v_expiry:=least(v_expiry,v_exam.ends_at); end if;
   if v_assignment.expires_at is not null then v_expiry:=least(v_expiry,v_assignment.expires_at); end if;

   insert into public.exam_sessions(
     assignment_id,examination_id,candidate_id,status,started_at,expires_at,client_fingerprint,current_section
   )
   values(
     v_assignment.id,p_examination_id,v_uid,'active',now(),v_expiry,coalesce(p_client_fingerprint,'{}'::jsonb),'mcq'
   )
   returning * into v_session;
 end if;

 select * into v_policy
 from public.agilecert_identity_proctoring_policies
 where examination_id=p_examination_id and active=true;

 if found then
   v_protected:=v_policy.require_camera or v_policy.live_event_capture_enabled or v_policy.ai_visual_analysis_enabled;
 end if;

 return jsonb_build_object(
   'id',v_exam.id,
   'title',v_exam.title,
   'course',v_programme_code,
   'durationMinutes',greatest(1,ceil(extract(epoch from(v_session.expires_at-now()))/60.0)::integer),
   'questionCount',25,
   'mcqCount',25,
   'theoryCount',5,
   'examFormat','cipmn_mixed',
   'currentSection','mcq',
   'description',coalesce((select description from public.programmes where id=v_exam.programme_id),v_exam.instructions,''),
   'sessionId',v_session.id,
   'expiresAt',v_session.expires_at,
   'assignmentId',v_assignment.id,
   'questions','[]'::jsonb,
   'proctorPreflightRequired',v_protected,
   'identityCheckRequired',false,
   'proctoringPolicy',case when v_protected then jsonb_build_object(
     'policyVersion',v_policy.policy_version,
     'consentVersion',v_policy.consent_version,
     'requireCamera',v_policy.require_camera,
     'requireMicrophone',v_policy.require_microphone_permission,
     'requireFullscreen',v_policy.require_fullscreen,
     'liveEventCaptureEnabled',v_policy.live_event_capture_enabled,
     'aiVisualAnalysisEnabled',v_policy.ai_visual_analysis_enabled,
     'retainWebcamImages',v_policy.retain_webcam_images
   ) else null end
 );
end;
$function$;
