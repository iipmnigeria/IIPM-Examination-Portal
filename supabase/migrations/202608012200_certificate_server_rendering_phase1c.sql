begin;

-- ---------------------------------------------------------------------------
-- Phase 1C — Server-side certificate rendering and controlled resolution
--
-- Adds an explicit renderer-enable gate to Phase 1A assignments, immutable
-- certificate-to-master bindings, privacy-minimised render-job evidence and
-- service-role completion authority. Existing issuance, certificate identity,
-- examination, payment, Paystack and public-verification authorities are not
-- replaced or rewritten.
-- ---------------------------------------------------------------------------

insert into public.agilecert_certificate_permission_definitions (
  permission_key, name, description, category, risk_level
) values (
  'certificate.render.manage',
  'Manage Server Certificate Rendering',
  'Enable or disable approved master-template assignments for server-side print-quality PDF rendering.',
  'rendering',
  'restricted'
)
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

insert into public.agilecert_certificate_role_permissions (
  role, permission_key, is_granted
) values ('exam_admin', 'certificate.render.manage', false)
on conflict (role, permission_key) do nothing;

alter table public.agilecert_certificate_master_assignments
  add column if not exists renderer_enabled boolean not null default false,
  add column if not exists renderer_enabled_by uuid references public.profiles(id),
  add column if not exists renderer_enabled_at timestamptz,
  add column if not exists renderer_disabled_at timestamptz,
  add column if not exists renderer_reason text,
  add column if not exists renderer_source_sha256 text,
  add column if not exists renderer_overlay_sha256 text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agilecert_certificate_master_assignments'::regclass
      and conname = 'agilecert_certificate_assignment_renderer_source_hash_check'
  ) then
    alter table public.agilecert_certificate_master_assignments
      add constraint agilecert_certificate_assignment_renderer_source_hash_check
      check (
        renderer_source_sha256 is null
        or renderer_source_sha256 ~ '^[0-9a-f]{64}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agilecert_certificate_master_assignments'::regclass
      and conname = 'agilecert_certificate_assignment_renderer_overlay_hash_check'
  ) then
    alter table public.agilecert_certificate_master_assignments
      add constraint agilecert_certificate_assignment_renderer_overlay_hash_check
      check (
        renderer_overlay_sha256 is null
        or renderer_overlay_sha256 ~ '^[0-9a-f]{64}$'
      );
  end if;
end;
$$;

create index if not exists agilecert_certificate_assignment_renderer_idx
  on public.agilecert_certificate_master_assignments(
    renderer_enabled, is_active, category_id, scope_type, priority
  );

