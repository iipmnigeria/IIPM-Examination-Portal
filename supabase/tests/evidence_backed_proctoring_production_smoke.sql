\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

-- The exact reported defect: 75% and flagged, but no persisted evidence.
do $$
declare
  v_score numeric;
  v_status text;
  v_notes text;
  v_session_score numeric;
  v_live_score numeric;
begin
  select suspicious_score, status, review_notes
  into v_score, v_status, v_notes
  from public.attempts
  where id = '10000000-0000-0000-0000-000000000040';

  if v_score <> 0 then
    raise exception 'Legacy score was not reset to zero: %', v_score;
  end if;
  if v_status <> 'submitted' then
    raise exception 'Unsupported legacy flag was not cleared: %', v_status;
  end if;
  if position('Legacy suspicion score removed' in coalesce(v_notes, '')) = 0 then
    raise exception 'Legacy correction audit note was not recorded.';
  end if;

  select suspicious_score into v_session_score
  from public.exam_sessions
  where id = '10000000-0000-0000-0000-000000000030';
  if v_session_score <> 0 then
    raise exception 'Legacy exam-session score was not reset: %', v_session_score;
  end if;

  select risk_score into v_live_score
  from public.agilecert_proctoring_sessions
  where id = '10000000-0000-0000-0000-000000000050';
  if v_live_score <> 0 then
    raise exception 'Legacy live-proctor score was not reconciled: %', v_live_score;
  end if;
end;
$$;

-- Private storage and server functions must exist.
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'agilecert-proctor-evidence' and public = false
  ) then
    raise exception 'Private proctor evidence bucket is unavailable.';
  end if;
  if to_regprocedure('public.get_agilecert_attempt_integrity_evidence(uuid)') is null then
    raise exception 'Detailed evidence RPC is unavailable.';
  end if;
  if to_regprocedure('public.review_agilecert_attempt_integrity(uuid,text,text)') is null then
    raise exception 'Integrity review RPC is unavailable.';
  end if;
end;
$$;

