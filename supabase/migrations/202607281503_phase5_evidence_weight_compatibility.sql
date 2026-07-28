begin;

-- Preserve the established Phase 5 browser-event weights while retaining the
-- evidence safeguards introduced by this release. Repeated events of one type
-- remain capped by agilecert_session_evidence_score; visual AI events still
-- require a retained snapshot before contributing any risk.

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
      then case when public.agilecert_is_visual_proctor_event(p_event_type) then 25 else 20 end
    when lower(coalesce(p_severity, 'low')) = 'medium'
      then case when public.agilecert_is_visual_proctor_event(p_event_type) then 12 else 8 end
    else case when public.agilecert_is_visual_proctor_event(p_event_type) then 5 else 2 end
  end::numeric
$$;

update public.proctor_events pe
set risk_weight = public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path)
where pe.risk_weight is distinct from public.agilecert_proctor_event_weight(pe.event_type, pe.severity, pe.snapshot_path);

do $$
declare
  v_session record;
begin
  for v_session in select id from public.agilecert_proctoring_sessions loop
    perform public.agilecert_refresh_proctoring_session_risk(v_session.id);
  end loop;
end;
$$;

commit;
