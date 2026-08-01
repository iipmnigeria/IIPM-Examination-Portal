begin;

-- ---------------------------------------------------------------------------
-- Phase 1D — Controlled certificate template contract authority
--
-- Adds one permission-checked RPC for updating a draft or returned template's
-- required dynamic fields and print-quality contract. It does not create,
-- publish, assign or renderer-enable a template and does not touch issued
-- certificates, examinations, results, commerce or verification authority.
-- ---------------------------------------------------------------------------

create or replace function public.certificate_admin_set_template_contract(
  p_template_id uuid,
  p_required_fields jsonb,
  p_quality_standard jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_template public.agilecert_certificate_master_templates%rowtype;
  v_field text;
  v_seen text[] := array[]::text[];
  v_missing integer;
  v_master_formats jsonb;
  v_minimum_dpi integer;
begin
  perform public.agilecert_certificate_require_permission(
    'certificate.templates.manage'
  );

  select *
  into v_template
  from public.agilecert_certificate_master_templates template
  where template.id = p_template_id
  for update;

  if v_template.id is null then
    raise exception 'Certificate master template not found.';
  end if;

  if v_template.status not in ('draft', 'in_review') then
    raise exception 'Only draft or in-review templates may change their field and quality contract.';
  end if;

  if jsonb_typeof(coalesce(p_required_fields, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_required_fields) = 0 then
    raise exception 'Required certificate fields must be a non-empty JSON array.';
  end if;

  if jsonb_array_length(p_required_fields) > 40 then
    raise exception 'A certificate template may require at most 40 dynamic fields.';
  end if;

  for v_field in
    select jsonb_array_elements_text(p_required_fields)
  loop
    v_field := trim(v_field);
    if v_field = '' then
      raise exception 'Required certificate field keys cannot be blank.';
    end if;
    if v_field = any(v_seen) then
      raise exception 'Duplicate required certificate field: %', v_field;
    end if;
    v_seen := array_append(v_seen, v_field);
  end loop;

  select count(*)
  into v_missing
  from unnest(v_seen) required_field
  left join public.agilecert_certificate_dynamic_field_definitions definition
    on definition.field_key = required_field
   and definition.is_active
  where definition.field_key is null;

  if v_missing > 0 then
    raise exception 'Every required certificate field must be an active dynamic-field definition.';
  end if;

  if jsonb_typeof(coalesce(p_quality_standard, 'null'::jsonb)) <> 'object' then
    raise exception 'The print-quality standard must be a JSON object.';
  end if;

  v_minimum_dpi := case
    when jsonb_typeof(p_quality_standard->'minimumPrintDpi') = 'number'
      then (p_quality_standard->>'minimumPrintDpi')::integer
    else null
  end;

  if v_minimum_dpi is null or v_minimum_dpi < 150 or v_minimum_dpi > 2400 then
    raise exception 'The print-quality contract requires minimumPrintDpi between 150 and 2400.';
  end if;

  v_master_formats := p_quality_standard->'masterFormats';
  if jsonb_typeof(v_master_formats) <> 'array'
    or jsonb_array_length(v_master_formats) = 0 then
    raise exception 'The print-quality contract requires at least one master format.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_master_formats) format
    where format not in ('pdf', 'svg', 'png', 'jpeg')
  ) then
    raise exception 'The print-quality contract contains an unsupported master format.';
  end if;

  if coalesce((p_quality_standard->>'singlePageRequired')::boolean, false) is not true then
    raise exception 'Managed certificate templates must require a single-page master.';
  end if;

  if coalesce((p_quality_standard->>'longNameTestRequired')::boolean, false) is not true
    or coalesce((p_quality_standard->>'qrScanTestRequired')::boolean, false) is not true then
    raise exception 'Managed certificate templates must require long-name and QR scan tests.';
  end if;

  v_before := to_jsonb(v_template);

  update public.agilecert_certificate_master_templates set
    required_fields = to_jsonb(v_seen),
    quality_standard = p_quality_standard,
    notes = coalesce(nullif(trim(p_notes), ''), notes),
    updated_by = auth.uid()
  where id = p_template_id
  returning * into v_template;

  perform public.agilecert_certificate_write_audit(
    'template',
    v_template.id::text,
    'template.contract.updated',
    v_before,
    to_jsonb(v_template),
    jsonb_build_object(
      'requiredFieldCount', array_length(v_seen, 1),
      'minimumPrintDpi', v_minimum_dpi,
      'masterFormats', v_master_formats
    )
  );

  return jsonb_build_object(
    'templateId', v_template.id,
    'requiredFields', v_template.required_fields,
    'qualityStandard', v_template.quality_standard,
    'updatedAt', v_template.updated_at
  );
end;
$$;

revoke all on function public.certificate_admin_set_template_contract(
  uuid, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.certificate_admin_set_template_contract(
  uuid, jsonb, jsonb, text
) to authenticated;

comment on function public.certificate_admin_set_template_contract(uuid,jsonb,jsonb,text) is
  'Permission-checked template contract authority for required dynamic fields and print-quality rules before design review or publication.';

commit;
