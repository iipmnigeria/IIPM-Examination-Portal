begin;

-- Preserve automatic legacy-score correction notes when an administrator later
-- records an evidence decision. The immutable review table remains the primary
-- decision history; attempt review_notes retains the concise combined context.

create or replace function public.review_agilecert_attempt_integrity(
  p_attempt_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_score numeric(5,2);
  v_event_count integer;
  v_high_count integer;
  v_visual_count integer;
  v_snapshot_count integer;
  v_new_status text;
begin
  if not public.is_exam_admin() then
    raise exception 'Examination administrator authority is required.';
  end if;
  if v_decision not in ('insufficient_evidence', 'clear', 'flag_attempt', 'invalidate_attempt') then
    raise exception 'Select a supported integrity decision.';
  end if;
  if v_reason is null or length(v_reason) < 15 then
    raise exception 'Provide a review reason of at least 15 characters.';
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then raise exception 'The examination attempt was not found.'; end if;

  v_score := public.agilecert_session_evidence_score(v_attempt.session_id);
  select
    count(*) filter (where public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0),
    count(*) filter (where pe.severity = 'high' and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0),
    count(*) filter (where public.agilecert_is_visual_proctor_event(pe.event_type)),
    count(*) filter (where pe.snapshot_path is not null)
  into v_event_count, v_high_count, v_visual_count, v_snapshot_count
  from public.proctor_events pe where pe.session_id = v_attempt.session_id;

  if v_decision = 'flag_attempt' and (coalesce(v_event_count, 0) = 0 or v_score < 25) then
    raise exception 'An attempt cannot be flagged without persisted evidence and an evidence score of at least 25.';
  end if;
  if v_decision = 'invalidate_attempt'
     and (v_score < 60 or (coalesce(v_snapshot_count, 0) = 0 and coalesce(v_high_count, 0) < 2)) then
    raise exception 'Invalidation requires a score of at least 60 and either visual evidence or two high-severity nonvisual events.';
  end if;

  v_new_status := case
    when v_decision in ('insufficient_evidence', 'clear') then 'reviewed'
    when v_decision = 'flag_attempt' then 'flagged'
    else 'terminated'
  end;

  update public.attempts
  set status = v_new_status,
      suspicious_score = v_score,
      reviewed_by = v_reviewer_id,
      review_notes = left(concat_ws(' ', nullif(v_attempt.review_notes, ''), v_reason), 2000),
      updated_at = now()
  where id = p_attempt_id;

  update public.exam_sessions
  set suspicious_score = v_score,
      updated_at = now()
  where id = v_attempt.session_id;

  insert into public.agilecert_attempt_integrity_reviews (
    attempt_id, reviewer_id, decision, reason, evidence_score,
    event_count, high_event_count, visual_event_count, snapshot_count, evidence_snapshot
  ) values (
    p_attempt_id, v_reviewer_id, v_decision, left(v_reason, 2000), v_score,
    coalesce(v_event_count, 0), coalesce(v_high_count, 0), coalesce(v_visual_count, 0), coalesce(v_snapshot_count, 0),
    jsonb_build_object(
      'sessionId', v_attempt.session_id,
      'capturedAt', now(),
      'storedScoreBeforeReview', v_attempt.suspicious_score,
      'priorReviewNotes', v_attempt.review_notes
    )
  );

  return jsonb_build_object(
    'attemptId', p_attempt_id,
    'decision', v_decision,
    'status', v_new_status,
    'evidenceRiskScore', v_score,
    'eventCount', coalesce(v_event_count, 0),
    'snapshotCount', coalesce(v_snapshot_count, 0)
  );
end;
$$;

revoke all on function public.review_agilecert_attempt_integrity(uuid, text, text) from public, anon;
grant execute on function public.review_agilecert_attempt_integrity(uuid, text, text) to authenticated;

commit;
