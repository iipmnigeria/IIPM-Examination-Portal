begin;

-- ---------------------------------------------------------------------------
-- Phase 1B — Visual Certificate Designer, Dynamic Field Mapping and Preview
--
-- This package stores non-authoritative visual overlays and preview sample data
-- for immutable Phase 1A master files. It does not activate a renderer, alter
-- issued certificates, or change examination, payment or verification authority.
-- ---------------------------------------------------------------------------

alter table public.agilecert_certificate_master_versions
  add column if not exists designer_schema_version integer not null default 1,
  add column if not exists designer_updated_by uuid references public.profiles(id),
  add column if not exists designer_updated_at timestamptz;

create table if not exists public.agilecert_certificate_dynamic_field_definitions (
  field_key text primary key,
  label text not null,
  description text not null default '',
  data_type text not null
    check (data_type in ('text', 'date', 'number', 'qr', 'asset')),
  category text not null default 'certificate',
  sample_value text not null default '',
  default_style jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_required_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (field_key ~ '^[a-z][A-Za-z0-9]{1,60}$')
);

insert into public.agilecert_certificate_dynamic_field_definitions (
  field_key, label, description, data_type, category, sample_value,
  default_style, sort_order, is_required_default, is_active
) values
  ('holderName', 'Participant name', 'Full legal or approved display name of the certificate holder.', 'text', 'participant', 'Amina Chukwuma Okafor', '{"fontSizePt":28,"fontWeight":700,"textAlign":"center","fontFamily":"serif"}', 10, true, true),
  ('certificateTitle', 'Certificate title', 'Certificate of Completion, Achievement or Professional Certificate.', 'text', 'certificate', 'Certificate of Achievement', '{"fontSizePt":24,"fontWeight":800,"textAlign":"center","fontFamily":"serif","uppercase":false}', 20, true, true),
  ('programmeTitle', 'Programme title', 'Approved programme, course or certification title.', 'text', 'programme', 'Certified Agile Project Management Professional', '{"fontSizePt":16,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 30, true, true),
  ('programmeCode', 'Programme code', 'Programme or certification code.', 'text', 'programme', 'CAPMP', '{"fontSizePt":10,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 40, false, true),
  ('examinationTitle', 'Examination title', 'Examination or module title attached to the issued credential.', 'text', 'assessment', 'Agile Project Management Professional Examination', '{"fontSizePt":13,"fontWeight":600,"textAlign":"center","fontFamily":"sans"}', 50, false, true),
  ('examinationCode', 'Examination code', 'Examination or module code.', 'text', 'assessment', 'AGILE-PRO-001', '{"fontSizePt":10,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 60, false, true),
  ('score', 'Score', 'Approved examination or assessment score.', 'number', 'assessment', '86%', '{"fontSizePt":12,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 70, false, true),
  ('grade', 'Grade', 'Approved grade, classification or result band.', 'text', 'assessment', 'Distinction', '{"fontSizePt":12,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 80, false, true),
  ('issueDate', 'Issue date', 'Date the credential was issued.', 'date', 'certificate', '1 August 2026', '{"fontSizePt":10,"fontWeight":500,"textAlign":"center","fontFamily":"sans"}', 90, true, true),
  ('completionDate', 'Completion date', 'Date the programme or examination was completed.', 'date', 'certificate', '31 July 2026', '{"fontSizePt":10,"fontWeight":500,"textAlign":"center","fontFamily":"sans"}', 100, false, true),
  ('certificateNumber', 'Certificate number', 'Unique server-issued certificate number.', 'text', 'verification', 'IIPM-2026-000184', '{"fontSizePt":9,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 110, true, true),
  ('verificationCode', 'Verification code', 'Unique public-verification code.', 'text', 'verification', 'VFY-8N4K-2T7Q', '{"fontSizePt":9,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 120, true, true),
  ('qrCode', 'Verification QR code', 'QR code generated from the existing public verification URL.', 'qr', 'verification', 'https://agilecert.iipmi.org/verify/VFY-8N4K-2T7Q', '{"widthPct":10,"heightPct":18}', 130, true, true),
  ('institutionName', 'Issuing institution name', 'Official name of the issuing institution.', 'text', 'institution', 'Integrated Institute of Professional Management', '{"fontSizePt":12,"fontWeight":800,"textAlign":"center","fontFamily":"serif"}', 140, false, true),
  ('institutionLogo', 'Institution logo', 'Approved institutional logo from the private asset library.', 'asset', 'institution', '', '{"widthPct":12,"heightPct":18}', 150, false, true),
  ('institutionSeal', 'Institution seal', 'Approved institutional seal from the private asset library.', 'asset', 'institution', '', '{"widthPct":12,"heightPct":18}', 160, false, true),
  ('authorisedSignature', 'Authorised signature', 'Approved signature asset from the private asset library.', 'asset', 'signatory', '', '{"widthPct":18,"heightPct":10}', 170, false, true),
  ('signatoryName', 'Signatory name', 'Approved name displayed beneath a signature.', 'text', 'signatory', 'Eburuche Obinna Chimezie Banito', '{"fontSizePt":10,"fontWeight":700,"textAlign":"center","fontFamily":"sans"}', 180, false, true),
  ('signatoryTitle', 'Signatory title', 'Approved institutional title displayed beneath a signature.', 'text', 'signatory', 'Executive Director / Registrar', '{"fontSizePt":8,"fontWeight":500,"textAlign":"center","fontFamily":"sans"}', 190, false, true),
  ('customText', 'Custom approved text', 'Static wording approved as part of the template design.', 'text', 'content', 'has successfully completed the approved requirements for', '{"fontSizePt":11,"fontWeight":500,"textAlign":"center","fontFamily":"serif"}', 200, false, true)
on conflict (field_key) do update set
  label = excluded.label,
  description = excluded.description,
  data_type = excluded.data_type,
  category = excluded.category,
  sample_value = excluded.sample_value,
  default_style = excluded.default_style,
  sort_order = excluded.sort_order,
  is_required_default = excluded.is_required_default,
  is_active = true,
  updated_at = now();

create table if not exists public.agilecert_certificate_template_preview_profiles (
  version_id uuid primary key
    references public.agilecert_certificate_master_versions(id) on delete cascade,
  sample_payload jsonb not null default '{}'::jsonb,
  preview_options jsonb not null default
    '{"showSafeArea":true,"showGrid":false,"zoom":1,"backgroundMode":"master"}'::jsonb,
  last_validation_report jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_certificate_preview_profiles_updated_idx
  on public.agilecert_certificate_template_preview_profiles(updated_at desc);

drop trigger if exists agilecert_certificate_dynamic_fields_updated_at
  on public.agilecert_certificate_dynamic_field_definitions;
create trigger agilecert_certificate_dynamic_fields_updated_at
  before update on public.agilecert_certificate_dynamic_field_definitions
  for each row execute function public.set_updated_at();

drop trigger if exists agilecert_certificate_preview_profiles_updated_at
  on public.agilecert_certificate_template_preview_profiles;
create trigger agilecert_certificate_preview_profiles_updated_at
  before update on public.agilecert_certificate_template_preview_profiles
  for each row execute function public.set_updated_at();

alter table public.agilecert_certificate_dynamic_field_definitions enable row level security;
alter table public.agilecert_certificate_template_preview_profiles enable row level security;

revoke all on table public.agilecert_certificate_dynamic_field_definitions
  from public, anon, authenticated;
revoke all on table public.agilecert_certificate_template_preview_profiles
  from public, anon, authenticated;

create or replace function public.certificate_designer_validate_overlay(
  p_version_id uuid,
  p_overlay_schema jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_schema jsonb;
  v_required_fields jsonb;
  v_institution_id uuid;
  v_element jsonb;
  v_field_key text;
  v_element_id text;
  v_asset_id uuid;
  v_field_type text;
  v_x numeric;
  v_y numeric;
  v_width numeric;
  v_height numeric;
  v_font_size numeric;
  v_seen_ids text[] := array[]::text[];
  v_seen_fields text[] := array[]::text[];
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_required text;
  v_element_count integer := 0;
begin
  perform public.agilecert_certificate_require_permission('certificate.console.view');

  select
    coalesce(p_overlay_schema, version.overlay_schema),
    template.required_fields,
    template.institution_id
  into v_schema, v_required_fields, v_institution_id
  from public.agilecert_certificate_master_versions version
  join public.agilecert_certificate_master_templates template
    on template.id = version.template_id
  where version.id = p_version_id;

  if not found then
    raise exception 'Certificate template version not found.';
  end if;

  if jsonb_typeof(v_schema) <> 'array' then
    return jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('The designer overlay must be a JSON array.'),
      'warnings', '[]'::jsonb,
      'missingRequiredFields', coalesce(v_required_fields, '[]'::jsonb),
      'elementCount', 0
    );
  end if;

  v_element_count := jsonb_array_length(v_schema);
  if v_element_count > 80 then
    v_errors := v_errors || jsonb_build_array('A template design may contain at most 80 elements.');
  end if;

  for v_element in select value from jsonb_array_elements(v_schema)
  loop
    if jsonb_typeof(v_element) <> 'object' then
      v_errors := v_errors || jsonb_build_array('Every design element must be a JSON object.');
      continue;
    end if;

    v_element_id := nullif(trim(v_element->>'id'), '');
    v_field_key := nullif(trim(v_element->>'fieldKey'), '');

    if v_element_id is null then
      v_errors := v_errors || jsonb_build_array('Every design element requires a stable id.');
    elsif v_element_id = any(v_seen_ids) then
      v_errors := v_errors || jsonb_build_array('Duplicate design element id: ' || v_element_id);
    else
      v_seen_ids := array_append(v_seen_ids, v_element_id);
    end if;

    if v_field_key is null then
      v_errors := v_errors || jsonb_build_array('Every design element requires a field key.');
      continue;
    end if;

    select definition.data_type
    into v_field_type
    from public.agilecert_certificate_dynamic_field_definitions definition
    where definition.field_key = v_field_key
      and definition.is_active;

    if not found then
      v_errors := v_errors || jsonb_build_array('Unknown or inactive field key: ' || v_field_key);
      continue;
    end if;

    if v_field_key <> 'customText' and v_field_key = any(v_seen_fields) then
      v_errors := v_errors || jsonb_build_array('Dynamic field is mapped more than once: ' || v_field_key);
    else
      v_seen_fields := array_append(v_seen_fields, v_field_key);
    end if;

    v_x := case when jsonb_typeof(v_element->'xPct') = 'number' then (v_element->>'xPct')::numeric end;
    v_y := case when jsonb_typeof(v_element->'yPct') = 'number' then (v_element->>'yPct')::numeric end;
    v_width := case when jsonb_typeof(v_element->'widthPct') = 'number' then (v_element->>'widthPct')::numeric end;
    v_height := case when jsonb_typeof(v_element->'heightPct') = 'number' then (v_element->>'heightPct')::numeric end;

    if v_x is null or v_y is null or v_width is null or v_height is null then
      v_errors := v_errors || jsonb_build_array('Element ' || coalesce(v_element_id, v_field_key) || ' requires numeric x, y, width and height percentages.');
    elsif v_x < 0 or v_y < 0 or v_width <= 0 or v_height <= 0
       or v_x + v_width > 100.001 or v_y + v_height > 100.001 then
      v_errors := v_errors || jsonb_build_array('Element ' || coalesce(v_element_id, v_field_key) || ' is outside the certificate page.');
    elsif v_width < 2 or v_height < 2 then
      v_warnings := v_warnings || jsonb_build_array('Element ' || coalesce(v_element_id, v_field_key) || ' may be too small for print.');
    end if;

    if v_field_type in ('text', 'date', 'number') then
      v_font_size := case when jsonb_typeof(v_element->'fontSizePt') = 'number' then (v_element->>'fontSizePt')::numeric end;
      if v_font_size is null or v_font_size < 4 or v_font_size > 160 then
        v_errors := v_errors || jsonb_build_array('Text element ' || v_field_key || ' requires a font size between 4 and 160 points.');
      elsif v_font_size < 8 then
        v_warnings := v_warnings || jsonb_build_array('Text element ' || v_field_key || ' may be too small for physical printing.');
      end if;
    end if;

    if v_field_type = 'asset' then
      begin
        v_asset_id := nullif(v_element->>'assetId', '')::uuid;
      exception when invalid_text_representation then
        v_asset_id := null;
      end;

      if v_asset_id is null or not exists (
        select 1
        from public.agilecert_certificate_assets asset
        where asset.id = v_asset_id
          and asset.institution_id = v_institution_id
          and asset.status = 'approved'
      ) then
        v_errors := v_errors || jsonb_build_array('Asset field ' || v_field_key || ' must use an approved asset from the template institution.');
      end if;
    end if;
  end loop;

  for v_required in
    select jsonb_array_elements_text(coalesce(v_required_fields, '[]'::jsonb))
  loop
    if not (v_required = any(v_seen_fields)) then
      v_missing := v_missing || jsonb_build_array(v_required);
    end if;
  end loop;

  if jsonb_array_length(v_missing) > 0 then
    v_errors := v_errors || jsonb_build_array('All required certificate fields must be mapped before review.');
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'warnings', v_warnings,
    'missingRequiredFields', v_missing,
    'elementCount', v_element_count,
    'schemaVersion', 2
  );
end;
$$;

revoke all on function public.certificate_designer_validate_overlay(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.certificate_designer_validate_overlay(uuid,jsonb)
  to authenticated;

create or replace function public.get_certificate_template_designer_snapshot(
  p_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.agilecert_certificate_require_permission('certificate.console.view');

  return jsonb_build_object(
    'access', public.get_my_certificate_management_access(),
    'fieldDefinitions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."sortOrder", item.label)
      from (
        select
          definition.field_key as "fieldKey",
          definition.label,
          definition.description,
          definition.data_type as "dataType",
          definition.category,
          definition.sample_value as "sampleValue",
          definition.default_style as "defaultStyle",
          definition.sort_order as "sortOrder",
          definition.is_required_default as "isRequiredDefault"
        from public.agilecert_certificate_dynamic_field_definitions definition
        where definition.is_active
        order by definition.sort_order, definition.label
      ) item
    ), '[]'::jsonb),
    'versions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."createdAt" desc)
      from (
        select
          version.id,
          version.template_id as "templateId",
          template.name as "templateName",
          template.code as "templateCode",
          template.institution_id as "institutionId",
          institution.code as "institutionCode",
          institution.name as "institutionName",
          template.category_id as "categoryId",
          category.code as "categoryCode",
          category.name as "categoryName",
          template.orientation,
          template.page_size as "pageSize",
          template.required_fields as "requiredFields",
          version.version_number as "versionNumber",
          version.source_format as "sourceFormat",
          version.storage_bucket as "storageBucket",
          version.storage_path as "storagePath",
          version.original_filename as "originalFilename",
          version.mime_type as "mimeType",
          version.page_width_points as "pageWidthPoints",
          version.page_height_points as "pageHeightPoints",
          version.pixel_width as "pixelWidth",
          version.pixel_height as "pixelHeight",
          version.overlay_schema as "overlaySchema",
          version.designer_schema_version as "designerSchemaVersion",
          version.designer_updated_at as "designerUpdatedAt",
          version.status,
          version.quality_status as "qualityStatus",
          version.created_at as "createdAt",
          version.updated_at as "updatedAt"
        from public.agilecert_certificate_master_versions version
        join public.agilecert_certificate_master_templates template
          on template.id = version.template_id
        join public.agilecert_certificate_institutions institution
          on institution.id = template.institution_id
        join public.agilecert_certificate_categories category
          on category.id = template.category_id
        where p_version_id is null or version.id = p_version_id
        order by version.created_at desc
      ) item
    ), '[]'::jsonb),
    'assets', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."institutionCode", item."assetType", item.name)
      from (
        select
          asset.id,
          asset.institution_id as "institutionId",
          institution.code as "institutionCode",
          asset.asset_type as "assetType",
          asset.name,
          asset.version_number as "versionNumber",
          asset.storage_bucket as "storageBucket",
          asset.storage_path as "storagePath",
          asset.original_filename as "originalFilename",
          asset.mime_type as "mimeType",
          asset.pixel_width as "pixelWidth",
          asset.pixel_height as "pixelHeight",
          asset.sha256,
          asset.status
        from public.agilecert_certificate_assets asset
        join public.agilecert_certificate_institutions institution
          on institution.id = asset.institution_id
        where asset.status = 'approved'
        order by institution.code, asset.asset_type, asset.name, asset.version_number desc
      ) item
    ), '[]'::jsonb),
    'previewProfiles', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."updatedAt" desc)
      from (
        select
          profile.version_id as "versionId",
          profile.sample_payload as "samplePayload",
          profile.preview_options as "previewOptions",
          profile.last_validation_report as "lastValidationReport",
          profile.updated_at as "updatedAt"
        from public.agilecert_certificate_template_preview_profiles profile
        where p_version_id is null or profile.version_id = p_version_id
        order by profile.updated_at desc
      ) item
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_certificate_template_designer_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_certificate_template_designer_snapshot(uuid)
  to authenticated;

create or replace function public.certificate_admin_save_template_design(
  p_version_id uuid,
  p_overlay_schema jsonb,
  p_sample_payload jsonb default '{}'::jsonb,
  p_preview_options jsonb default '{}'::jsonb,
  p_page_width_points numeric default null,
  p_page_height_points numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_version public.agilecert_certificate_master_versions;
  v_report jsonb;
begin
  perform public.agilecert_certificate_require_permission('certificate.templates.manage');

  select to_jsonb(version)
  into v_before
  from public.agilecert_certificate_master_versions version
  where version.id = p_version_id;

  select *
  into v_version
  from public.agilecert_certificate_master_versions version
  where version.id = p_version_id
  for update;

  if v_version.id is null then
    raise exception 'Certificate template version not found.';
  end if;

  if v_version.status not in ('draft', 'changes_requested') then
    raise exception 'Only draft or changes-requested template versions can be edited in the visual designer.';
  end if;

  if jsonb_typeof(coalesce(p_sample_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Preview sample data must be a JSON object.';
  end if;

  if jsonb_typeof(coalesce(p_preview_options, '{}'::jsonb)) <> 'object' then
    raise exception 'Preview options must be a JSON object.';
  end if;

  v_report := public.certificate_designer_validate_overlay(
    p_version_id,
    coalesce(p_overlay_schema, '[]'::jsonb)
  );

  if not coalesce((v_report->>'valid')::boolean, false) then
    raise exception 'Template design validation failed: %', v_report->'errors';
  end if;

  update public.agilecert_certificate_master_versions set
    overlay_schema = coalesce(p_overlay_schema, '[]'::jsonb),
    designer_schema_version = 2,
    designer_updated_by = auth.uid(),
    designer_updated_at = now(),
    page_width_points = coalesce(p_page_width_points, page_width_points),
    page_height_points = coalesce(p_page_height_points, page_height_points),
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = p_version_id
  returning * into v_version;

  insert into public.agilecert_certificate_template_preview_profiles (
    version_id, sample_payload, preview_options,
    last_validation_report, updated_by
  ) values (
    p_version_id,
    coalesce(p_sample_payload, '{}'::jsonb),
    coalesce(p_preview_options, '{}'::jsonb),
    v_report,
    auth.uid()
  )
  on conflict (version_id) do update set
    sample_payload = excluded.sample_payload,
    preview_options = excluded.preview_options,
    last_validation_report = excluded.last_validation_report,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform public.agilecert_certificate_write_audit(
    'template_version',
    p_version_id::text,
    'template.design.saved',
    v_before,
    to_jsonb(v_version),
    jsonb_build_object(
      'schemaVersion', 2,
      'elementCount', jsonb_array_length(coalesce(p_overlay_schema, '[]'::jsonb)),
      'validation', v_report
    )
  );

  return jsonb_build_object(
    'versionId', p_version_id,
    'overlaySchema', v_version.overlay_schema,
    'designerSchemaVersion', v_version.designer_schema_version,
    'designerUpdatedAt', v_version.designer_updated_at,
    'validation', v_report
  );
end;
$$;

revoke all on function public.certificate_admin_save_template_design(
  uuid,jsonb,jsonb,jsonb,numeric,numeric,text
) from public, anon, authenticated;
grant execute on function public.certificate_admin_save_template_design(
  uuid,jsonb,jsonb,jsonb,numeric,numeric,text
) to authenticated;

comment on table public.agilecert_certificate_dynamic_field_definitions is
  'Extensible field palette for non-authoritative certificate visual overlays.';
comment on table public.agilecert_certificate_template_preview_profiles is
  'Sample data and preview preferences for Certificate Designer review; never an issued certificate record.';
comment on function public.certificate_admin_save_template_design(uuid,jsonb,jsonb,jsonb,numeric,numeric,text) is
  'Saves a validated visual overlay and preview profile for an editable master version without activating a renderer.';

commit;
