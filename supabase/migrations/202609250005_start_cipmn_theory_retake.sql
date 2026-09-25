create or replace function public.start_cipmn_theory_retake(p_examination_id uuid, p_client_fingerprint jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
 v_uid uuid:=auth.uid(); v_exam public.examinations%rowtype; v_assignment public.exam_assignments%rowtype; v_previous public.exam_sessions%rowtype; v_session public.exam_sessions%rowtype; v_programme_code text; v_expiry timestamptz;
begin
 if v_uid is null then raise exception 'Authentication is required.'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and role='candidate' and is_active=true) then raise exception 'Only an active candidate account may start a theory retake.'; end if;
 select * into v_exam from public.examinations where id=p_examination_id for update;
 if not found then raise exception 'This examination is not available.'; end if;
 select code into v_programme_code from public.programmes where id=v_exam.programme_id;
 if v_exam.status<>'published' or v_exam.exam_format<>'cipmn_mixed' or v_programme_code<>'CIPMN-MOCK' then raise exception 'Theory retake is not available for this examination.'; end if;
 if v_exam.starts_at is not null and v_exam.starts_at>now() then raise exception 'This examination has not opened.'; end if;
 if v_exam.ends_at is not null and v_exam.ends_at<=now() then raise exception 'This examination has closed.'; end if;
 select * into v_assignment from public.exam_assignments where examination_id=p_examination_id and candidate_id=v_uid for update;
 if not found then raise exception 'You have not been granted access to this examination.'; end if;
 if v_assignment.status not in ('assigned','completed') then raise exception 'This examination access is not active.'; end if;
 if v_assignment.available_from is not null and v_assignment.available_from>now() then raise exception 'This examination access is not yet available.'; end if;
 if v_assignment.expires_at is not null and v_assignment.expires_at<=now() then raise exception 'This examination access has expired.'; end if;
 update public.exam_sessions set status='expired',updated_at=now() where assignment_id=v_assignment.id and status='active' and expires_at<=now();
 select * into v_session from public.exam_sessions where assignment_id=v_assignment.id and status='active' order by started_at desc limit 1;
 if found then
  if v_session.current_section='theory' then return jsonb_build_object('sessionId',v_session.id,'currentSection','theory','retake',true,'resumed',true,'mcqScore',v_session.mcq_percentage,'expiresAt',v_session.expires_at); end if;
  raise exception 'An MCQ examination session is already active. Complete or end that session before starting a theory retake.';
 end if;
 select * into v_previous from public.exam_sessions where assignment_id=v_assignment.id and status='submitted' and current_section='complete' and mcq_submitted_at is not null order by submitted_at desc nulls last,updated_at desc limit 1;
 if not found then raise exception 'Complete the MCQ and first theory section before starting a theory retake.'; end if;
 v_expiry:=now()+make_interval(mins=>v_exam.duration_minutes);
 if v_exam.ends_at is not null then v_expiry:=least(v_expiry,v_exam.ends_at); end if;
 if v_assignment.expires_at is not null then v_expiry:=least(v_expiry,v_assignment.expires_at); end if;
 insert into public.exam_sessions(assignment_id,examination_id,candidate_id,status,started_at,expires_at,client_fingerprint,current_section,mcq_submitted_at,mcq_percentage)
 values(v_assignment.id,p_examination_id,v_uid,'active',now(),v_expiry,coalesce(p_client_fingerprint,'{}'::jsonb),'theory',v_previous.mcq_submitted_at,v_previous.mcq_percentage) returning * into v_session;
 return jsonb_build_object('sessionId',v_session.id,'currentSection','theory','retake',true,'resumed',false,'mcqScore',v_session.mcq_percentage,'expiresAt',v_session.expires_at);
end;$function$;
grant execute on function public.start_cipmn_theory_retake(uuid,jsonb) to authenticated;
