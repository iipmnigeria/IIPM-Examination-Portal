begin;

-- Evidence-backed examination integrity patch.
-- Risk is derived from persisted events. Visual AI events only contribute when a
-- private snapshot exists. Administrator decisions are recorded immutably.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agilecert-proctor-evidence',
  'agilecert-proctor-evidence',
  false,
  3145728,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.proctor_events
  add column if not exists client_event_id text,
  add column if not exists source text not null default 'exam_submission',
  add column if not exists risk_weight numeric(5,2) not null default 0;

create unique index if not exists proctor_events_session_client_event_uidx
  on public.proctor_events(session_id, client_event_id)
  where client_event_id is not null;

create index if not exists proctor_events_session_occurred_idx
  on public.proctor_events(session_id, occurred_at desc);

create table if not exists public.agilecert_attempt_integrity_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in (
    'insufficient_evidence', 'clear', 'flag_attempt', 'invalidate_attempt'
  )),
  reason text not null,
  evidence_score numeric(5,2) not null check (evidence_score between 0 and 100),
  event_count integer not null default 0 check (event_count >= 0),
  high_event_count integer not null default 0 check (high_event_count >= 0),
  visual_event_count integer not null default 0 check (visual_event_count >= 0),
  snapshot_count integer not null default 0 check (snapshot_count >= 0),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_attempt_integrity_reviews_attempt_idx
  on public.agilecert_attempt_integrity_reviews(attempt_id, created_at desc);

alter table public.agilecert_attempt_integrity_reviews enable row level security;

create or replace function public.agilecert_is_visual_proctor_event(p_event_type text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(p_event_type, '')) in (
    'no_face', 'multiple_people', 'phone_detected', 'looking_away', 'notes_detected'
  )
$$;

create or replace function public.agilecert_proctor_event_weight(
  p_event_type text,
  p_severity text,
  p_snapshot_path text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_event_type, '')) in ('session_heartbeat', 'network_online', 'fullscreen_enter') then 0
    when lower(coalesce(p_event_type, '')) = 'manual_flag'
         and nullif(trim(coalesce(p_snapshot_path, '')), '') is null then 0
    when public.agilecert_is_visual_proctor_event(p_event_type)
         and nullif(trim(coalesce(p_snapshot_path, '')), '') is null then 0
    when lower(coalesce(p_severity, 'low')) = 'high'
      then case when public.agilecert_is_visual_proctor_event(p_event_type) then 25 else 15 end
    when lower(coalesce(p_severity, 'low')) = 'medium'
      then case when public.agilecert_is_visual_proctor_event(p_event_type) then 12 else 7 end
    else case when public.agilecert_is_visual_proctor_event(p_event_type) then 5 else 2 end
  end::numeric
$$;

create or replace function public.agilecert_session_evidence_score(p_session_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select least(100, coalesce(sum(event_type_score), 0))::numeric(5,2)
  from (
    select
      pe.event_type,
      least(30, sum(public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path))) as event_type_score
    from public.proctor_events pe
    where pe.session_id = p_session_id
    group by pe.event_type
  ) weighted_types
$$;

create or replace function public.agilecert_valid_proctor_snapshot_path(
  p_candidate_id uuid,
  p_session_id uuid,
  p_path text
)
returns text
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  if v_path is null then return null; end if;
  if v_path !~ ('^' || p_candidate_id::text || '/' || p_session_id::text || '/[A-Za-z0-9._/-]+$') then
    return null;
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'agilecert-proctor-evidence' and o.name = v_path
  ) then
    return null;
  end if;
  return v_path;
end;
$$;

