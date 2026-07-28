begin;

-- Follow-up hardening for structured AI confidence and candidate-safe cleanup.

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
  v_confidence_match text[];
  v_metadata_confidence numeric;
begin
  new.message := left(coalesce(nullif(trim(new.message), ''), 'Proctor event recorded.'), 800);
  new.event_type := lower(trim(coalesce(nullif(new.event_type, ''), 'manual_flag')));
  new.severity := case when lower(new.severity) in ('low', 'medium', 'high') then lower(new.severity) else 'low' end;

  -- Prefer structured confidence supplied by the proctor runtime. Older events
  -- carry the percentage in the human-readable AI message, so extract it once.
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
  new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'snapshotUrl' - 'snapshotPath' - 'confidence')
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

drop policy if exists agilecert_proctor_evidence_candidate_delete on storage.objects;
create policy agilecert_proctor_evidence_candidate_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'agilecert-proctor-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.agilecert_proctor_snapshot_is_unlinked(name)
);

revoke all on function public.agilecert_proctor_snapshot_is_unlinked(text) from public, anon;
grant execute on function public.agilecert_proctor_snapshot_is_unlinked(text) to authenticated;

commit;
