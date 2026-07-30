begin;

-- CIPMN Google Drive video MVP.
-- The candidate catalogue remains payment-gated. Normal catalogue responses never
-- expose Google Drive file IDs; an authorised candidate receives the preview URL
-- only after a fresh server-side entitlement check and an auditable playback request.

create table if not exists public.agilecert_material_playback_audits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  entitlement_id uuid references public.agilecert_material_entitlements(id) on delete set null,
  provider text,
  status text not null check (status in ('authorized', 'denied')),
  failure_code text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists agilecert_material_playback_audits_candidate_idx
  on public.agilecert_material_playback_audits(candidate_id, requested_at desc);
create index if not exists agilecert_material_playback_audits_material_idx
  on public.agilecert_material_playback_audits(material_id, requested_at desc);
create index if not exists agilecert_material_playback_audits_status_idx
  on public.agilecert_material_playback_audits(status, requested_at desc);

alter table public.agilecert_material_playback_audits enable row level security;

revoke all on public.agilecert_material_playback_audits from public, anon, authenticated;
grant select on public.agilecert_material_playback_audits to authenticated;

drop policy if exists agilecert_material_playback_audits_select
  on public.agilecert_material_playback_audits;
create policy agilecert_material_playback_audits_select
  on public.agilecert_material_playback_audits
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_material_admin()
  );

-- Record the twelve approved Google Drive videos in the existing administrator-only
-- source manifest. These files remain external streaming sources and are therefore
-- not imported into the private Supabase material bucket.
with approved_videos(module_code, drive_id, source_name, source_size_bytes) as (
  values
    ('CIPMN-MOD-001', '10_V8XlrI4vMtOKvu8Cizsumv_lDYpWl2', 'CIPMN MOD 1 - Principles of Project Management.mp4', 271451871::bigint),
    ('CIPMN-MOD-002', '1gFFOPq18GXkuqRxPd2DydDChDptq-t72', 'CIPMN MOD 2 - Project Management Methodologies.mp4', 146619884::bigint),
    ('CIPMN-MOD-003', '1yriTGTDfW7kqpkVlt6GwCfqFqsz97Htw', 'CIPMN MOD 3 - Project Delivery Conceptual Tools.mp4', 41442696::bigint),
    ('CIPMN-MOD-004', '1-LDGOkWlejcH7Z71ihHT-e-UDxHsgADF', 'CIPMN MOD 4 - Requirements Engineering.mp4', 84692689::bigint),
    ('CIPMN-MOD-005', '1Xgb509wfKZG0ZGLuQeg53Eyu3qWOWMWJ', 'CIPMN MOD 5 - Project Risk and Issues Management.mp4', 51043201::bigint),
    ('CIPMN-MOD-006', '17_MmHbNonTpyzyGetkGWOdpT8eNfc-Bj', 'CIPMN MOD 6 - Project Planning and Scheduling.mp4', 67974930::bigint),
    ('CIPMN-MOD-007', '10IO1aklIof50F7mLnY-yIPB5t5nTeBpn', 'CIPMN MOD 7 - Scope and Change Management.mp4', 54123036::bigint),
    ('CIPMN-MOD-008', '1ETD5E_9VZGKQRLv0p_-hN18X-nC_TfE4', 'CIPMN MOD 8 - Project Quality Management.mp4', 75335368::bigint),
    ('CIPMN-MOD-009', '1EfwGTkLsFTgGwfQ7r4n48RfGUH3DXrPv', 'CIPMN MOD 9 - Agile Delivery.mp4', 52198427::bigint),
    ('CIPMN-MOD-010', '1iulZPymLPhJF4o8vnpdCXI1zZTg0wH68', 'CIPMN MOD 10 - Project Leadership and High-Performing Teams.mp4', 61467733::bigint),
    ('CIPMN-MOD-011', '1iuAs1RE4ze0N4PjhcwE4XLSHF2PAtGkc', 'CIPMN MOD 11 - DUCAP Methodology.mp4', 138973938::bigint),
    ('CIPMN-MOD-012', '1q2oXggWFQwGeTdsFWJvVUR3Rqz7iyfcQ', 'CIPMN MOD 12 - Project Procurement and Contract Management.mp4', 96221763::bigint)
)
update public.agilecert_material_source_manifests manifest
set delivery_mode = 'embedded_video',
    source_provider = 'google_drive',
    source_reference = approved.drive_id,
    source_file_name = approved.source_name,
    source_size_bytes = approved.source_size_bytes,
    target_storage_bucket = null,
    target_storage_path = null,
    import_status = 'not_required',
    last_error = null,
    metadata = coalesce(manifest.metadata, '{}'::jsonb) || jsonb_build_object(
      'moduleCode', approved.module_code,
      'sharing', 'anyone_with_link_reader',
      'allowFileDiscovery', false,
      'validatedAt', now(),
      'candidateAccess', 'verified examination payment, waiver or administrator assignment'
    ),
    updated_at = now()
