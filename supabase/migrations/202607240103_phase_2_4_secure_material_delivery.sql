begin;

-- Phase 2.4: secure preparation-material storage, server-authorised delivery
-- and auditable candidate downloads. Candidate clients never receive bucket or
-- object-path metadata and have no direct storage policy.

create or replace function public.agilecert_is_material_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('exam_admin', 'super_admin')
      and p.is_active = true
  );
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agilecert-preparation-materials',
  'agilecert-preparation-materials',
  false,
  262144000,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'video/mp4'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agilecert_material_storage_admin_select on storage.objects;
create policy agilecert_material_storage_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'agilecert-preparation-materials'
    and public.agilecert_is_material_admin()
  );

drop policy if exists agilecert_material_storage_admin_insert on storage.objects;
create policy agilecert_material_storage_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'agilecert-preparation-materials'
    and public.agilecert_is_material_admin()
  );

drop policy if exists agilecert_material_storage_admin_update on storage.objects;
create policy agilecert_material_storage_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'agilecert-preparation-materials'
    and public.agilecert_is_material_admin()
  )
  with check (
    bucket_id = 'agilecert-preparation-materials'
    and public.agilecert_is_material_admin()
  );

drop policy if exists agilecert_material_storage_admin_delete on storage.objects;
create policy agilecert_material_storage_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'agilecert-preparation-materials'
    and public.agilecert_is_material_admin()
  );

create table if not exists public.agilecert_material_download_audits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  version_id uuid references public.agilecert_preparation_material_versions(id) on delete set null,
  entitlement_id uuid references public.agilecert_material_entitlements(id) on delete set null,
  status text not null default 'requested'
    check (status in ('requested', 'delivered', 'denied', 'failed')),
  failure_code text,
  user_agent text,
  signed_url_expires_at timestamptz,
  bytes_delivered bigint check (bytes_delivered is null or bytes_delivered >= 0),
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (request_id)
);

create index if not exists agilecert_material_download_audits_candidate_idx
  on public.agilecert_material_download_audits(candidate_id, requested_at desc);
create index if not exists agilecert_material_download_audits_material_idx
  on public.agilecert_material_download_audits(material_id, requested_at desc);
create index if not exists agilecert_material_download_audits_status_idx
  on public.agilecert_material_download_audits(status, requested_at desc);

alter table public.agilecert_material_download_audits enable row level security;

drop policy if exists agilecert_material_download_audits_select on public.agilecert_material_download_audits;
create policy agilecert_material_download_audits_select
  on public.agilecert_material_download_audits
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_material_admin()
  );

revoke all on public.agilecert_material_download_audits from public, anon, authenticated;
grant select on public.agilecert_material_download_audits to authenticated;

