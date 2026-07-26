begin;

-- Original Roadmap Phase 5 completion, compatibility unit 7:
-- keep misconduct outcomes, returned attempt status and Phase 3 certificate
-- eligibility aligned without changing scores, answers or answer keys.

create or replace function public.decide_agilecert_misconduct_case(
  p_case_id uuid,
  p_decision text,
  p_reason text,
  p_suspension_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.agilecert_require_identity_proctor_admin();
  v_case public.agilecert_misconduct_cases%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_role text;
begin
  if v_decision not in ('no_violation', 'warning', 'flag_attempt', 'invalidate_attempt', 'suspend_candidate') then
    raise exception 'Invalid misconduct decision.';
  end if;
  if v_reason is null or length(v_reason) < 10 then
    raise exception 'A decision reason of at least 10 characters is required.';
  end if;

  select role into v_role from public.profiles where id = v_admin;
  if v_decision = 'suspend_candidate' and v_role <> 'super_admin' then
    raise exception 'Only a Super Admin may suspend a candidate account.';
  end if;
  if v_decision = 'suspend_candidate'
     and (p_suspension_until is null or p_suspension_until <= now()) then
    raise exception 'A future suspension end date is required.';
  end if;

  select * into v_case
  from public.agilecert_misconduct_cases
  where id = p_case_id
  for update;
  if not found then
    raise exception 'The misconduct case was not found.';
  end if;

  update public.agilecert_misconduct_cases
  set status = 'decided',
      result_hold = false,
      decision = v_decision,
      decision_reason = left(v_reason, 4000),
      decided_at = now(),
      decided_by = v_admin,
      suspension_until = case when v_decision = 'suspend_candidate' then p_suspension_until else null end,
      updated_at = now()
  where id = v_case.id
  returning * into v_case;

  update public.agilecert_proctoring_incidents
  set status = 'decision_issued',
      resolved_at = now(),
      resolved_by = v_admin,
      resolution_summary = left(v_reason, 2000),
      updated_at = now()
  where id = v_case.incident_id;

  if v_case.attempt_id is not null then
    update public.attempts
    set status = case v_decision
          when 'no_violation' then 'submitted'
          when 'warning' then 'submitted'
          when 'flag_attempt' then 'flagged'
          else 'terminated'
        end,
        reviewed_by = v_admin,
        review_notes = left(v_reason, 2000),
        updated_at = now()
    where id = v_case.attempt_id;
  end if;

  if v_decision = 'suspend_candidate' then
    update public.profiles
    set is_active = false, updated_at = now()
    where id = v_case.candidate_id;
  end if;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, session_id, attempt_id,
    entity_type, entity_id, action, metadata
  ) values (
    v_case.candidate_id, v_admin, v_case.examination_id, v_case.session_id,
    v_case.attempt_id, 'misconduct_case', v_case.id,
    'misconduct_decision_issued',
    jsonb_build_object('decision', v_decision, 'reason', left(v_reason, 1000))
  );

  return jsonb_build_object(
    'id', v_case.id,
    'status', v_case.status,
    'decision', v_case.decision,
    'decidedAt', v_case.decided_at,
    'resultHold', v_case.result_hold
  );
end;
$$;