from approved_videos approved
join public.agilecert_preparation_materials material
  on material.title like approved.module_code || ' Video Lesson - %'
where manifest.material_id = material.id;

-- A material is candidate-deliverable when it either has a published private-file
-- version or is a validated embedded-video source. Source references remain private.
create or replace function public.agilecert_material_has_candidate_delivery(
  p_material_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agilecert_preparation_material_versions version
    where version.material_id = p_material_id
      and version.status = 'published'
  ) or exists (
    select 1
    from public.agilecert_material_source_manifests manifest
    join public.agilecert_preparation_materials material
      on material.id = manifest.material_id
    where manifest.material_id = p_material_id
      and material.material_type = 'video'
      and manifest.delivery_mode = 'embedded_video'
      and manifest.source_provider = 'google_drive'
      and manifest.import_status = 'not_required'
      and manifest.source_reference ~ '^[A-Za-z0-9_-]{10,200}$'
  );
$$;

revoke all on function public.agilecert_material_has_candidate_delivery(uuid)
  from public, anon, authenticated;
grant execute on function public.agilecert_material_has_candidate_delivery(uuid)
  to service_role;

create or replace function public.refresh_agilecert_material_entitlements(
  p_candidate_id uuid,
  p_examination_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.exam_assignments%rowtype;
  v_order public.exam_orders%rowtype;
  v_source_type text;
  v_source_order_id uuid;
  v_now timestamptz := now();
begin
  select * into v_assignment
  from public.exam_assignments
  where candidate_id = p_candidate_id
    and examination_id = p_examination_id
  order by updated_at desc, created_at desc
  limit 1;

  if not found then
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status = 'active';
    return;
  end if;

  select eo.* into v_order
  from public.exam_orders eo
  where eo.candidate_id = p_candidate_id
    and eo.examination_id = p_examination_id
    and eo.fulfilled_at is not null
    and (
      eo.status = 'waived'
      or (
        eo.status = 'paid'
        and exists (
          select 1
          from public.exam_payments ep
          where ep.order_id = eo.id
            and ep.status = 'success'
            and ep.amount_minor = eo.payable_amount_minor
            and upper(ep.currency) = upper(eo.currency)
        )
      )
    )
  order by eo.fulfilled_at desc, eo.created_at desc
  limit 1;

  if found then
    v_source_type := case when v_order.status = 'waived' then 'waived_order' else 'paid_order' end;
    v_source_order_id := v_order.id;
  elsif v_assignment.assigned_by is not null then
    v_source_type := 'admin_assignment';
    v_source_order_id := null;
  else
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status = 'active';
    return;
  end if;

  if v_assignment.status = 'revoked' then
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status <> 'revoked';
    return;
  end if;

  if v_assignment.status = 'expired'
     or (v_assignment.expires_at is not null and v_assignment.expires_at <= v_now) then
    update public.agilecert_material_entitlements
    set status = 'expired', updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status <> 'expired';
    return;
  end if;

  insert into public.agilecert_material_entitlements (
    candidate_id,
    examination_id,
    material_id,
    source_type,
    source_order_id,
    source_assignment_id,
    status,
    available_from,
    expires_at,
    granted_at,
    revoked_at,
    metadata
  )
  select
    p_candidate_id,
    p_examination_id,
    em.material_id,
    v_source_type,
    v_source_order_id,
    v_assignment.id,
    case
      when access_window.expires_at is not null and access_window.expires_at <= v_now then 'expired'
      else 'active'
    end,
    access_window.available_from,
    access_window.expires_at,
    v_now,
    null,
    jsonb_build_object('verified_at', v_now)
  from public.agilecert_exam_materials em
  join public.agilecert_preparation_materials material
    on material.id = em.material_id
   and material.status = 'published'
  cross join lateral (
    select
      greatest(
        coalesce(v_assignment.available_from, v_assignment.created_at, v_now),
        coalesce(em.available_from, em.created_at, v_now),
        case
          when v_source_order_id is not null then coalesce(v_order.fulfilled_at, v_order.created_at, v_now)
          else coalesce(v_assignment.created_at, v_now)
        end
      ) as available_from,
      case
        when v_assignment.expires_at is null then em.expires_at
        when em.expires_at is null then v_assignment.expires_at
        else least(v_assignment.expires_at, em.expires_at)
      end as expires_at
  ) access_window
  where em.examination_id = p_examination_id
    and em.is_active = true
    and public.agilecert_material_has_candidate_delivery(em.material_id)
    and (access_window.expires_at is null or access_window.expires_at > access_window.available_from)
  on conflict (candidate_id, examination_id, material_id) do update
  set source_type = excluded.source_type,
      source_order_id = excluded.source_order_id,
      source_assignment_id = excluded.source_assignment_id,
      status = excluded.status,
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
      revoked_at = null,
      metadata = excluded.metadata,
      updated_at = v_now;

  update public.agilecert_material_entitlements entitlement
  set status = 'revoked',
      revoked_at = coalesce(entitlement.revoked_at, v_now),
      updated_at = v_now
  where entitlement.candidate_id = p_candidate_id
    and entitlement.examination_id = p_examination_id
    and entitlement.status = 'active'
    and not exists (
      select 1
      from public.agilecert_exam_materials em
      join public.agilecert_preparation_materials material
        on material.id = em.material_id
       and material.status = 'published'
      where em.examination_id = p_examination_id
        and em.material_id = entitlement.material_id
        and em.is_active = true
        and public.agilecert_material_has_candidate_delivery(em.material_id)
    );
end;
$$;

create or replace function public.get_my_agilecert_preparation_materials()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment record;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_user_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'Only an active candidate account may view preparation materials.';
  end if;

  for v_assignment in
    select examination_id
    from public.exam_assignments
    where candidate_id = v_user_id
  loop
    perform public.refresh_agilecert_material_entitlements(v_user_id, v_assignment.examination_id);
  end loop;

  select coalesce(jsonb_agg(material_payload order by examination_title, position, title), '[]'::jsonb)
  into v_result
  from (
    select
      examination.title as examination_title,
      mapping.position,
      material.title,
      jsonb_build_object(
        'materialId', material.id,
        'examinationId', examination.id,
        'examinationTitle', examination.title,
        'programmeCode', programme.code,
        'title', material.title,
        'description', coalesce(material.description, ''),
        'materialType', material.material_type,
        'deliveryMode', case
          when manifest.delivery_mode = 'embedded_video' then 'embedded_video'
          else 'secure_download'
        end,
        'streamingProvider', case
          when manifest.delivery_mode = 'embedded_video' then manifest.source_provider
          else null
        end,
        'versionNumber', coalesce(version.version_number, 1),
        'versionLabel', coalesce(version.version_label, case
          when manifest.delivery_mode = 'embedded_video' then 'Streaming video'
          else 'Version 1'
        end),
        'fileName', coalesce(version.file_name, ''),
        'mimeType', coalesce(version.mime_type, case
          when manifest.delivery_mode = 'embedded_video' then 'video/mp4'
          else 'application/octet-stream'
        end),
        'sizeBytes', coalesce(version.size_bytes, manifest.source_size_bytes, 0),
        'isRequired', mapping.is_required,
        'position', mapping.position,
        'accessStatus', case
          when entitlement.status = 'active'
            and entitlement.available_from <= now()
            and (entitlement.expires_at is null or entitlement.expires_at > now()) then 'available'
          when entitlement.status = 'active' and entitlement.available_from > now() then 'scheduled'
          when entitlement.status = 'expired'
            or (entitlement.expires_at is not null and entitlement.expires_at <= now()) then 'expired'
          when entitlement.status = 'revoked' then 'revoked'
          else 'locked'
        end,
        'availableFrom', entitlement.available_from,
        'expiresAt', entitlement.expires_at,
        'unlockReason', case
          when entitlement.id is null then 'Complete verified payment or receive an administrator assignment to unlock this material.'
          when entitlement.status = 'revoked' then 'This material entitlement has been revoked.'
          when entitlement.status = 'expired'
            or (entitlement.expires_at is not null and entitlement.expires_at <= now()) then 'This material entitlement has expired.'
          when entitlement.available_from > now() then 'This material will become available at the scheduled time.'
          else null
        end
      ) as material_payload
    from public.agilecert_exam_materials mapping
    join public.examinations examination
      on examination.id = mapping.examination_id
     and examination.status = 'published'
    join public.programmes programme
      on programme.id = examination.programme_id
    join public.agilecert_preparation_materials material
      on material.id = mapping.material_id
     and material.status = 'published'
    left join lateral (
      select
        candidate_version.version_number,
        candidate_version.version_label,
        candidate_version.file_name,
        candidate_version.mime_type,
        candidate_version.size_bytes
      from public.agilecert_preparation_material_versions candidate_version
      where candidate_version.material_id = material.id
        and candidate_version.status = 'published'
      order by candidate_version.version_number desc
      limit 1
    ) version on true
    left join public.agilecert_material_source_manifests manifest
      on manifest.material_id = material.id
     and manifest.delivery_mode = 'embedded_video'
     and manifest.source_provider = 'google_drive'
     and manifest.import_status = 'not_required'
    left join public.agilecert_material_entitlements entitlement
      on entitlement.candidate_id = v_user_id
     and entitlement.examination_id = mapping.examination_id
     and entitlement.material_id = mapping.material_id
    where mapping.is_active = true
      and (
        version.version_number is not null
        or (
          manifest.id is not null
          and manifest.source_reference ~ '^[A-Za-z0-9_-]{10,200}$'
        )
      )
  ) catalogue;

  return v_result;
end;
$$;

create or replace function public.authorize_my_agilecert_video_playback(
  p_examination_id uuid,
  p_material_id uuid,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_request_id uuid := gen_random_uuid();
  v_audit_id uuid;
  v_now timestamptz := now();
  v_mapping record;
  v_manifest record;
  v_entitlement public.agilecert_material_entitlements%rowtype;
  v_reason text;
  v_message text;
begin
  if v_candidate_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    return jsonb_build_object(
      'authorized', false,
      'reason', 'invalid_candidate',
      'message', 'An active candidate account is required.'
    );
  end if;

  perform public.refresh_agilecert_material_entitlements(v_candidate_id, p_examination_id);

  select
    mapping.is_active,
    mapping.available_from as mapping_available_from,
    mapping.expires_at as mapping_expires_at,
    examination.title as examination_title,
    examination.status as examination_status,
    material.title as material_title,
    material.material_type,
    material.status as material_status
  into v_mapping
  from public.agilecert_exam_materials mapping
  join public.examinations examination on examination.id = mapping.examination_id
  join public.agilecert_preparation_materials material on material.id = mapping.material_id
  where mapping.examination_id = p_examination_id
    and mapping.material_id = p_material_id;

  if not found or not coalesce(v_mapping.is_active, false) then
    v_reason := 'mapping_inactive';
    v_message := 'This video is not currently mapped to the examination.';
  elsif v_mapping.examination_status <> 'published' then
    v_reason := 'examination_unpublished';
    v_message := 'The examination is not currently published.';
  elsif v_mapping.material_type <> 'video' or v_mapping.material_status <> 'published' then
    v_reason := 'video_unpublished';
    v_message := 'This video lesson is not currently published.';
  elsif v_mapping.mapping_available_from is not null and v_mapping.mapping_available_from > v_now then
    v_reason := 'scheduled';
    v_message := 'This video lesson is scheduled for later availability.';
  elsif v_mapping.mapping_expires_at is not null and v_mapping.mapping_expires_at <= v_now then
    v_reason := 'expired';
    v_message := 'This video lesson availability window has expired.';
  end if;

  select
    manifest.source_provider,
    manifest.source_reference,
    manifest.source_file_name,
    manifest.source_size_bytes
  into v_manifest
  from public.agilecert_material_source_manifests manifest
  where manifest.material_id = p_material_id
    and manifest.delivery_mode = 'embedded_video'
    and manifest.source_provider = 'google_drive'
    and manifest.import_status = 'not_required'
    and manifest.source_reference ~ '^[A-Za-z0-9_-]{10,200}$'
  limit 1;

  if v_reason is null and not found then
    v_reason := 'video_source_unavailable';
    v_message := 'The approved video source is not currently available.';
  end if;

  select * into v_entitlement
  from public.agilecert_material_entitlements entitlement
  where entitlement.candidate_id = v_candidate_id
    and entitlement.examination_id = p_examination_id
    and entitlement.material_id = p_material_id
  order by entitlement.updated_at desc
  limit 1;

  if v_reason is null and not found then
    v_reason := 'entitlement_missing';
    v_message := 'Verified payment or an administrator assignment is required.';
  elsif v_reason is null and v_entitlement.status = 'revoked' then
    v_reason := 'revoked';
    v_message := 'This video entitlement has been revoked.';
  elsif v_reason is null and (
    v_entitlement.status = 'expired'
    or (v_entitlement.expires_at is not null and v_entitlement.expires_at <= v_now)
  ) then
    v_reason := 'expired';
    v_message := 'This video entitlement has expired.';
  elsif v_reason is null and v_entitlement.available_from > v_now then
    v_reason := 'scheduled';
    v_message := 'This video lesson will become available at the scheduled time.';
  elsif v_reason is null and v_entitlement.status <> 'active' then
    v_reason := 'locked';
    v_message := 'This video lesson is currently locked.';
  end if;

  if v_reason is not null then
    insert into public.agilecert_material_playback_audits (
      request_id,
      candidate_id,
      examination_id,
      material_id,
      entitlement_id,
      provider,
      status,
      failure_code,
      user_agent,
      metadata
    ) values (
      v_request_id,
      v_candidate_id,
      p_examination_id,
      p_material_id,
      v_entitlement.id,
      coalesce(v_manifest.source_provider, 'google_drive'),
      'denied',
      v_reason,
      left(p_user_agent, 500),
      jsonb_build_object('deliveryMode', 'embedded_video')
    ) returning id into v_audit_id;

    return jsonb_build_object(
      'authorized', false,
      'auditId', v_audit_id,
      'reason', v_reason,
      'message', v_message
    );
  end if;

  insert into public.agilecert_material_playback_audits (
    request_id,
    candidate_id,
    examination_id,
    material_id,
    entitlement_id,
    provider,
    status,
    user_agent,
    metadata
  ) values (
    v_request_id,
    v_candidate_id,
    p_examination_id,
    p_material_id,
    v_entitlement.id,
    v_manifest.source_provider,
    'authorized',
    left(p_user_agent, 500),
    jsonb_build_object(
      'deliveryMode', 'embedded_video',
      'sourceFileName', v_manifest.source_file_name,
      'sourceSizeBytes', v_manifest.source_size_bytes
    )
  ) returning id into v_audit_id;

  return jsonb_build_object(
    'authorized', true,
    'auditId', v_audit_id,
    'provider', v_manifest.source_provider,
    'title', v_mapping.material_title,
    'embedUrl', 'https://drive.google.com/file/d/' || v_manifest.source_reference || '/preview'
  );
end;
$$;

revoke all on function public.authorize_my_agilecert_video_playback(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.authorize_my_agilecert_video_playback(uuid, uuid, text)
  to authenticated;

-- Publish only the twelve validated video placeholders.
update public.agilecert_preparation_materials material
set status = 'published',
    updated_at = now()
where material.material_type = 'video'
  and material.title like 'CIPMN-MOD-% Video Lesson - %'
  and exists (
    select 1
    from public.agilecert_material_source_manifests manifest
    where manifest.material_id = material.id
      and manifest.delivery_mode = 'embedded_video'
      and manifest.source_provider = 'google_drive'
      and manifest.import_status = 'not_required'
      and manifest.source_reference ~ '^[A-Za-z0-9_-]{10,200}$'
  );

-- Reconcile previously paid, waived and administrator-assigned candidates.
do $reconcile$
declare
  v_assignment record;
begin
  for v_assignment in
    select distinct assignment.candidate_id, assignment.examination_id
    from public.exam_assignments assignment
    join public.examinations examination on examination.id = assignment.examination_id
    join public.programmes programme on programme.id = examination.programme_id
    where programme.code = 'CIPMN-MOCK'
  loop
    perform public.refresh_agilecert_material_entitlements(
      v_assignment.candidate_id,
      v_assignment.examination_id
    );
  end loop;
end;
$reconcile$;

-- Fail closed unless the complete twelve-video catalogue is present.
do $verify$
declare
  v_manifest_count integer;
  v_published_count integer;
  v_mapping_count integer;
begin
  select count(*) into v_manifest_count
  from public.agilecert_material_source_manifests manifest
  join public.agilecert_preparation_materials material on material.id = manifest.material_id
  where material.title like 'CIPMN-MOD-% Video Lesson - %'
    and manifest.delivery_mode = 'embedded_video'
    and manifest.source_provider = 'google_drive'
    and manifest.import_status = 'not_required'
    and manifest.source_reference ~ '^[A-Za-z0-9_-]{10,200}$';

  select count(*) into v_published_count
  from public.agilecert_preparation_materials material
  where material.material_type = 'video'
    and material.status = 'published'
    and material.title like 'CIPMN-MOD-% Video Lesson - %';

  select count(*) into v_mapping_count
  from public.agilecert_exam_materials mapping
  join public.agilecert_preparation_materials material on material.id = mapping.material_id
  join public.examinations examination on examination.id = mapping.examination_id
  join public.programmes programme on programme.id = examination.programme_id
  where programme.code = 'CIPMN-MOCK'
    and material.material_type = 'video'
    and material.title like 'CIPMN-MOD-% Video Lesson - %'
    and mapping.position = 2
    and mapping.is_active = true;

  if v_manifest_count <> 12 then
    raise exception 'Expected 12 validated Google Drive video manifests, found %.', v_manifest_count;
  end if;
  if v_published_count <> 12 then
    raise exception 'Expected 12 published CIPMN video materials, found %.', v_published_count;
  end if;
  if v_mapping_count <> 12 then
    raise exception 'Expected 12 active CIPMN video mappings, found %.', v_mapping_count;
  end if;
end;
$verify$;

commit;
