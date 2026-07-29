begin;

-- Production Phase 5 hardening for structured AI confidence, live source
-- attribution, immutable reviews and consistent proctor-session risk.

create or replace function public.agilecert_proctor_snapshot_is_unlinked(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.proctor_events pe
    where pe.snapshot_path = p_path
  )
$$;

create or replace function public.agilecert_normalize_proctor_event_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_requested_path text;
  v_requested_source text;
  v_confidence_match text[];
  v_metadata_confidence numeric;
begin
  new.message := left(coalesce(nullif(trim(new.message), ''), 'Proctor event recorded.'), 800);
  new.event_type := lower(trim(coalesce(nullif(new.event_type, ''), 'manual_flag')));
  new.severity := case when lower(new.severity) in ('low', 'medium', 'high') then lower(new.severity) else 'low' end;

  if new.confidence is null and nullif(new.metadata ->> 'confidence', '') is not null then
    begin
      v_metadata_confidence := (new.metadata ->> 'confidence')::numeric;
      new.confidence := least(1, greatest(0, v_metadata_confidence));
    exception when invalid_text_representation or numeric_value_out_of_range then
      new.confidence := null;
    end;
  end if;

  if new.confidence is null then
    v_confidence_match := regexp_match(new.message, 'Confidence:[[:space:]]*([0-9]{1,3})%', 'i');
    if v_confidence_match is not null then
      new.confidence := least(1, greatest(0, v_confidence_match[1]::numeric / 100));
    end if;
  end if;

  v_requested_path := coalesce(new.snapshot_path, new.metadata ->> 'snapshotPath');
  new.snapshot_path := public.agilecert_valid_proctor_snapshot_path(new.candidate_id, new.session_id, v_requested_path);

  v_requested_source := lower(trim(coalesce(new.metadata ->> 'source', '')));
  if v_requested_source in ('live_browser', 'live_ai', 'exam_submission', 'administrator', 'system') then
    new.source := v_requested_source;
  elsif coalesce(new.source, '') = '' or new.source = 'exam_submission' then
    new.source := case
      when public.agilecert_is_visual_proctor_event(new.event_type) then 'live_ai'
      else 'exam_submission'
    end;
  end if;

  new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'snapshotUrl' - 'snapshotPath' - 'confidence' - 'source')
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

  new.risk_weight := public.agilecert_proctor_event_weight(new.event_type, new.severity, new.snapshot_path);
  return new;
end;
$$;

create or replace function public.agilecert_refresh_proctoring_session_risk(
  p_proctoring_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.agilecert_proctoring_sessions%rowtype;
  v_policy public.agilecert_identity_proctoring_policies%rowtype;
  v_score numeric(5,2);
  v_low integer;
  v_medium integer;
  v_high integer;
  v_count integer;
  v_last timestamptz;
  v_level text;
begin
  select * into v_session
  from public.agilecert_proctoring_sessions
  where id = p_proctoring_session_id
  for update;
  if not found then return; end if;

  select * into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id = v_session.examination_id;

  v_score := public.agilecert_session_evidence_score(v_session.session_id);

  select
    count(*) filter (where pe.severity = 'low')::integer,
    count(*) filter (where pe.severity = 'medium')::integer,
    count(*) filter (where pe.severity = 'high')::integer,
    count(*)::integer,
    max(pe.occurred_at)
  into v_low, v_medium, v_high, v_count, v_last
  from public.proctor_events pe
  where pe.proctoring_session_id = p_proctoring_session_id;

  v_level := case
    when v_score >= coalesce(v_policy.critical_threshold, 80) then 'critical'
    when v_score >= coalesce(v_policy.incident_threshold, 60) then 'high'
    when v_score >= 25 then 'medium'
    else 'low'
  end;

  update public.agilecert_proctoring_sessions
  set risk_score = v_score,
      risk_level = v_level,
      low_event_count = coalesce(v_low, 0),
      medium_event_count = coalesce(v_medium, 0),
      high_event_count = coalesce(v_high, 0),
      event_count = coalesce(v_count, 0),
      last_event_at = v_last,
      updated_at = now()
  where id = p_proctoring_session_id;
end;
$$;

create or replace function public.agilecert_reject_integrity_review_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Examination integrity review records are immutable.';
end;
$$;

drop trigger if exists agilecert_attempt_integrity_reviews_immutable_trigger
on public.agilecert_attempt_integrity_reviews;
create trigger agilecert_attempt_integrity_reviews_immutable_trigger
before update or delete on public.agilecert_attempt_integrity_reviews
for each row execute function public.agilecert_reject_integrity_review_mutation();

do $$
declare
  v_session record;
begin
  for v_session in select id from public.agilecert_proctoring_sessions loop
    perform public.agilecert_refresh_proctoring_session_risk(v_session.id);
  end loop;
end;
$$;

drop policy if exists agilecert_proctor_evidence_candidate_delete on storage.objects;
create policy agilecert_proctor_evidence_candidate_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'agilecert-proctor-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.agilecert_proctor_snapshot_is_unlinked(name)
);

revoke all on function public.agilecert_proctor_snapshot_is_unlinked(text) from public, anon;
revoke all on function public.agilecert_reject_integrity_review_mutation() from public, anon;
grant execute on function public.agilecert_proctor_snapshot_is_unlinked(text) to authenticated;

commit;