create or replace function public.agilecert_normalize_proctor_event_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_requested_path text;
begin
  new.message := left(coalesce(nullif(trim(new.message), ''), 'Proctor event recorded.'), 800);
  new.event_type := lower(trim(coalesce(nullif(new.event_type, ''), 'manual_flag')));
  new.severity := case when lower(new.severity) in ('low', 'medium', 'high') then lower(new.severity) else 'low' end;

  v_requested_path := coalesce(new.snapshot_path, new.metadata ->> 'snapshotPath');
  new.snapshot_path := public.agilecert_valid_proctor_snapshot_path(new.candidate_id, new.session_id, v_requested_path);
  new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'snapshotUrl' - 'snapshotPath')
    || jsonb_build_object(
      'evidenceStatus', case
        when public.agilecert_is_visual_proctor_event(new.event_type) and new.snapshot_path is null then 'visual_snapshot_missing'
        when new.snapshot_path is not null then 'snapshot_retained'
        else 'event_recorded'
      end
    );

  if new.client_event_id is not null then
    new.client_event_id := nullif(left(regexp_replace(trim(new.client_event_id), '[^A-Za-z0-9._:-]+', '-', 'g'), 120), '');
  elsif new.metadata ->> 'id' is not null then
    new.client_event_id := nullif(left(regexp_replace(trim(new.metadata ->> 'id'), '[^A-Za-z0-9._:-]+', '-', 'g'), 120), '');
  end if;

  if coalesce(new.source, '') = '' or new.source = 'exam_submission' then
    new.source := case
      when public.agilecert_is_visual_proctor_event(new.event_type) then 'live_ai'
      else 'exam_submission'
    end;
  end if;

  new.risk_weight := public.agilecert_proctor_event_weight(new.event_type, new.severity, new.snapshot_path);
  return new;
end;
$$;

drop trigger if exists agilecert_normalize_proctor_event_evidence_trigger on public.proctor_events;
create trigger agilecert_normalize_proctor_event_evidence_trigger
before insert or update of event_type, severity, message, snapshot_path, metadata, client_event_id, source
on public.proctor_events
for each row execute function public.agilecert_normalize_proctor_event_evidence();

create or replace function public.agilecert_apply_evidence_score_to_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score numeric(5,2);
  v_has_evidence boolean;
begin
  v_score := public.agilecert_session_evidence_score(new.session_id);
  select exists (
    select 1 from public.proctor_events pe
    where pe.session_id = new.session_id
      and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0
  ) into v_has_evidence;

  new.suspicious_score := v_score;
  if new.status in ('submitted', 'flagged') then
    new.status := case when v_has_evidence and v_score >= 60 then 'flagged' else 'submitted' end;
  end if;

  update public.exam_sessions
  set suspicious_score = v_score, updated_at = now()
  where id = new.session_id;

  return new;
end;
$$;

drop trigger if exists agilecert_apply_evidence_score_to_attempt_trigger on public.attempts;
create trigger agilecert_apply_evidence_score_to_attempt_trigger
before insert on public.attempts
for each row execute function public.agilecert_apply_evidence_score_to_attempt();

create or replace function public.agilecert_refresh_attempt_evidence_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_score numeric(5,2);
  v_has_evidence boolean;
begin
  v_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  v_score := public.agilecert_session_evidence_score(v_session_id);
  select exists (
    select 1 from public.proctor_events pe
    where pe.session_id = v_session_id
      and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0
  ) into v_has_evidence;

  update public.exam_sessions
  set suspicious_score = v_score, updated_at = now()
  where id = v_session_id;

  update public.attempts
  set suspicious_score = v_score,
      status = case
        when reviewed_by is not null or status in ('reviewed', 'terminated') then status
        when v_has_evidence and v_score >= 60 then 'flagged'
        else 'submitted'
      end,
      updated_at = now()
  where session_id = v_session_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists agilecert_refresh_attempt_evidence_score_trigger on public.proctor_events;
create trigger agilecert_refresh_attempt_evidence_score_trigger
after insert or update or delete on public.proctor_events
for each row execute function public.agilecert_refresh_attempt_evidence_score();

