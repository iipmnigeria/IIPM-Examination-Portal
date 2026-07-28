\set ON_ERROR_STOP on

-- The unsubstantiated legacy 75% score must be removed by reconciliation.
do $$
declare
  v_attempt public.attempts%rowtype;
  v_session public.exam_sessions%rowtype;
begin
  select * into v_attempt
  from public.attempts
  where id = '00000000-0000-0000-0000-000000000005';

  if v_attempt.suspicious_score <> 0 or v_attempt.status <> 'submitted' then
    raise exception 'Legacy attempt was not reconciled: score %, status %', v_attempt.suspicious_score, v_attempt.status;
  end if;
  if coalesce(v_attempt.review_notes, '') not like '%Legacy suspicion score removed%' then
    raise exception 'Legacy reconciliation note was not retained.';
  end if;

  select * into v_session
  from public.exam_sessions
  where id = '00000000-0000-0000-0000-000000000004';
  if v_session.suspicious_score <> 0 then
    raise exception 'Legacy session score was not reconciled.';
  end if;
end
$$;

-- A visual AI alert without a stored image is an event record, but not evidence
-- for a numerical adverse-risk score.
insert into public.exam_sessions (id, candidate_id) values
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002');

insert into public.proctor_events (
  id, session_id, candidate_id, event_type, severity, message, metadata
) values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000002',
  'phone_detected', 'high',
  'AI Alert: A phone may be visible. (Confidence: 88%)',
  '{}'::jsonb
);

insert into public.attempts (
  id, session_id, examination_id, candidate_id, percentage, status,
  suspicious_score, started_at, submitted_at
) values (
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  80, 'flagged', 75, now() - interval '30 minutes', now()
);

do $$
declare
  v_attempt public.attempts%rowtype;
  v_event public.proctor_events%rowtype;
begin
  select * into v_attempt from public.attempts where id = '00000000-0000-0000-0000-000000000007';
  if v_attempt.suspicious_score <> 0 or v_attempt.status <> 'submitted' then
    raise exception 'Missing-snapshot visual alert incorrectly created adverse risk.';
  end if;

  select * into v_event from public.proctor_events where id = '00000000-0000-0000-0000-000000000010';
  if v_event.risk_weight <> 0 or v_event.snapshot_path is not null then
    raise exception 'Missing-snapshot visual event was not neutralised.';
  end if;
  if v_event.confidence <> 0.88 then
    raise exception 'AI confidence was not extracted into a structured field: %', v_event.confidence;
  end if;
end
$$;

-- A visual alert with a validated private object path contributes evidence risk.
insert into public.exam_sessions (id, candidate_id) values
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002');

insert into storage.objects (bucket_id, name) values (
  'agilecert-proctor-evidence',
  '00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000008/phone-alert.jpg'
);

insert into public.proctor_events (
  id, session_id, candidate_id, event_type, severity, message, metadata
) values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000002',
  'phone_detected', 'high',
  'AI Alert: A phone is visible beside the candidate. (Confidence: 92%)',
  jsonb_build_object(
    'snapshotPath',
    '00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000008/phone-alert.jpg'
  )
);

insert into public.attempts (
  id, session_id, examination_id, candidate_id, percentage, status,
  suspicious_score, started_at, submitted_at
) values (
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  82, 'submitted', 0, now() - interval '20 minutes', now()
);

do $$
declare
  v_attempt public.attempts%rowtype;
  v_event public.proctor_events%rowtype;
begin
  select * into v_attempt from public.attempts where id = '00000000-0000-0000-0000-000000000009';
  if v_attempt.suspicious_score <> 25 or v_attempt.status <> 'submitted' then
    raise exception 'Retained visual evidence was not scored correctly: score %, status %', v_attempt.suspicious_score, v_attempt.status;
  end if;

  select * into v_event from public.proctor_events where id = '00000000-0000-0000-0000-000000000011';
  if v_event.risk_weight <> 25 or v_event.confidence <> 0.92 or v_event.snapshot_path is null then
    raise exception 'Structured visual evidence was not retained correctly.';
  end if;
  if v_event.source <> 'live_ai' then
    raise exception 'Visual event source was not classified as live_ai.';
  end if;
end
$$;

-- Review actions must be administrator-authenticated and evidence constrained.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

select public.review_agilecert_attempt_integrity(
  '00000000-0000-0000-0000-000000000009',
  'flag_attempt',
  'Persisted phone detection is supported by a retained private snapshot.'
);

do $$
declare
  v_attempt public.attempts%rowtype;
  v_review_count integer;
  v_payload jsonb;
begin
  select * into v_attempt from public.attempts where id = '00000000-0000-0000-0000-000000000009';
  if v_attempt.status <> 'flagged' or v_attempt.suspicious_score <> 25 then
    raise exception 'Evidence-backed flag decision was not persisted.';
  end if;

  select count(*) into v_review_count
  from public.agilecert_attempt_integrity_reviews
  where attempt_id = v_attempt.id and decision = 'flag_attempt';
  if v_review_count <> 1 then
    raise exception 'Immutable administrator review was not created.';
  end if;

  v_payload := public.get_agilecert_attempt_integrity_evidence(v_attempt.id);
  if (v_payload #>> '{summary,evidenceRiskScore}')::numeric <> 25
     or (v_payload #>> '{summary,snapshotCount}')::integer <> 1 then
    raise exception 'Evidence RPC returned an incorrect summary: %', v_payload;
  end if;
end
$$;

-- A 25-point event cannot justify invalidation.
do $$
begin
  begin
    perform public.review_agilecert_attempt_integrity(
      '00000000-0000-0000-0000-000000000009',
      'invalidate_attempt',
      'This intentionally tests that insufficient evidence cannot invalidate.'
    );
    raise exception 'Invalidation unexpectedly succeeded with insufficient evidence.';
  exception when others then
    if sqlerrm not like 'Invalidation requires a score of at least 60%' then
      raise;
    end if;
  end;
end
$$;
