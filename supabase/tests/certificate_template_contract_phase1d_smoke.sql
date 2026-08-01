\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

-- Structural authority and browser separation.
do $test$
declare
  v_function regprocedure := to_regprocedure(
    'public.certificate_admin_set_template_contract(uuid,jsonb,jsonb,text)'
  );
begin
  if v_function is null then
    raise exception 'Phase 1D template contract RPC is missing.';
  end if;

  if not exists (
    select 1
    from pg_proc function_row
    where function_row.oid = v_function
      and function_row.prosecdef
  ) then
    raise exception 'The template contract RPC must remain security definer.';
  end if;

  if not has_function_privilege('authenticated', v_function, 'execute') then
    raise exception 'Authenticated administrators require permission-filtered template contract execution.';
  end if;

  if has_function_privilege('anon', v_function, 'execute') then
    raise exception 'Anonymous users must not execute the template contract RPC.';
  end if;

  if position(
    'certificate.templates.manage'
    in pg_get_functiondef(v_function)
  ) = 0 then
    raise exception 'The template contract RPC lost its permission check.';
  end if;
end;
$test$;

-- The null actor must fail through the normal permission boundary.
do $test$
begin
  begin
    perform public.certificate_admin_set_template_contract(
      gen_random_uuid(),
      '["holderName"]'::jsonb,
      '{"minimumPrintDpi":300,"masterFormats":["pdf"],"singlePageRequired":true,"longNameTestRequired":true,"qrScanTestRequired":true}'::jsonb,
      'Permission denial smoke test'
    );
    raise exception 'Unauthenticated template contract update unexpectedly succeeded.';
  exception
    when others then
      if position('Authentication is required' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$test$;

create temp table phase1d_contract_fixture (
  template_id uuid primary key,
  actor_id uuid not null
) on commit drop;

-- Create a normal transactional Supabase auth user. The existing auth trigger
-- creates the matching profile, which is then elevated to Super Administrator
-- so the real certificate.templates.manage permission path is exercised.
do $test$
declare
  v_actor uuid := '91d10000-0000-4000-8000-000000000001'::uuid;
  v_template_id uuid := gen_random_uuid();
  v_institution_id uuid;
  v_category_id uuid;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'phase1d-contract-test@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Phase 1D Contract Test Administrator"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  update public.profiles
  set role = 'super_admin',
      is_active = true
  where id = v_actor;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_actor
      and profile.role = 'super_admin'
      and profile.is_active
  ) then
    raise exception 'The transactional Super Administrator profile was not created.';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if auth.uid() is distinct from v_actor then
    raise exception 'The transactional JWT actor was not established.';
  end if;

  if not public.agilecert_certificate_has_permission(
    'certificate.templates.manage'
  ) then
    raise exception 'The transactional Super Administrator lacks template management authority.';
  end if;

  select institution.id
  into v_institution_id
  from public.agilecert_certificate_institutions institution
  where institution.code = 'CIPMN'
  limit 1;

  select category.id
  into v_category_id
  from public.agilecert_certificate_categories category
  where category.code = 'completion'
  limit 1;

  if v_institution_id is null or v_category_id is null then
    raise exception 'Phase 1A institution/category seeds are missing.';
  end if;

  insert into public.agilecert_certificate_master_templates (
    id,
    institution_id,
    category_id,
    code,
    name,
    description,
    orientation,
    page_size,
    status,
    required_fields,
    quality_standard,
    created_by
  ) values (
    v_template_id,
    v_institution_id,
    v_category_id,
    'PHASE1D_CONTRACT_TEST',
    'Phase 1D Contract Test',
    'Transactional template contract fixture.',
    'landscape',
    'A4',
    'draft',
    '["holderName"]'::jsonb,
    '{"minimumPrintDpi":300,"masterFormats":["pdf"],"singlePageRequired":true,"longNameTestRequired":true,"qrScanTestRequired":true}'::jsonb,
    v_actor
  );

  insert into phase1d_contract_fixture(template_id, actor_id)
  values (v_template_id, v_actor);
end;
$test$;

-- Valid approved-CIPMN contract.
do $test$
declare
  v_template_id uuid;
  v_actor uuid;
  v_result jsonb;
  v_required jsonb := '[
    "holderName",
    "examinationTitle",
    "examinationCode",
    "score",
    "completionDate",
    "certificateNumber",
    "verificationCode",
    "qrCode"
  ]'::jsonb;
  v_quality jsonb := '{
    "minimumPrintDpi":300,
    "masterFormats":["pdf"],
    "singlePageRequired":true,
    "physicalPrintReviewRequired":true,
    "longNameTestRequired":true,
    "qrScanTestRequired":true,
    "fixedArtworkEmbedded":true,
    "referencedAssetsRequired":false
  }'::jsonb;