create or replace function public.authorize_agilecert_material_download(
  p_candidate_id uuid,
  p_examination_id uuid,
  p_material_id uuid,
  p_request_id uuid default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_now timestamptz := now();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_audit_id uuid;
  v_entitlement public.agilecert_material_entitlements%rowtype;
  v_version public.agilecert_preparation_material_versions%rowtype;
  v_mapping record;
  v_reason text;
  v_message text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_candidate_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    return jsonb_build_object(
      'authorized', false,
      'reason', 'invalid_candidate',
      'message', 'An active candidate account is required.'
    );
  end if;

  if not exists (select 1 from public.examinations e where e.id = p_examination_id)
     or not exists (select 1 from public.agilecert_preparation_materials m where m.id = p_material_id) then
    return jsonb_build_object(
      'authorized', false,
      'reason', 'resource_not_found',
      'message', 'The requested preparation material was not found.'
    );
  end if;

  perform public.refresh_agilecert_material_entitlements(p_candidate_id, p_examination_id);

  select
    em.examination_id,
    em.material_id,
    em.is_active,
    em.available_from as mapping_available_from,
    em.expires_at as mapping_expires_at,
    e.title as examination_title,
    e.status as examination_status,
    p.code as programme_code,
    m.title as material_title,
    m.status as material_status
  into v_mapping
  from public.agilecert_exam_materials em
  join public.examinations e on e.id = em.examination_id
  join public.programmes p on p.id = e.programme_id
  join public.agilecert_preparation_materials m on m.id = em.material_id
  where em.examination_id = p_examination_id
    and em.material_id = p_material_id;

  if not found or not coalesce(v_mapping.is_active, false) then
    v_reason := 'mapping_inactive';
    v_message := 'This material is not currently available for the examination.';
  elsif v_mapping.examination_status <> 'published' then
    v_reason := 'examination_unpublished';
    v_message := 'The examination is not currently published.';
  elsif v_mapping.material_status <> 'published' then
    v_reason := 'material_unpublished';
    v_message := 'This preparation material is not currently published.';
  elsif v_mapping.mapping_available_from is not null and v_mapping.mapping_available_from > v_now then
    v_reason := 'scheduled';
    v_message := 'This material is scheduled for later availability.';
  elsif v_mapping.mapping_expires_at is not null and v_mapping.mapping_expires_at <= v_now then
    v_reason := 'expired';
    v_message := 'This material availability window has expired.';
  end if;

  select * into v_version
  from public.agilecert_preparation_material_versions mv
  where mv.material_id = p_material_id
    and mv.status = 'published'
  order by mv.version_number desc
  limit 1;

  if v_reason is null and not found then
    v_reason := 'version_unavailable';
    v_message := 'No published file version is available.';
  end if;

  select * into v_entitlement
  from public.agilecert_material_entitlements ent
  where ent.candidate_id = p_candidate_id
    and ent.examination_id = p_examination_id
    and ent.material_id = p_material_id
  order by ent.updated_at desc
  limit 1;

  if v_reason is null and not found then
    v_reason := 'entitlement_missing';
    v_message := 'Verified payment or an administrator assignment is required.';
  elsif v_reason is null and v_entitlement.status = 'revoked' then
    v_reason := 'revoked';
    v_message := 'This material entitlement has been revoked.';
  elsif v_reason is null and (
    v_entitlement.status = 'expired'
    or (v_entitlement.expires_at is not null and v_entitlement.expires_at <= v_now)
  ) then
    v_reason := 'expired';
    v_message := 'This material entitlement has expired.';
  elsif v_reason is null and v_entitlement.available_from > v_now then
    v_reason := 'scheduled';
    v_message := 'This material will become available at the scheduled time.';
  elsif v_reason is null and v_entitlement.status <> 'active' then
    v_reason := 'locked';
    v_message := 'This material is currently locked.';
  end if;

  if v_reason is not null then
    insert into public.agilecert_material_download_audits (
      request_id,
      candidate_id,
      examination_id,
      material_id,
      version_id,
      entitlement_id,
      status,
      failure_code,
      user_agent,
      metadata,
      completed_at
    ) values (
      v_request_id,
      p_candidate_id,
      p_examination_id,
      p_material_id,
      v_version.id,
      v_entitlement.id,
      'denied',
      v_reason,
      left(p_user_agent, 500),
      jsonb_build_object('phase', '2.4', 'watermarkEligible', true),
      v_now
    )
    returning id into v_audit_id;

    return jsonb_build_object(
      'authorized', false,
      'auditId', v_audit_id,
      'reason', v_reason,
      'message', v_message
    );
  end if;

  insert into public.agilecert_material_download_audits (
    request_id,
    candidate_id,
    examination_id,
    material_id,
    version_id,
    entitlement_id,
    status,
    user_agent,
    signed_url_expires_at,
    metadata
  ) values (
    v_request_id,
    p_candidate_id,
    p_examination_id,
    p_material_id,
    v_version.id,
    v_entitlement.id,
    'requested',
    left(p_user_agent, 500),
    v_now + interval '60 seconds',
    jsonb_build_object(
      'phase', '2.4',
      'watermarkEligible', true,
      'copyrightNotice', 'Licensed to the authorised AgileCert candidate for personal examination preparation only.'
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'authorized', true,
    'auditId', v_audit_id,
    'requestId', v_request_id,
    'examinationTitle', v_mapping.examination_title,
    'programmeCode', v_mapping.programme_code,
    'materialTitle', v_mapping.material_title,
    'versionId', v_version.id,
    'versionLabel', coalesce(v_version.version_label, 'Version ' || v_version.version_number::text),
    'storageBucket', v_version.storage_bucket,
    'storagePath', v_version.storage_path,
    'fileName', v_version.file_name,
    'mimeType', v_version.mime_type,
    'sizeBytes', v_version.size_bytes,
    'signedUrlTtlSeconds', 60,
    'signedUrlExpiresAt', v_now + interval '60 seconds',
    'copyrightNotice', 'Licensed to the authorised AgileCert candidate for personal examination preparation only.'
  );
end;
$$;

create or replace function public.get_agilecert_material_download_audits(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  perform public.agilecert_require_material_admin();

  return coalesce((
    select jsonb_agg(payload order by requested_at desc)
    from (
      select
        a.requested_at,
        jsonb_build_object(
          'id', a.id,
          'requestId', a.request_id,
          'candidateId', a.candidate_id,
          'examinationId', a.examination_id,
          'examinationTitle', e.title,
          'programmeCode', p.code,
          'materialId', a.material_id,
          'materialTitle', m.title,
          'versionId', a.version_id,
          'versionLabel', coalesce(mv.version_label, case when mv.version_number is null then null else 'Version ' || mv.version_number::text end),
          'status', a.status,
          'failureCode', a.failure_code,
          'bytesDelivered', a.bytes_delivered,
          'requestedAt', a.requested_at,
          'completedAt', a.completed_at
        ) as payload
      from public.agilecert_material_download_audits a
      join public.examinations e on e.id = a.examination_id
      join public.programmes p on p.id = e.programme_id
      join public.agilecert_preparation_materials m on m.id = a.material_id
      left join public.agilecert_preparation_material_versions mv on mv.id = a.version_id
      order by a.requested_at desc
      limit v_limit
    ) recent
  ), '[]'::jsonb);
end;
$$;

-- Publishing now requires an actual object in the dedicated private bucket.
create or replace function public.set_agilecert_material_version_status(
  p_version_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_admin_id uuid := public.agilecert_require_material_admin();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_version public.agilecert_preparation_material_versions%rowtype;
  v_material_status text;
begin
  if v_status not in ('draft', 'published', 'retired') then
    raise exception 'Unsupported material-version status.';
  end if;

  select * into v_version
  from public.agilecert_preparation_material_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'The material version was not found.';
  end if;

  select status into v_material_status
  from public.agilecert_preparation_materials
  where id = v_version.material_id;

  if v_status = 'published' and v_material_status = 'archived' then
    raise exception 'An archived material cannot publish a version.';
  end if;

  if v_status = 'published' then
    if v_version.storage_bucket <> 'agilecert-preparation-materials' then
      raise exception 'Published files must use the AgileCert private preparation-material bucket.';
    end if;

    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = v_version.storage_bucket
        and o.name = v_version.storage_path
    ) then
      raise exception 'The uploaded private file could not be found. Upload the file before publishing this version.';
    end if;

    update public.agilecert_preparation_material_versions
    set status = 'retired', updated_at = now()
    where material_id = v_version.material_id
      and id <> v_version.id
      and status = 'published';
  end if;

  update public.agilecert_preparation_material_versions
  set status = v_status,
      published_at = case
        when v_status = 'published' then coalesce(published_at, now())
        else published_at
      end,
      updated_at = now()
  where id = v_version.id
  returning * into v_version;

  if v_status = 'published' then
    update public.agilecert_preparation_materials
    set status = 'published', updated_at = now()
    where id = v_version.material_id;
  elsif not exists (
    select 1 from public.agilecert_preparation_material_versions
    where material_id = v_version.material_id and status = 'published'
  ) then
    update public.agilecert_preparation_materials
    set status = 'draft', updated_at = now()
    where id = v_version.material_id and status = 'published';
  end if;

  return jsonb_build_object(
    'id', v_version.id,
    'materialId', v_version.material_id,
    'versionNumber', v_version.version_number,
    'status', v_version.status,
    'publishedAt', v_version.published_at,
    'updatedBy', v_admin_id,
    'updatedAt', v_version.updated_at
  );
end;
$$;

revoke all on function public.agilecert_is_material_admin() from public, anon, authenticated;
grant execute on function public.agilecert_is_material_admin() to authenticated;

revoke all on function public.authorize_agilecert_material_download(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.authorize_agilecert_material_download(uuid, uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.get_agilecert_material_download_audits(integer)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_material_download_audits(integer)
  to authenticated;

comment on table public.agilecert_material_download_audits is
  'Audits requested, delivered, denied and failed Phase 2.4 candidate material downloads.';
comment on function public.authorize_agilecert_material_download(uuid, uuid, uuid, uuid, text) is
  'Service-role-only entitlement check returning private storage metadata to the delivery Edge Function.';
comment on function public.get_agilecert_material_download_audits(integer) is
  'Returns recent administrator-only preparation-material download audit records.';

notify pgrst, 'reload schema';

commit;