-- A flag cannot be recreated without supporting evidence.
do $$
begin
  begin
    perform public.review_agilecert_attempt_integrity(
      '10000000-0000-0000-0000-000000000040',
      'flag_attempt',
      'This deliberately unsupported flag must be rejected.'
    );
    raise exception 'Unsupported flag unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Unsupported flag unexpectedly succeeded.' then raise; end if;
    if position('cannot be flagged without persisted evidence' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

select public.review_agilecert_attempt_integrity(
  '10000000-0000-0000-0000-000000000040',
  'insufficient_evidence',
  'No persisted event or photographic evidence supports the legacy percentage.'
);

do $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status from public.attempts
  where id = '10000000-0000-0000-0000-000000000040';
  if v_status <> 'reviewed' then
    raise exception 'Insufficient-evidence review was not persisted: %', v_status;
  end if;
  select count(*) into v_count
  from public.agilecert_attempt_integrity_reviews
  where attempt_id = '10000000-0000-0000-0000-000000000040'
    and decision = 'insufficient_evidence';
  if v_count <> 1 then
    raise exception 'Expected one immutable legacy review, found %.', v_count;
  end if;
end;
$$;

-- Review history cannot be rewritten.
do $$
begin
  begin
    update public.agilecert_attempt_integrity_reviews
    set reason = 'Attempted mutation'
    where attempt_id = '10000000-0000-0000-0000-000000000040';
    raise exception 'Immutable review update unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Immutable review update unexpectedly succeeded.' then raise; end if;
    if position('immutable' in lower(sqlerrm)) = 0 then raise; end if;
  end;
end;
$$;

-- Create a private object and attach it to an actual AI event.
insert into storage.objects (bucket_id, name)
values (
  'agilecert-proctor-evidence',
  '10000000-0000-0000-0000-000000000003/10000000-0000-0000-0000-000000000031/ai-phone-test.jpg'
)
on conflict do nothing;

insert into public.proctor_events (
  session_id, candidate_id, event_type, severity, confidence, message,
  snapshot_path, metadata, occurred_at, proctoring_session_id,
  client_event_id, source, risk_weight
) values (
  '10000000-0000-0000-0000-000000000031',
  '10000000-0000-0000-0000-000000000003',
  'phone_detected', 'high', null,
  'AI visual analysis detected a phone in the examination frame.',
  null,
  jsonb_build_object(
    'source', 'live_ai',
    'confidence', 0.91,
    'snapshotPath', '10000000-0000-0000-0000-000000000003/10000000-0000-0000-0000-000000000031/ai-phone-test.jpg'
  ),
  now(),
  '10000000-0000-0000-0000-000000000051',
  'ai-phone-test',
  'live_browser',
  0
);

-- A visual alert without a retained image is reportable but contributes zero risk.
insert into public.proctor_events (
  session_id, candidate_id, event_type, severity, confidence, message,
  metadata, occurred_at, proctoring_session_id, client_event_id, source, risk_weight
) values (
  '10000000-0000-0000-0000-000000000031',
  '10000000-0000-0000-0000-000000000003',
  'looking_away', 'high', 0.88,
  'AI visual analysis indicated repeated looking away without a retained frame.',
  jsonb_build_object('source', 'live_ai'),
  now(),
  '10000000-0000-0000-0000-000000000051',
  'ai-looking-away-no-frame',
  'live_ai',
  20
);

do $$
declare
  v_path text;
  v_source text;
  v_confidence numeric;
  v_weight numeric;
  v_missing_weight numeric;
  v_attempt_score numeric;
  v_live_score numeric;
  v_evidence jsonb;
begin
  select snapshot_path, source, confidence, risk_weight
  into v_path, v_source, v_confidence, v_weight
  from public.proctor_events
  where client_event_id = 'ai-phone-test';

  if v_path is null then raise exception 'AI snapshot path was not retained.'; end if;
  if v_source <> 'live_ai' then raise exception 'AI source was not structured: %', v_source; end if;
  if v_confidence <> 0.91 then raise exception 'AI confidence was not structured: %', v_confidence; end if;
  if v_weight <> 25 then raise exception 'Visual evidence weight is incorrect: %', v_weight; end if;

  select risk_weight into v_missing_weight
  from public.proctor_events
  where client_event_id = 'ai-looking-away-no-frame';
  if v_missing_weight <> 0 then
    raise exception 'Visual event without a snapshot received risk weight: %', v_missing_weight;
  end if;

  select suspicious_score into v_attempt_score
  from public.attempts
  where id = '10000000-0000-0000-0000-000000000041';
  if v_attempt_score <> 25 then
    raise exception 'Attempt evidence score is incorrect: %', v_attempt_score;
  end if;

  select risk_score into v_live_score
  from public.agilecert_proctoring_sessions
  where id = '10000000-0000-0000-0000-000000000051';
  if v_live_score <> 25 then
    raise exception 'Live proctor score is inconsistent: %', v_live_score;
  end if;

  v_evidence := public.get_agilecert_attempt_integrity_evidence(
    '10000000-0000-0000-0000-000000000041'
  );
  if (v_evidence #>> '{summary,evidenceRiskScore}')::numeric <> 25 then
    raise exception 'Detailed evidence RPC returned an incorrect risk score.';
  end if;
  if (v_evidence #>> '{summary,snapshotCount}')::integer <> 1 then
    raise exception 'Detailed evidence RPC returned an incorrect snapshot count.';
  end if;
end;
$$;

-- An evidence-backed flag is allowed, but invalidation at only 25 risk is not.
select public.review_agilecert_attempt_integrity(
  '10000000-0000-0000-0000-000000000041',
  'flag_attempt',
  'A retained high-confidence phone-detection image supports administrator review.'
);

do $$
begin
  if not exists (
    select 1 from public.attempts
    where id = '10000000-0000-0000-0000-000000000041'
      and status = 'flagged' and suspicious_score = 25
  ) then
    raise exception 'Evidence-backed flag was not persisted correctly.';
  end if;

  begin
    perform public.review_agilecert_attempt_integrity(
      '10000000-0000-0000-0000-000000000041',
      'invalidate_attempt',
      'This deliberate low-score invalidation must be rejected by the server.'
    );
    raise exception 'Low-evidence invalidation unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Low-evidence invalidation unexpectedly succeeded.' then raise; end if;
    if position('Invalidation requires a score of at least 60' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

select
  a.id,
  a.status,
  a.suspicious_score,
  a.review_notes,
  ps.risk_score as live_risk_score,
  ps.event_count as live_event_count
from public.attempts a
left join public.agilecert_proctoring_sessions ps on ps.session_id = a.session_id
where a.id in (
  '10000000-0000-0000-0000-000000000040',
  '10000000-0000-0000-0000-000000000041'
)
order by a.id;