create or replace function public.get_portal_attempts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(attempt_payload order by submitted_at desc), '[]'::jsonb)
  from (
    select
      a.submitted_at,
      jsonb_build_object(
        'id', a.id,
        'studentName', p.full_name,
        'testId', a.examination_id,
        'testTitle', e.title,
        'startTime', a.started_at,
        'endTime', a.submitted_at,
        'answers', coalesce((
          select jsonb_object_agg(ca.question_id::text, qo.position - 1)
          from public.candidate_answers ca
          left join public.question_options qo on qo.id = ca.selected_option_id
          where ca.session_id = a.session_id and ca.selected_option_id is not null
        ), '{}'::jsonb),
        'score', a.percentage,
        'logs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pe.id,
            'timestamp', pe.occurred_at,
            'type', pe.event_type,
            'severity', pe.severity,
            'message', pe.message,
            'snapshotPath', pe.snapshot_path,
            'source', pe.source,
            'confidence', pe.confidence,
            'riskWeight', public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path)
          ) order by pe.occurred_at)
          from public.proctor_events pe
          where pe.session_id = a.session_id
        ), '[]'::jsonb),
        'status', case when a.status = 'reviewed' then 'submitted' else a.status end,
        'suspiciousScore', a.suspicious_score,
        'evidenceStatus', case
          when not exists(
            select 1 from public.proctor_events pe
            where pe.session_id = a.session_id
              and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0
          ) then 'no_evidence'
          when exists(
            select 1 from public.proctor_events pe
            where pe.session_id = a.session_id and pe.snapshot_path is not null
          ) then 'visual_evidence'
          else 'event_evidence'
        end,
        'reviewNotes', a.review_notes
      ) as attempt_payload
    from public.attempts a
    join public.profiles p on p.id = a.candidate_id
    join public.examinations e on e.id = a.examination_id
    where a.candidate_id = auth.uid() or public.is_exam_staff()
  ) portal_attempts;
$$;

create or replace function public.get_agilecert_attempt_integrity_evidence(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_score numeric(5,2);
  v_event_count integer;
  v_high_count integer;
  v_visual_count integer;
  v_snapshot_count integer;
begin
  if not public.is_exam_staff() then
    raise exception 'Examination staff authority is required.';
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then raise exception 'The examination attempt was not found.'; end if;

  v_score := public.agilecert_session_evidence_score(v_attempt.session_id);
  select
    count(*) filter (where public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0),
    count(*) filter (where pe.severity = 'high' and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0),
    count(*) filter (where public.agilecert_is_visual_proctor_event(pe.event_type)),
    count(*) filter (where pe.snapshot_path is not null)
  into v_event_count, v_high_count, v_visual_count, v_snapshot_count
  from public.proctor_events pe where pe.session_id = v_attempt.session_id;

  return jsonb_build_object(
    'attempt', (
      select jsonb_build_object(
        'id', a.id,
        'sessionId', a.session_id,
        'candidateId', a.candidate_id,
        'candidateName', p.full_name,
        'candidateEmail', p.email,
        'examinationId', a.examination_id,
        'examinationTitle', e.title,
        'academicScore', a.percentage,
        'storedRiskScore', a.suspicious_score,
        'evidenceRiskScore', v_score,
        'status', a.status,
        'startedAt', a.started_at,
        'submittedAt', a.submitted_at,
        'reviewNotes', a.review_notes,
        'reviewedBy', a.reviewed_by
      )
      from public.attempts a
      join public.profiles p on p.id = a.candidate_id
      join public.examinations e on e.id = a.examination_id
      where a.id = p_attempt_id
    ),
    'summary', jsonb_build_object(
      'evidenceRiskScore', v_score,
      'eventCount', coalesce(v_event_count, 0),
      'highEventCount', coalesce(v_high_count, 0),
      'visualEventCount', coalesce(v_visual_count, 0),
      'snapshotCount', coalesce(v_snapshot_count, 0),
      'evidenceStatus', case
        when coalesce(v_event_count, 0) = 0 then 'no_evidence'
        when coalesce(v_visual_count, 0) > coalesce(v_snapshot_count, 0) then 'partial_visual_evidence'
        when coalesce(v_snapshot_count, 0) > 0 then 'visual_evidence'
        else 'event_evidence'
      end,
      'legacyScoreMismatch', v_attempt.suspicious_score is distinct from v_score
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id,
        'eventType', pe.event_type,
        'severity', pe.severity,
        'confidence', pe.confidence,
        'message', pe.message,
        'snapshotPath', pe.snapshot_path,
        'source', pe.source,
        'riskWeight', public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path),
        'metadata', pe.metadata,
        'occurredAt', pe.occurred_at
      ) order by pe.occurred_at)
      from public.proctor_events pe where pe.session_id = v_attempt.session_id
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'reviewerId', r.reviewer_id,
        'reviewerName', p.full_name,
        'decision', r.decision,
        'reason', r.reason,
        'evidenceScore', r.evidence_score,
        'eventCount', r.event_count,
        'snapshotCount', r.snapshot_count,
        'createdAt', r.created_at
      ) order by r.created_at desc)
      from public.agilecert_attempt_integrity_reviews r
      join public.profiles p on p.id = r.reviewer_id
      where r.attempt_id = p_attempt_id
    ), '[]'::jsonb)
  );