create table if not exists public.agilecert_certificate_render_bindings (
  certificate_id uuid primary key
    references public.agilecert_issued_certificates(id) on delete cascade,
  assignment_id uuid not null
    references public.agilecert_certificate_master_assignments(id) on delete restrict,
  template_id uuid not null
    references public.agilecert_certificate_master_templates(id) on delete restrict,
  template_version_id uuid not null
    references public.agilecert_certificate_master_versions(id) on delete restrict,
  category_code text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  overlay_sha256 text not null check (overlay_sha256 ~ '^[0-9a-f]{64}$'),
  bound_by uuid not null references public.profiles(id) on delete restrict,
  bound_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists agilecert_certificate_render_bindings_assignment_idx
  on public.agilecert_certificate_render_bindings(assignment_id, bound_at desc);

create table if not exists public.agilecert_certificate_render_jobs (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null
    references public.agilecert_issued_certificates(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  assignment_id uuid references public.agilecert_certificate_master_assignments(id) on delete set null,
  template_id uuid references public.agilecert_certificate_master_templates(id) on delete set null,
  template_version_id uuid references public.agilecert_certificate_master_versions(id) on delete set null,
  category_code text not null,
  render_mode text not null default 'managed'
    check (render_mode in ('managed', 'legacy_fallback')),
  status text not null default 'requested'
    check (status in ('requested', 'rendered', 'failed', 'legacy_fallback')),
  renderer_version text,
  source_sha256 text,
  overlay_sha256 text,
  output_sha256 text,
  output_size_bytes bigint,
  output_page_count integer,
  failure_code text,
  failure_message text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  check (overlay_sha256 is null or overlay_sha256 ~ '^[0-9a-f]{64}$'),
  check (output_sha256 is null or output_sha256 ~ '^[0-9a-f]{64}$'),
  check (output_size_bytes is null or output_size_bytes > 0),
  check (output_page_count is null or output_page_count > 0)
);

create index if not exists agilecert_certificate_render_jobs_certificate_idx
  on public.agilecert_certificate_render_jobs(certificate_id, requested_at desc);
create index if not exists agilecert_certificate_render_jobs_status_idx
  on public.agilecert_certificate_render_jobs(status, requested_at desc);

alter table public.agilecert_certificate_render_bindings enable row level security;
alter table public.agilecert_certificate_render_jobs enable row level security;

revoke all on table public.agilecert_certificate_render_bindings
  from public, anon, authenticated;
revoke all on table public.agilecert_certificate_render_jobs
  from public, anon, authenticated;
grant all on table public.agilecert_certificate_render_bindings to service_role;
grant all on table public.agilecert_certificate_render_jobs to service_role;

create or replace function public.agilecert_certificate_render_binding_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Certificate render bindings are immutable.';
end;
$$;

drop trigger if exists agilecert_certificate_render_binding_immutable
  on public.agilecert_certificate_render_bindings;
create trigger agilecert_certificate_render_binding_immutable
  before update or delete on public.agilecert_certificate_render_bindings
  for each row execute function public.agilecert_certificate_render_binding_immutable();

create or replace function public.agilecert_certificate_overlay_sha256(
  p_overlay jsonb
)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(coalesce(p_overlay, '[]'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.agilecert_certificate_overlay_sha256(jsonb)
  from public, anon, authenticated;
grant execute on function public.agilecert_certificate_overlay_sha256(jsonb)
  to service_role;

create or replace function public.certificate_admin_set_assignment_renderer_enabled(
  p_assignment_id uuid,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_before jsonb;
  v_assignment public.agilecert_certificate_master_assignments%rowtype;
  v_version public.agilecert_certificate_master_versions%rowtype;
  v_report jsonb;
  v_overlay_hash text;
  v_referenced_assets integer;
  v_ready_assets integer;
begin
  perform public.agilecert_certificate_require_permission('certificate.render.manage');

  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'Enter a renderer activation or suspension reason of at least 8 characters.';
  end if;

  select to_jsonb(assignment), assignment
  into v_before, v_assignment
  from public.agilecert_certificate_master_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if v_assignment.id is null then
    raise exception 'Certificate master assignment not found.';
  end if;

  select *
  into v_version
  from public.agilecert_certificate_master_versions version
  where version.id = v_assignment.template_version_id;

  if v_version.id is null then
    raise exception 'The assigned certificate master version was not found.';
  end if;

  if coalesce(p_enabled, false) then
    if not v_assignment.is_active then
      raise exception 'Activate the assignment before enabling server rendering.';
    end if;
    if v_version.status <> 'published' then
      raise exception 'Only a published master version can be enabled for server rendering.';
    end if;
    if v_version.quality_status not in ('passed', 'waived') then
      raise exception 'The master version must pass or receive an authorised print-quality waiver.';
    end if;
    if v_version.source_format not in ('pdf', 'png', 'jpeg') then
      raise exception 'Server rendering currently requires a PDF, PNG or JPEG master.';
    end if;
    if v_version.sha256 is null then
      raise exception 'The immutable master SHA-256 digest is required before renderer activation.';
    end if;

    v_report := public.certificate_designer_validate_overlay(
      v_version.id,
      v_version.overlay_schema
    );

    if not coalesce((v_report->>'valid')::boolean, false) then
      raise exception 'The visual overlay is not render-ready: %', v_report->'errors';
    end if;

    select count(distinct nullif(element->>'assetId', '')::uuid)
    into v_referenced_assets
    from jsonb_array_elements(v_version.overlay_schema) element
    where nullif(element->>'assetId', '') is not null;

    select count(distinct asset.id)
    into v_ready_assets
    from jsonb_array_elements(v_version.overlay_schema) element
    join public.agilecert_certificate_assets asset
      on asset.id = nullif(element->>'assetId', '')::uuid
    join public.agilecert_certificate_master_templates template
      on template.id = v_version.template_id
     and template.institution_id = asset.institution_id
    where nullif(element->>'assetId', '') is not null
      and asset.status = 'approved'
      and asset.sha256 is not null
      and asset.mime_type in ('image/png', 'image/jpeg');

    if coalesce(v_ready_assets, 0) <> coalesce(v_referenced_assets, 0) then
      raise exception 'Every referenced asset must be approved, digest-verified, PNG or JPEG, and owned by the issuing institution.';
    end if;

    v_overlay_hash := public.agilecert_certificate_overlay_sha256(
      v_version.overlay_schema
    );
  end if;

  update public.agilecert_certificate_master_assignments set
    renderer_enabled = coalesce(p_enabled, false),
    renderer_enabled_by = case
      when coalesce(p_enabled, false) then auth.uid()
      else renderer_enabled_by
    end,
    renderer_enabled_at = case
      when coalesce(p_enabled, false) then now()
      else renderer_enabled_at
    end,
    renderer_disabled_at = case
      when coalesce(p_enabled, false) then null
      else now()
    end,
    renderer_reason = trim(p_reason),
    renderer_source_sha256 = case
      when coalesce(p_enabled, false) then v_version.sha256
      else renderer_source_sha256
    end,
    renderer_overlay_sha256 = case
      when coalesce(p_enabled, false) then v_overlay_hash
      else renderer_overlay_sha256
    end,
    updated_by = auth.uid()
  where id = p_assignment_id
  returning * into v_assignment;

  perform public.agilecert_certificate_write_audit(
    'assignment',
    v_assignment.id::text,
    case
      when v_assignment.renderer_enabled
        then 'assignment.renderer_enabled'
      else 'assignment.renderer_disabled'
    end,
    v_before,
    to_jsonb(v_assignment),
    jsonb_build_object(
      'reason', trim(p_reason),
      'sourceSha256', v_assignment.renderer_source_sha256,
      'overlaySha256', v_assignment.renderer_overlay_sha256
    )
  );

  return to_jsonb(v_assignment);
end;
$$;

revoke all on function public.certificate_admin_set_assignment_renderer_enabled(
  uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.certificate_admin_set_assignment_renderer_enabled(
  uuid, boolean, text
) to authenticated;

create or replace function public.resolve_agilecert_certificate_render_master(
  p_examination_id uuid,
  p_category_code text,
  p_at timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with context as (
    select examination.id as examination_id, examination.programme_id
    from public.examinations examination
    where examination.id = p_examination_id
  ), ranked as (
    select
      assignment.*,
      case assignment.scope_type
        when 'examination' then 1
        when 'programme' then 2
        else 3
      end as scope_rank
    from public.agilecert_certificate_master_assignments assignment
    join public.agilecert_certificate_categories category
      on category.id = assignment.category_id
     and lower(category.code) = lower(trim(p_category_code))
    join public.agilecert_certificate_master_versions version
      on version.id = assignment.template_version_id
     and version.status = 'published'
     and version.quality_status in ('passed', 'waived')
    join context on true
    where assignment.is_active
      and assignment.renderer_enabled
      and assignment.effective_from <= coalesce(p_at, now())
      and (
        assignment.effective_to is null
        or assignment.effective_to > coalesce(p_at, now())
      )
      and (
        assignment.scope_type = 'global'
        or (
          assignment.scope_type = 'programme'
          and assignment.programme_id = context.programme_id
        )
        or (
          assignment.scope_type = 'examination'
          and assignment.examination_id = context.examination_id
        )
      )
    order by scope_rank, assignment.priority, assignment.effective_from desc
    limit 1
  )
  select case
    when assignment.id is null then null
    else jsonb_build_object(
      'assignmentId', assignment.id,
      'templateId', assignment.template_id,
      'versionId', assignment.template_version_id,
      'categoryCode', category.code,
      'sourceSha256', assignment.renderer_source_sha256,
      'overlaySha256', assignment.renderer_overlay_sha256
    )
  end
  from ranked assignment
  join public.agilecert_certificate_categories category
    on category.id = assignment.category_id;
$$;

revoke all on function public.resolve_agilecert_certificate_render_master(
  uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_agilecert_certificate_render_master(
  uuid, text, timestamptz
) to service_role;

create or replace function public.get_agilecert_certificate_server_render_context(
  p_certificate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_examination public.examinations%rowtype;
  v_programme public.programmes%rowtype;
  v_category_code text;
  v_binding public.agilecert_certificate_render_bindings%rowtype;
  v_resolved jsonb;
  v_assignment public.agilecert_certificate_master_assignments%rowtype;
  v_version public.agilecert_certificate_master_versions%rowtype;
  v_template public.agilecert_certificate_master_templates%rowtype;
  v_institution public.agilecert_certificate_institutions%rowtype;
  v_assets jsonb := '[]'::jsonb;
  v_asset_refs integer := 0;
  v_assets_ready integer := 0;
  v_job_id uuid;
  v_current_overlay_hash text;
  v_verification_url text;
begin
  if v_actor is null then
    raise exception 'Sign in to render an issued certificate.';
  end if;

  v_is_admin := public.agilecert_is_certificate_admin();

  select *
  into v_certificate
  from public.agilecert_issued_certificates certificate
  where certificate.id = p_certificate_id
    and (certificate.candidate_id = v_actor or v_is_admin);

  if v_certificate.id is null then
    raise exception 'The issued certificate was not found or is not available to this account.';
  end if;
  if v_certificate.status <> 'active' then
    raise exception 'Only an active certificate can be rendered as an active credential.';
  end if;

  select * into v_examination
  from public.examinations
  where id = v_certificate.examination_id;

  select * into v_programme
  from public.programmes
  where id = v_examination.programme_id;

  v_category_code := lower(coalesce(
    nullif(v_certificate.metadata->>'certificateCategoryCode', ''),
    case
      when lower(v_certificate.certificate_title) like '%completion%'
        then 'completion'
      when lower(coalesce(v_certificate.metadata->>'productCode', '')) = 'professional'
        then 'professional'
      else 'achievement'
    end
  ));

  v_verification_url :=
    'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify='
    || v_certificate.verification_code;

  select *
  into v_binding
  from public.agilecert_certificate_render_bindings binding
  where binding.certificate_id = v_certificate.id;

  if v_binding.certificate_id is null then
    v_resolved := public.resolve_agilecert_certificate_render_master(
      v_certificate.examination_id,
      v_category_code,
      now()
    );

    if v_resolved is null then
      insert into public.agilecert_certificate_render_jobs (
        certificate_id, candidate_id, requested_by, category_code,
        render_mode, status, completed_at, metadata
      ) values (
        v_certificate.id, v_certificate.candidate_id, v_actor, v_category_code,
        'legacy_fallback', 'legacy_fallback', now(),
        jsonb_build_object('reasonCode', 'NO_RENDERER_ASSIGNMENT')
      ) returning id into v_job_id;

      return jsonb_build_object(
        'mode', 'legacy',
        'reasonCode', 'NO_RENDERER_ASSIGNMENT',
        'jobId', v_job_id
      );
    end if;

    insert into public.agilecert_certificate_render_bindings (
      certificate_id, assignment_id, template_id, template_version_id,
      category_code, source_sha256, overlay_sha256, bound_by, metadata
    ) values (
      v_certificate.id,
      (v_resolved->>'assignmentId')::uuid,
      (v_resolved->>'templateId')::uuid,
      (v_resolved->>'versionId')::uuid,
      v_category_code,
      v_resolved->>'sourceSha256',
      v_resolved->>'overlaySha256',
      v_actor,
      jsonb_build_object('revisionNumber', v_certificate.revision_number)
    )
    on conflict (certificate_id) do nothing;

    select *
    into v_binding
    from public.agilecert_certificate_render_bindings binding
    where binding.certificate_id = v_certificate.id;
  end if;

  select * into v_assignment
  from public.agilecert_certificate_master_assignments
  where id = v_binding.assignment_id;

  select * into v_version
  from public.agilecert_certificate_master_versions
  where id = v_binding.template_version_id;

  select * into v_template
  from public.agilecert_certificate_master_templates
  where id = v_binding.template_id;

  select * into v_institution
  from public.agilecert_certificate_institutions
  where id = v_template.institution_id;

  v_current_overlay_hash := public.agilecert_certificate_overlay_sha256(
    v_version.overlay_schema
  );

  if not coalesce(v_assignment.is_active, false)
    or not coalesce(v_assignment.renderer_enabled, false)
    or v_version.status <> 'published'
    or v_version.quality_status not in ('passed', 'waived')
    or v_version.source_format not in ('pdf', 'png', 'jpeg')
    or v_version.sha256 is null
    or v_assignment.renderer_source_sha256 is distinct from v_version.sha256
    or v_assignment.renderer_overlay_sha256 is distinct from v_current_overlay_hash
    or v_binding.source_sha256 is distinct from v_version.sha256
    or v_binding.overlay_sha256 is distinct from v_current_overlay_hash then
    raise exception 'The assigned server-rendered certificate master is no longer in its approved immutable state.';
  end if;

  select count(distinct nullif(element->>'assetId', '')::uuid)
  into v_asset_refs
  from jsonb_array_elements(v_version.overlay_schema) element
  where nullif(element->>'assetId', '') is not null;

  select
    count(distinct asset.id),
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'id', asset.id,
      'assetType', asset.asset_type,
      'name', asset.name,
      'storageBucket', asset.storage_bucket,
      'storagePath', asset.storage_path,
      'mimeType', asset.mime_type,
      'sha256', asset.sha256,
      'pixelWidth', asset.pixel_width,
      'pixelHeight', asset.pixel_height,
      'metadata', asset.metadata
    )), '[]'::jsonb)
  into v_assets_ready, v_assets
  from jsonb_array_elements(v_version.overlay_schema) element
  join public.agilecert_certificate_assets asset
    on asset.id = nullif(element->>'assetId', '')::uuid
  where nullif(element->>'assetId', '') is not null
    and asset.institution_id = v_template.institution_id
    and asset.status = 'approved'
    and asset.sha256 is not null
    and asset.mime_type in ('image/png', 'image/jpeg');

  if coalesce(v_asset_refs, 0) <> coalesce(v_assets_ready, 0) then
    raise exception 'One or more approved certificate assets are unavailable or have lost their approved state.';
  end if;

  insert into public.agilecert_certificate_render_jobs (
    certificate_id, candidate_id, requested_by,
    assignment_id, template_id, template_version_id,
    category_code, render_mode, status,
    source_sha256, overlay_sha256,
    metadata
  ) values (
    v_certificate.id, v_certificate.candidate_id, v_actor,
    v_assignment.id, v_template.id, v_version.id,
    v_category_code, 'managed', 'requested',
    v_version.sha256, v_current_overlay_hash,
    jsonb_build_object('revisionNumber', v_certificate.revision_number)
  ) returning id into v_job_id;

  return jsonb_build_object(
    'mode', 'managed',
    'jobId', v_job_id,
    'certificate', jsonb_build_object(
      'id', v_certificate.id,
      'certificateNumber', v_certificate.certificate_number,
      'verificationCode', v_certificate.verification_code,
      'holderName', v_certificate.holder_name,
      'certificateTitle', v_certificate.certificate_title,
      'examinationTitle', v_certificate.examination_title,
      'examinationCode', v_examination.code,
      'programmeId', v_programme.id,
      'programmeCode', v_programme.code,
      'programmeTitle', v_programme.name,
      'score', v_certificate.score,
      'passMark', v_certificate.pass_mark,
      'grade', coalesce(v_certificate.metadata->>'grade', ''),
      'issueDate', v_certificate.issue_date,
      'completionDate', coalesce(
        v_certificate.metadata->>'completionDate',
        v_certificate.issue_date::text
      ),
      'issuedAt', v_certificate.issued_at,
      'revisionNumber', v_certificate.revision_number,
      'productCode', lower(coalesce(
        nullif(v_certificate.metadata->>'productCode', ''),
        'achievement'
      ))
    ),
    'institution', jsonb_build_object(
      'id', v_institution.id,
      'code', v_institution.code,
      'name', v_institution.name,
      'shortName', v_institution.short_name,
      'website', v_institution.website
    ),
    'master', jsonb_build_object(
      'assignmentId', v_assignment.id,
      'templateId', v_template.id,
      'templateCode', v_template.code,
      'templateName', v_template.name,
      'versionId', v_version.id,
      'versionNumber', v_version.version_number,
      'sourceFormat', v_version.source_format,
      'storageBucket', v_version.storage_bucket,
      'storagePath', v_version.storage_path,
      'mimeType', v_version.mime_type,
      'sha256', v_version.sha256,
      'pageWidthPoints', v_version.page_width_points,
      'pageHeightPoints', v_version.page_height_points,
      'orientation', v_template.orientation,
      'pageSize', v_template.page_size,
      'overlaySchema', v_version.overlay_schema,
      'overlaySha256', v_current_overlay_hash,
      'qualityStatus', v_version.quality_status
    ),
    'assets', v_assets,
    'verificationUrl', v_verification_url,
    'fileName',
      regexp_replace(
        upper(v_institution.code) || '_' ||
        v_certificate.holder_name || '_' ||
        v_certificate.verification_code || '.pdf',
        '[^A-Za-z0-9._-]+',
        '_',
        'g'
      )
  );
end;
$$;

revoke all on function public.get_agilecert_certificate_server_render_context(uuid)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_certificate_server_render_context(uuid)
  to authenticated;

create or replace function public.complete_agilecert_certificate_server_render(
  p_job_id uuid,
  p_succeeded boolean,
  p_renderer_version text,
  p_output_sha256 text default null,
  p_output_size_bytes bigint default null,
  p_output_page_count integer default null,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.agilecert_certificate_render_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-role authority is required to complete a certificate render job.';
  end if;

  if coalesce(p_succeeded, false) then
    if p_output_sha256 is null
      or p_output_sha256 !~ '^[0-9a-f]{64}$'
      or coalesce(p_output_size_bytes, 0) <= 0
      or coalesce(p_output_page_count, 0) <> 1 then
      raise exception 'A successful render requires a valid output digest, size and one-page result.';
    end if;
  end if;

  update public.agilecert_certificate_render_jobs set
    status = case when coalesce(p_succeeded, false) then 'rendered' else 'failed' end,
    renderer_version = left(trim(coalesce(p_renderer_version, 'unknown')), 80),
    output_sha256 = case when coalesce(p_succeeded, false) then p_output_sha256 else null end,
    output_size_bytes = case when coalesce(p_succeeded, false) then p_output_size_bytes else null end,
    output_page_count = case when coalesce(p_succeeded, false) then p_output_page_count else null end,
    failure_code = case when coalesce(p_succeeded, false) then null else left(trim(coalesce(p_failure_code, 'RENDER_FAILED')), 80) end,
    failure_message = case when coalesce(p_succeeded, false) then null else left(trim(coalesce(p_failure_message, 'Certificate rendering failed.')), 500) end,
    completed_at = now()
  where id = p_job_id
    and status = 'requested'
  returning * into v_job;

  if v_job.id is null then
    raise exception 'The certificate render job was not found or has already completed.';
  end if;

  insert into public.agilecert_certificate_audit_events (
    certificate_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_job.certificate_id,
    v_job.candidate_id,
    v_job.requested_by,
    case when v_job.status = 'rendered'
      then 'server_pdf_render_completed'
      else 'server_pdf_render_failed'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'renderJobId', v_job.id,
      'rendererVersion', v_job.renderer_version,
      'templateVersionId', v_job.template_version_id,
      'outputSha256', v_job.output_sha256,
      'outputSizeBytes', v_job.output_size_bytes,
      'failureCode', v_job.failure_code
    ))
  );

  return jsonb_build_object(
    'jobId', v_job.id,
    'status', v_job.status,
    'completedAt', v_job.completed_at
  );
end;
$$;

revoke all on function public.complete_agilecert_certificate_server_render(
  uuid, boolean, text, text, bigint, integer, text, text
) from public, anon, authenticated;
grant execute on function public.complete_agilecert_certificate_server_render(
  uuid, boolean, text, text, bigint, integer, text, text
) to service_role;

create or replace function public.get_certificate_renderer_console_snapshot(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
begin
  perform public.agilecert_certificate_require_permission('certificate.console.view');

  return jsonb_build_object(
    'access', jsonb_build_object(
      'canManageRenderer',
        public.agilecert_certificate_has_permission('certificate.render.manage')
    ),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."createdAt" desc)
      from (
        select
          assignment.id,
          assignment.scope_type as "scopeType",
          assignment.programme_id as "programmeId",
          programme.code as "programmeCode",
          programme.name as "programmeName",
          assignment.examination_id as "examinationId",
          examination.code as "examinationCode",
          examination.title as "examinationTitle",
          assignment.priority,
          assignment.is_active as "isActive",
          assignment.renderer_enabled as "rendererEnabled",
          assignment.renderer_enabled_at as "rendererEnabledAt",
          assignment.renderer_disabled_at as "rendererDisabledAt",
          assignment.renderer_reason as "rendererReason",
          template.code as "templateCode",
          template.name as "templateName",
          category.code as "categoryCode",
          category.name as "categoryName",
          institution.code as "institutionCode",
          institution.name as "institutionName",
          version.id as "versionId",
          version.version_number as "versionNumber",
          version.source_format as "sourceFormat",
          version.status as "versionStatus",
          version.quality_status as "qualityStatus",
          version.sha256 as "sourceSha256",
          jsonb_array_length(version.overlay_schema) as "overlayElementCount",
          assignment.created_at as "createdAt",
          (
            select count(*)
            from public.agilecert_certificate_render_bindings binding
            where binding.assignment_id = assignment.id
          ) as "bindingCount"
        from public.agilecert_certificate_master_assignments assignment
        join public.agilecert_certificate_master_templates template
          on template.id = assignment.template_id
        join public.agilecert_certificate_master_versions version
          on version.id = assignment.template_version_id
        join public.agilecert_certificate_categories category
          on category.id = assignment.category_id
        join public.agilecert_certificate_institutions institution
          on institution.id = template.institution_id
        left join public.programmes programme
          on programme.id = assignment.programme_id
        left join public.examinations examination
          on examination.id = assignment.examination_id
        order by assignment.created_at desc
      ) item
    ), '[]'::jsonb),
    'recentJobs', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."requestedAt" desc)
      from (
        select
          job.id,
          job.certificate_id as "certificateId",
          certificate.certificate_number as "certificateNumber",
          certificate.holder_name as "holderName",
          job.render_mode as "renderMode",
          job.status,
          job.category_code as "categoryCode",
          job.renderer_version as "rendererVersion",
          job.output_size_bytes as "outputSizeBytes",
          job.output_page_count as "outputPageCount",
          job.failure_code as "failureCode",
          job.requested_at as "requestedAt",
          job.completed_at as "completedAt"
        from public.agilecert_certificate_render_jobs job
        join public.agilecert_issued_certificates certificate
          on certificate.id = job.certificate_id
        order by job.requested_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_certificate_renderer_console_snapshot(integer)
  from public, anon, authenticated;
grant execute on function public.get_certificate_renderer_console_snapshot(integer)
  to authenticated;

comment on table public.agilecert_certificate_render_bindings is
  'Immutable first-managed-render binding from an issued certificate to one approved master assignment and version.';
comment on table public.agilecert_certificate_render_jobs is
  'Privacy-minimised metadata evidence for managed and explicit legacy-fallback certificate render requests.';
comment on function public.get_agilecert_certificate_server_render_context(uuid) is
  'Candidate/admin-owned render context. Returns legacy mode unless an assignment is explicitly renderer-enabled.';
comment on function public.complete_agilecert_certificate_server_render(uuid,boolean,text,text,bigint,integer,text,text) is
  'Service-role-only completion authority for one-page server-generated certificate PDF evidence.';

commit;