create or replace function public.decide_agilecert_misconduct_appeal(
  p_appeal_id uuid,
  p_outcome text,
  p_reason text,
  p_replacement_decision text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.agilecert_require_identity_proctor_admin();
  v_appeal public.agilecert_misconduct_appeals%rowtype;
  v_case public.agilecert_misconduct_cases%rowtype;
  v_outcome text := lower(trim(coalesce(p_outcome, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_replacement text := nullif(lower(trim(coalesce(p_replacement_decision, ''))), '');
  v_original_decision text;
begin
  if v_outcome not in ('upheld', 'partially_upheld', 'rejected') then
    raise exception 'Invalid appeal outcome.';
  end if;
  if v_reason is null or length(v_reason) < 10 then
    raise exception 'An appeal decision reason of at least 10 characters is required.';
  end if;
  if v_outcome in ('upheld', 'partially_upheld')
     and v_replacement not in ('no_violation', 'warning', 'flag_attempt', 'invalidate_attempt', 'suspend_candidate') then
    raise exception 'A valid replacement misconduct decision is required.';
  end if;

  select * into v_appeal
  from public.agilecert_misconduct_appeals
  where id = p_appeal_id and status in ('submitted', 'under_review')
  for update;
  if not found then
    raise exception 'The active appeal was not found.';
  end if;

  select * into v_case
  from public.agilecert_misconduct_cases
  where id = v_appeal.misconduct_case_id
  for update;
  v_original_decision := v_case.decision;

  update public.agilecert_misconduct_appeals
  set status = v_outcome,
      reviewed_at = now(),
      reviewed_by = v_admin,
      decision_reason = left(v_reason, 4000),
      replacement_decision = case when v_outcome in ('upheld', 'partially_upheld') then v_replacement else null end,
      updated_at = now()
  where id = v_appeal.id
  returning * into v_appeal;

  if v_outcome in ('upheld', 'partially_upheld') then
    update public.agilecert_misconduct_cases
    set status = 'closed',
        decision = v_replacement,
        decision_reason = left(v_reason, 4000),
        decided_at = now(),
        decided_by = v_admin,
        result_hold = false,
        suspension_until = case when v_replacement = 'suspend_candidate' then suspension_until else null end,
        updated_at = now()
    where id = v_case.id;

    if v_case.attempt_id is not null then
      update public.attempts
      set status = case v_replacement
            when 'no_violation' then 'submitted'
            when 'warning' then 'submitted'
            when 'flag_attempt' then 'flagged'
            else 'terminated'
          end,
          reviewed_by = v_admin,
          review_notes = left(v_reason, 2000),
          updated_at = now()
      where id = v_case.attempt_id;
    end if;

    if v_original_decision = 'suspend_candidate' and v_replacement <> 'suspend_candidate'
       and not exists (
         select 1
         from public.agilecert_misconduct_cases other_case
         where other_case.candidate_id = v_case.candidate_id
           and other_case.id <> v_case.id
           and other_case.decision = 'suspend_candidate'
           and other_case.status <> 'closed'
           and (other_case.suspension_until is null or other_case.suspension_until > now())
       ) then
      update public.profiles
      set is_active = true, updated_at = now()
      where id = v_case.candidate_id;
    end if;
  else
    update public.agilecert_misconduct_cases
    set status = 'closed', result_hold = false, updated_at = now()
    where id = v_case.id;
  end if;

  insert into public.agilecert_identity_proctoring_audits (
    candidate_id, actor_id, examination_id, session_id, attempt_id,
    entity_type, entity_id, action, metadata
  ) values (
    v_case.candidate_id, v_admin, v_case.examination_id, v_case.session_id,
    v_case.attempt_id, 'appeal', v_appeal.id, 'appeal_decided',
    jsonb_build_object('outcome', v_outcome, 'replacementDecision', v_replacement)
  );

  return jsonb_build_object(
    'id', v_appeal.id,
    'status', v_appeal.status,
    'replacementDecision', v_appeal.replacement_decision,
    'reviewedAt', v_appeal.reviewed_at
  );
end;
$$;

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
  v_attempt_status text;
  v_attempt_suspicious numeric(5,2);
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

  if v_attempt_id is not null then
    select status, suspicious_score
    into v_attempt_status, v_attempt_suspicious
    from public.attempts
    where id = v_attempt_id;

    v_result := v_result || jsonb_build_object(
      'status', v_attempt_status,
      'suspiciousScore', v_attempt_suspicious
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.decide_agilecert_misconduct_case(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.decide_agilecert_misconduct_appeal(uuid, text, text, text) from public, anon;
revoke all on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.decide_agilecert_misconduct_case(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.decide_agilecert_misconduct_appeal(uuid, text, text, text) to authenticated;
grant execute on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) to authenticated;

commit;