end;
$$;

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
      review_notes = left(v_reason, 2000),
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
      'storedScoreBeforeReview', v_attempt.suspicious_score
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

with recalculated as (
  select
    a.id,
    public.agilecert_session_evidence_score(a.session_id) as evidence_score,
    exists (
      select 1 from public.proctor_events pe
      where pe.session_id = a.session_id
        and public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path) > 0
    ) as has_evidence
  from public.attempts a
)
update public.attempts a
set suspicious_score = r.evidence_score,
    status = case
      when a.reviewed_by is not null or a.status in ('reviewed', 'terminated') then a.status
      when r.has_evidence and r.evidence_score >= 60 then 'flagged'
      else 'submitted'
    end,
    review_notes = case
      when a.suspicious_score > 0 and not r.has_evidence then
        left(concat_ws(' ', nullif(a.review_notes, ''), 'Legacy suspicion score removed because no persisted proctoring evidence existed.'), 2000)
      else a.review_notes
    end,
    updated_at = now()
from recalculated r
where r.id = a.id
  and (a.suspicious_score is distinct from r.evidence_score
       or (a.status = 'flagged' and not r.has_evidence));

update public.exam_sessions s
set suspicious_score = public.agilecert_session_evidence_score(s.id),
    updated_at = now()
where s.suspicious_score is distinct from public.agilecert_session_evidence_score(s.id);

drop policy if exists agilecert_proctor_evidence_candidate_insert on storage.objects;
create policy agilecert_proctor_evidence_candidate_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'agilecert-proctor-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists agilecert_proctor_evidence_candidate_read on storage.objects;
create policy agilecert_proctor_evidence_candidate_read
on storage.objects for select to authenticated
using (
  bucket_id = 'agilecert-proctor-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_exam_staff()
  )
);

drop policy if exists agilecert_proctor_evidence_candidate_delete on storage.objects;
create policy agilecert_proctor_evidence_candidate_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'agilecert-proctor-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1 from public.proctor_events pe where pe.snapshot_path = storage.objects.name
  )
);

revoke all on function public.agilecert_session_evidence_score(uuid) from public;
revoke all on function public.agilecert_valid_proctor_snapshot_path(uuid, uuid, text) from public;
revoke all on function public.get_agilecert_attempt_integrity_evidence(uuid) from public;
revoke all on function public.review_agilecert_attempt_integrity(uuid, text, text) from public;
revoke all on function public.get_portal_attempts() from public;

grant execute on function public.get_portal_attempts() to authenticated;
grant execute on function public.get_agilecert_attempt_integrity_evidence(uuid) to authenticated;
grant execute on function public.review_agilecert_attempt_integrity(uuid, text, text) to authenticated;

commit;
