-- C1-E: align the mandatory-profile secure-start layer with the already deployed
-- CIPMN-MOCK repeatable-practice policy. This preserves profile completeness,
-- payment/assignment existence, availability/expiry, session security and all
-- non-CIPMN attempt ceilings. Historical attempts/status are not rewritten.

CREATE OR REPLACE FUNCTION public.start_exam_secure_profile_base(
  p_examination_id uuid,
  p_client_fingerprint jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_candidate_id uuid := auth.uid();
  v_exam public.examinations%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_session public.exam_sessions%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
  v_expiry timestamptz;
  v_test jsonb;
  v_programme_code text;
begin
  if v_candidate_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (select 1 from public.profiles where id = v_candidate_id and role = 'candidate' and is_active = true) then
    raise exception 'Only an active candidate account may start an examination.';
  end if;
  if not public.agilecert_candidate_profile_is_complete(v_candidate_id) then
    raise exception 'Complete your mandatory candidate profile before starting an examination.';
  end if;

  select * into v_exam from public.examinations where id = p_examination_id for update;
  if not found or v_exam.status <> 'published' then raise exception 'This examination is not available.'; end if;
  select p.code into v_programme_code from public.programmes p where p.id = v_exam.programme_id;
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

  -- Repeatable CIPMN practice may relaunch from historical completed state only.
  -- Revoked/expired assignments and all non-CIPMN inactive assignments stay blocked.
  if not (v_programme_code = 'CIPMN-MOCK' and v_assignment.status = 'completed')
     and v_assignment.status <> 'assigned' then
    raise exception 'This examination access is not active.';
  end if;
  if v_assignment.available_from is not null and v_assignment.available_from > now() then
    raise exception 'This examination access is not yet available.';
  end if;
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
    -- All programmes except CIPMN-MOCK retain their existing attempt ceilings.
    if v_programme_code <> 'CIPMN-MOCK' then
      select count(*) into v_attempt_count from public.attempts
      where examination_id = p_examination_id and candidate_id = v_candidate_id;
      v_max_attempts := coalesce(v_assignment.max_attempts_override, v_exam.max_attempts);
      if v_attempt_count >= v_max_attempts then
        update public.exam_assignments set status = 'completed' where id = v_assignment.id;
        raise exception 'The maximum number of attempts has been reached.';
      end if;
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
$function$;
