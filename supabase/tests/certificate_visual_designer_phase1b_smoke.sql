\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_table text;
  v_function text;
  v_field_count integer;
  v_required_seed_count integer;
begin
  foreach v_table in array array[
    'agilecert_certificate_dynamic_field_definitions',
    'agilecert_certificate_template_preview_profiles'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Certificate Designer table is missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = v_table
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled for %', v_table;
    end if;

    if has_table_privilege('authenticated', 'public.' || v_table, 'select')
      or has_table_privilege('authenticated', 'public.' || v_table, 'insert')
      or has_table_privilege('authenticated', 'public.' || v_table, 'update')
      or has_table_privilege('authenticated', 'public.' || v_table, 'delete') then
      raise exception 'Direct authenticated access must remain revoked for %', v_table;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_certificate_master_versions'
      and column_name = 'designer_schema_version'
  ) then
    raise exception 'designer_schema_version column is missing.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_certificate_master_versions'
      and column_name = 'designer_updated_by'
  ) then
    raise exception 'designer_updated_by column is missing.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_certificate_master_versions'
      and column_name = 'designer_updated_at'
  ) then
    raise exception 'designer_updated_at column is missing.';
  end if;

  select count(*) into v_field_count
  from public.agilecert_certificate_dynamic_field_definitions
  where is_active;

  if v_field_count < 20 then
    raise exception 'The dynamic certificate field palette is incomplete: %', v_field_count;
  end if;

  select count(*) into v_required_seed_count
  from public.agilecert_certificate_dynamic_field_definitions
  where field_key in (
    'holderName',
    'certificateTitle',
    'programmeTitle',
    'issueDate',
    'certificateNumber',
    'verificationCode',
    'qrCode',
    'institutionLogo',
    'institutionSeal',
    'authorisedSignature'
  )
    and is_active;

  if v_required_seed_count <> 10 then
    raise exception 'Core designer fields are incomplete: %', v_required_seed_count;
  end if;

  foreach v_function in array array[
    'public.certificate_designer_validate_overlay(uuid,jsonb)',
    'public.get_certificate_template_designer_snapshot(uuid)',
    'public.certificate_admin_save_template_design(uuid,jsonb,jsonb,jsonb,numeric,numeric,text)'
  ] loop
    if to_regprocedure(v_function) is null then
      raise exception 'Certificate Designer function is missing: %', v_function;
    end if;

    if not exists (
      select 1
      from pg_proc
      where oid = to_regprocedure(v_function)
        and prosecdef
    ) then
      raise exception 'Certificate Designer function must be security definer: %', v_function;
    end if;

    if not has_function_privilege('authenticated', v_function, 'execute') then
      raise exception 'Authenticated administrators require permission-filtered execution for %', v_function;
    end if;
  end loop;

  if has_function_privilege(
    'authenticated',
    'public.resolve_agilecert_certificate_master(uuid,text,timestamptz)',
    'execute'
  ) then
    raise exception 'The server-side master resolver must remain browser-inaccessible.';
  end if;

  if to_regclass('public.agilecert_certificate_templates') is null
    or to_regclass('public.agilecert_certificate_master_templates') is null then
    raise exception 'Legacy and Phase 1A certificate template authorities must remain present.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'agilecert_certificate_master_audit_immutable'
      and not tgisinternal
  ) then
    raise exception 'Certificate master audit immutability must remain enabled.';
  end if;
end;
$test$;

select jsonb_build_object(
  'certificateVisualDesignerPhase1BVerified', true,
  'fieldDefinitions', (
    select count(*)
    from public.agilecert_certificate_dynamic_field_definitions
    where is_active
  ),
  'previewProfiles', (
    select count(*)
    from public.agilecert_certificate_template_preview_profiles
  ),
  'rendererActivated', false,
  'directBrowserTableAccess', false
) as phase1b_result;

rollback;
