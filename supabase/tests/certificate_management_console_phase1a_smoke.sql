\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_table text;
  v_function text;
  v_bucket record;
  v_permission_count integer;
  v_default_grants integer;
  v_restricted_grants integer;
begin
  foreach v_table in array array[
    'agilecert_certificate_permission_definitions',
    'agilecert_certificate_role_permissions',
    'agilecert_certificate_institutions',
    'agilecert_certificate_categories',
    'agilecert_certificate_assets',
    'agilecert_certificate_templates',
    'agilecert_certificate_template_versions',
    'agilecert_certificate_template_assignments',
    'agilecert_certificate_template_audit'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Certificate Management Console table is missing: %', v_table;
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
      raise exception 'Direct authenticated table access must remain revoked for %', v_table;
    end if;
  end loop;

  select count(*) into v_permission_count
  from public.agilecert_certificate_permission_definitions
  where permission_key in (
    'certificate.console.view',
    'certificate.institutions.manage',
    'certificate.categories.manage',
    'certificate.templates.manage',
    'certificate.templates.review',
    'certificate.templates.approve',
    'certificate.templates.publish',
    'certificate.assets.manage',
    'certificate.assets.approve',
    'certificate.assignments.manage',
    'certificate.permissions.manage'
  ) and is_active;
  if v_permission_count <> 11 then
    raise exception 'Certificate permission definitions are incomplete: %', v_permission_count;
  end if;

  select count(*) into v_default_grants
  from public.agilecert_certificate_role_permissions
  where role = 'exam_admin'
    and is_granted
    and permission_key in (
      'certificate.console.view',
      'certificate.templates.manage',
      'certificate.templates.review',
      'certificate.assets.manage'
    );
  if v_default_grants <> 4 then
    raise exception 'Expected four default Examination Administrator grants, found %', v_default_grants;
  end if;

  select count(*) into v_restricted_grants
  from public.agilecert_certificate_role_permissions
  where role = 'exam_admin'
    and is_granted
    and permission_key in (
      'certificate.institutions.manage',
      'certificate.categories.manage',
      'certificate.templates.approve',
      'certificate.templates.publish',
      'certificate.assets.approve',
      'certificate.assignments.manage',
      'certificate.permissions.manage'
    );
  if v_restricted_grants <> 0 then
    raise exception 'Restricted certificate permissions must remain ungranted by default.';
  end if;

  if (
    select count(*)
    from public.agilecert_certificate_institutions
    where upper(code) in ('IIPM', 'CIPMN') and is_active
  ) <> 2 then
    raise exception 'Initial IIPM and CIPMN issuing institutions are missing.';
  end if;

  if (
    select count(*)
    from public.agilecert_certificate_categories
    where lower(code) in ('completion', 'achievement', 'professional') and is_active
  ) <> 3 then
    raise exception 'Initial completion, achievement and professional categories are missing.';
  end if;

  for v_bucket in
    select id, public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id in ('certificate-masters', 'certificate-assets')
  loop
    if v_bucket.public then
      raise exception 'Certificate storage bucket must be private: %', v_bucket.id;
    end if;
    if v_bucket.file_size_limit is null or v_bucket.file_size_limit <= 0 then
      raise exception 'Certificate storage bucket requires a file-size limit: %', v_bucket.id;
    end if;
    if v_bucket.allowed_mime_types is null or cardinality(v_bucket.allowed_mime_types) = 0 then
      raise exception 'Certificate storage bucket requires MIME restrictions: %', v_bucket.id;
    end if;
  end loop;
  if (
    select count(*) from storage.buckets
    where id in ('certificate-masters', 'certificate-assets')
  ) <> 2 then
    raise exception 'Certificate master and asset storage buckets are incomplete.';
  end if;

  foreach v_function in array array[
    'public.get_my_certificate_management_access()',
    'public.get_certificate_management_console_snapshot(integer)',
    'public.certificate_admin_upsert_institution(uuid,text,text,text,text,text,text,text,text,boolean)',
    'public.certificate_admin_upsert_category(uuid,text,text,text,boolean,boolean,integer,boolean)',
    'public.certificate_admin_create_template(uuid,uuid,text,text,text,text,text,text)',
    'public.certificate_admin_register_template_version(uuid,text,text,text,text,text,bigint,text,integer,integer,text)',
    'public.certificate_admin_register_asset(uuid,text,text,text,text,text,text,bigint,text,integer,integer)',
    'public.certificate_admin_record_quality_review(uuid,text,jsonb,text)',
    'public.certificate_admin_transition_template_version(uuid,text,text)',
    'public.certificate_admin_set_asset_status(uuid,text,text)',
    'public.certificate_admin_assign_template(uuid,uuid,text,uuid,uuid,integer,timestamptz,timestamptz)',
    'public.certificate_admin_set_assignment_active(uuid,boolean,text)',
    'public.certificate_admin_set_permission(text,boolean,text)',
    'public.resolve_agilecert_certificate_master(uuid,text,timestamptz)'
  ] loop
    if to_regprocedure(v_function) is null then
      raise exception 'Certificate Management Console function is missing: %', v_function;
    end if;
    if not exists (
      select 1 from pg_proc where oid = to_regprocedure(v_function) and prosecdef
    ) then
      raise exception 'Certificate Management Console function must be security definer: %', v_function;
    end if;
  end loop;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_certificate_management_access()',
    'execute'
  ) then
    raise exception 'Authenticated users require the permission-filtered access RPC.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_certificate_management_console_snapshot(integer)',
    'execute'
  ) then
    raise exception 'Authenticated administrators require the permission-filtered snapshot RPC.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.resolve_agilecert_certificate_master(uuid,text,timestamptz)',
    'execute'
  ) then
    raise exception 'The future server-side master resolver must not be browser-executable.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'agilecert_certificate_template_audit_immutable'
      and not tgisinternal
  ) then
    raise exception 'Immutable certificate audit trigger is missing.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'agilecert_certificate_assignments_exam_active_uidx'
  ) then
    raise exception 'Examination-specific active assignment uniqueness is missing.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'agilecert_certificate_assignments_programme_active_uidx'
  ) then
    raise exception 'Programme-specific active assignment uniqueness is missing.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'agilecert_certificate_assignments_global_active_uidx'
  ) then
    raise exception 'Global category assignment uniqueness is missing.';
  end if;
end;
$test$;

select jsonb_build_object(
  'institutions', (
    select count(*) from public.agilecert_certificate_institutions where is_active
  ),
  'categories', (
    select count(*) from public.agilecert_certificate_categories where is_active
  ),
  'permissionDefinitions', (
    select count(*) from public.agilecert_certificate_permission_definitions where is_active
  ),
  'privateBuckets', (
    select count(*) from storage.buckets
    where id in ('certificate-masters', 'certificate-assets') and public = false
  ),
  'browserMasterResolverDenied', true,
  'immutableAuditVerified', true,
  'certificateManagementConsolePhase1AVerified', true
) as certificate_management_console_phase1a_smoke;

rollback;
