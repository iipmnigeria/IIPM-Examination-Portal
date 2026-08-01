begin;

select set_config('request.jwt.claim.role', 'service_role', true);

-- Migration and fail-closed activation boundary.
do $$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '202608012200'
  ) then
    raise exception 'Phase 1C migration is not recorded.';
  end if;

  if to_regclass('public.agilecert_certificate_render_bindings') is null
     or to_regclass('public.agilecert_certificate_render_jobs') is null then
    raise exception 'Phase 1C renderer evidence tables are missing.';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_certificate_master_assignments'
      and column_name in (
        'renderer_enabled',
        'renderer_enabled_by',
        'renderer_enabled_at',
        'renderer_disabled_at',
        'renderer_reason',
        'renderer_source_sha256',
        'renderer_overlay_sha256'
      )
  ) <> 7 then
    raise exception 'Phase 1C assignment activation columns are incomplete.';
  end if;

  if exists (
    select 1
    from public.agilecert_certificate_master_assignments
    where renderer_enabled
  ) then
    raise exception 'Phase 1C must not automatically enable any assignment.';
  end if;
end;
$$;

-- Least privilege, RLS and immutable binding controls.
do $$
declare
  v_direct_grants integer;
  v_trigger_count integer;
begin
  if not exists (
    select 1
    from public.agilecert_certificate_permission_definitions
    where permission_key = 'certificate.render.manage'
      and is_active
  ) then
    raise exception 'Renderer management permission is missing.';
  end if;

  if not exists (
    select 1
    from public.agilecert_certificate_role_permissions
    where role = 'exam_admin'
      and permission_key = 'certificate.render.manage'
      and is_granted = false
  ) then
    raise exception 'Examination Administrator renderer management must remain denied by default.';
  end if;

  if (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'agilecert_certificate_render_bindings',
        'agilecert_certificate_render_jobs'
      )
      and relation.relrowsecurity
  ) <> 2 then
    raise exception 'Phase 1C evidence tables must have RLS enabled.';
  end if;

  select count(*) into v_direct_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'agilecert_certificate_render_bindings',
      'agilecert_certificate_render_jobs'
    )
    and grant_row.grantee in ('anon', 'authenticated', 'PUBLIC');

  if v_direct_grants <> 0 then
    raise exception 'Direct browser grants exist on Phase 1C evidence tables.';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger trigger_row
  join pg_class relation on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'agilecert_certificate_render_bindings'
    and trigger_row.tgname = 'agilecert_certificate_render_binding_immutable'
    and not trigger_row.tgisinternal;

  if v_trigger_count <> 1 then
    raise exception 'The immutable render-binding trigger is missing.';
  end if;
end;
$$;

-- Function authority and browser/service-role separation.
do $$
declare
  v_required_security_definer integer;
begin
  select count(distinct function_row.proname)
  into v_required_security_definer
  from pg_proc function_row
  join pg_namespace namespace on namespace.oid = function_row.pronamespace
  where namespace.nspname = 'public'
    and function_row.proname in (
      'agilecert_certificate_overlay_sha256',
      'certificate_admin_set_assignment_renderer_enabled',
      'resolve_agilecert_certificate_render_master',
      'get_agilecert_certificate_server_render_context',
      'complete_agilecert_certificate_server_render',
      'get_certificate_renderer_console_snapshot'
    )
    and function_row.prosecdef;

  if v_required_security_definer <> 6 then
    raise exception 'Phase 1C security-definer function set is incomplete.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.certificate_admin_set_assignment_renderer_enabled(uuid,boolean,text)',
    'execute'
  ) then
    raise exception 'Authenticated administrators cannot call the renderer activation RPC.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_agilecert_certificate_server_render_context(uuid)',
    'execute'
  ) then
    raise exception 'Authenticated certificate owners cannot request a controlled render context.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_certificate_renderer_console_snapshot(integer)',
    'execute'
  ) then
    raise exception 'Authenticated administrators cannot call the renderer console snapshot RPC.';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_agilecert_certificate_server_render_context(uuid)',
    'execute'
  ) then
    raise exception 'Anonymous users must not obtain certificate render contexts.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.resolve_agilecert_certificate_render_master(uuid,text,timestamptz)',
    'execute'
  ) then
    raise exception 'The internal renderer resolver is exposed to authenticated browser sessions.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.complete_agilecert_certificate_server_render(uuid,boolean,text,text,bigint,integer,text,text)',
    'execute'
  ) then
    raise exception 'Browser sessions can complete render evidence.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.resolve_agilecert_certificate_render_master(uuid,text,timestamptz)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.complete_agilecert_certificate_server_render(uuid,boolean,text,text,bigint,integer,text,text)',
    'execute'
  ) then
    raise exception 'Service-role renderer authority is incomplete.';
  end if;
end;
$$;

-- Stable digest authority for immutable overlay snapshots.
do $$
declare
  v_first text;
  v_second text;
begin
  v_first := public.agilecert_certificate_overlay_sha256(
    '[{"fieldKey":"holderName","xPct":10,"yPct":10}]'::jsonb
  );
  v_second := public.agilecert_certificate_overlay_sha256(
    '[{"yPct":10,"xPct":10,"fieldKey":"holderName"}]'::jsonb
  );

  if v_first !~ '^[0-9a-f]{64}$' or v_first <> v_second then
    raise exception 'Overlay digest authority is not deterministic.';
  end if;
end;
$$;

-- Legacy and Phase 1A/1B authorities remain distinct and present.
do $$
begin
  if to_regclass('public.agilecert_certificate_templates') is null
     or to_regclass('public.agilecert_certificate_master_templates') is null
     or to_regclass('public.agilecert_certificate_template_preview_profiles') is null then
    raise exception 'A predecessor certificate authority is missing after Phase 1C.';
  end if;

  if to_regprocedure('public.resolve_agilecert_certificate_master(uuid,text,timestamptz)') is null
     or to_regprocedure('public.certificate_admin_save_template_design(uuid,jsonb,jsonb,jsonb,numeric,numeric,text)') is null then
    raise exception 'Phase 1A or Phase 1B authority is missing after Phase 1C.';
  end if;
end;
$$;

select 'certificateServerRenderingPhase1CVerified' as verification;
rollback;