begin
  select template_id, actor_id
  into v_template_id, v_actor
  from phase1d_contract_fixture;

  v_result := public.certificate_admin_set_template_contract(
    v_template_id,
    v_required,
    v_quality,
    'Approved CIPMN managed completion certificate contract.'
  );

  if (v_result->>'templateId')::uuid <> v_template_id then
    raise exception 'Template contract RPC returned the wrong template.';
  end if;

  if (select required_fields from public.agilecert_certificate_master_templates where id = v_template_id)
     is distinct from v_required then
    raise exception 'Required field contract was not persisted exactly.';
  end if;

  if (select quality_standard from public.agilecert_certificate_master_templates where id = v_template_id)
     is distinct from v_quality then
    raise exception 'Quality contract was not persisted exactly.';
  end if;

  if not exists (
    select 1
    from public.agilecert_certificate_master_audit audit
    where audit.entity_type = 'template'
      and audit.entity_id = v_template_id::text
      and audit.action = 'template.contract.updated'
      and audit.actor_id = v_actor
  ) then
    raise exception 'Template contract update was not audited against the authenticated actor.';
  end if;
end;
$test$;

-- Duplicate required fields are denied.
do $test$
declare
  v_template_id uuid;
begin
  select template_id into v_template_id from phase1d_contract_fixture;
  begin
    perform public.certificate_admin_set_template_contract(
      v_template_id,
      '["holderName","holderName"]'::jsonb,
      '{"minimumPrintDpi":300,"masterFormats":["pdf"],"singlePageRequired":true,"longNameTestRequired":true,"qrScanTestRequired":true}'::jsonb,
      'Duplicate field denial'
    );
    raise exception 'Duplicate required fields unexpectedly succeeded.';
  exception when others then
    if position('Duplicate required certificate field' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$test$;

-- Unknown fields are denied.
do $test$
declare
  v_template_id uuid;
begin
  select template_id into v_template_id from phase1d_contract_fixture;
  begin
    perform public.certificate_admin_set_template_contract(
      v_template_id,
      '["holderName","unknownPhase1dField"]'::jsonb,
      '{"minimumPrintDpi":300,"masterFormats":["pdf"],"singlePageRequired":true,"longNameTestRequired":true,"qrScanTestRequired":true}'::jsonb,
      'Unknown field denial'
    );
    raise exception 'Unknown required field unexpectedly succeeded.';
  exception when others then
    if position('active dynamic-field definition' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$test$;

-- Weak or incomplete print contracts are denied.
do $test$
declare
  v_template_id uuid;
begin
  select template_id into v_template_id from phase1d_contract_fixture;
  begin
    perform public.certificate_admin_set_template_contract(
      v_template_id,
      '["holderName"]'::jsonb,
      '{"minimumPrintDpi":72,"masterFormats":["pdf"],"singlePageRequired":false,"longNameTestRequired":false,"qrScanTestRequired":false}'::jsonb,
      'Weak quality denial'
    );
    raise exception 'Weak print-quality contract unexpectedly succeeded.';
  exception when others then
    if position('minimumPrintDpi' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$test$;

-- Published templates cannot change their contract.
do $test$
declare
  v_template_id uuid;
begin
  select template_id into v_template_id from phase1d_contract_fixture;
  update public.agilecert_certificate_master_templates
  set status = 'published'
  where id = v_template_id;

  begin
    perform public.certificate_admin_set_template_contract(
      v_template_id,
      '["holderName"]'::jsonb,
      '{"minimumPrintDpi":300,"masterFormats":["pdf"],"singlePageRequired":true,"longNameTestRequired":true,"qrScanTestRequired":true}'::jsonb,
      'Published contract denial'
    );
    raise exception 'Published template contract unexpectedly changed.';
  exception when others then
    if position('Only draft or in-review templates' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$test$;

select jsonb_build_object(
  'certificateTemplateContractPhase1DVerified', true,
  'rpcSecurityDefiner', true,
  'authenticatedPermissionFiltered', true,
  'anonymousDenied', true,
  'realAuthFixture', true,
  'realSuperAdministratorPermissionPath', true,
  'validContractPersisted', true,
  'auditActorVerified', true,
  'duplicateFieldsDenied', true,
  'unknownFieldsDenied', true,
  'weakQualityDenied', true,
  'publishedMutationDenied', true
) as verification;

rollback;
