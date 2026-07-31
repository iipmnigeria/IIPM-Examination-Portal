\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '31110100-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'cert-rules-super@example.test',
    extensions.crypt('CertRulesSuper1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Rules Super Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31110100-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'cert-rules-admin@example.test',
    extensions.crypt('CertRulesAdmin1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Rules Examination Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31110100-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'cert-rules-candidate@example.test',
    extensions.crypt('CertRulesCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Rules Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, is_active)
values
  ('31110100-0000-0000-0000-000000000001', 'Certification Rules Super Administrator', 'cert-rules-super@example.test', 'super_admin', true),
  ('31110100-0000-0000-0000-000000000002', 'Certification Rules Examination Administrator', 'cert-rules-admin@example.test', 'exam_admin', true),
  ('31110100-0000-0000-0000-000000000003', 'Certification Rules Candidate', 'cert-rules-candidate@example.test', 'candidate', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function pg_temp.set_cert_rules_actor(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_actor::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select pg_temp.set_cert_rules_actor('31110100-0000-0000-0000-000000000001');
set local role authenticated;

DO $$
declare
  v_snapshot jsonb;
  v_programme_id uuid;
  v_examination_id uuid;
  v_scope jsonb;
  v_price jsonb;
begin
  select programme.id into v_programme_id
  from public.programmes programme
  order by programme.created_at
  limit 1;

  select examination.id into v_examination_id
  from public.examinations examination
  order by examination.created_at
  limit 1;

  if v_programme_id is null or v_examination_id is null then
    raise exception 'A programme and examination are required for certification-scope validation.';
  end if;

  v_price := public.finance_upsert_certificate_product_price_rule(
    'achievement',
    'NGN',
    0,
    0,
    'included',
    array['NG'],
    now() - interval '1 minute',
    now() + interval '30 days',
    true,
    'Validate included Certificate of Achievement pricing'
  );

  if v_price ->> 'pricingMode' <> 'included'
     or (v_price ->> 'earlyAmountMinor')::bigint <> 0
     or v_price -> 'countryCodes' <> '["NG"]'::jsonb then
    raise exception 'Included certification pricing was not saved correctly: %', v_price;
  end if;

  perform public.finance_upsert_certificate_product_price_rule(
    'professional',
    'USD',
    0,
    0,
    'free',
    '{}'::text[],
    now() - interval '1 minute',
    null,
    true,
    'Validate free Professional Certificate pricing'
  );

  v_scope := public.finance_upsert_certificate_product_scope(
    null,
    'achievement',
    'programme',
    v_programme_id,
    null,
    true,
    'Validate programme-specific certification applicability'
  );

  if v_scope ->> 'scopeType' <> 'programme'
     or (v_scope ->> 'programmeId')::uuid <> v_programme_id then
    raise exception 'Programme certification scope was not saved correctly: %', v_scope;
  end if;

  perform public.finance_upsert_certificate_product_scope(
    null,
    'professional',
    'examination',
    null,
    v_examination_id,
    true,
    'Validate examination-specific certification applicability'
  );

  v_snapshot := public.get_finance_certification_snapshot(100);
  if jsonb_array_length(v_snapshot -> 'products') <> 2
     or jsonb_array_length(v_snapshot -> 'prices') < 4
     or jsonb_array_length(v_snapshot -> 'scopes') < 4
     or jsonb_typeof(v_snapshot -> 'orders') <> 'array'
     or jsonb_typeof(v_snapshot -> 'payments') <> 'array'
     or jsonb_typeof(v_snapshot -> 'audit') <> 'array'
     or coalesce((v_snapshot #>> '{summary,activeScopes}')::integer, 0) < 2 then
    raise exception 'The advanced certification snapshot is incomplete: %', v_snapshot;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_snapshot -> 'prices') price
    where price ->> 'productCode' = 'achievement'
      and price ->> 'currency' = 'NGN'
      and price ->> 'pricingMode' = 'included'
      and price -> 'countryCodes' = '["NG"]'::jsonb
  ) then
    raise exception 'The included NGN pricing rule was not returned by the snapshot.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_snapshot -> 'audit') audit
    where audit ->> 'action' in ('certification_pricing_rule_saved', 'certification_scope_saved')
      and audit ->> 'actorId' = '31110100-0000-0000-0000-000000000001'
  ) then
    raise exception 'Advanced certification finance audit evidence is missing.';
  end if;
end;
$$;

DO $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.create_agilecert_certificate_order(uuid,text,text)'::regprocedure)
  into v_definition;
  if position('pricingMode' in v_definition) = 0
     or position('included_with_examination' in v_definition) = 0
     or position('configured_no_charge' in v_definition) = 0 then
    raise exception 'Achievement certificate order authority does not contain the Phase 1B pricing-mode controls.';
  end if;

  select pg_get_functiondef('public.create_agilecert_professional_certificate_order(uuid,text)'::regprocedure)
  into v_definition;
  if position('pricingMode' in v_definition) = 0
     or position('agilecert_issue_identity_verified_certificate_for_order' in v_definition) = 0 then
    raise exception 'Professional Certificate order authority does not contain the Phase 1B pricing-mode controls.';
  end if;
end;
$$;

select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.certificate_prices.manage',
  false,
  'Temporary certification pricing-rule permission denial'
);

reset role;
select pg_temp.set_cert_rules_actor('31110100-0000-0000-0000-000000000002');
set local role authenticated;

DO $$
begin
  begin
    perform public.finance_upsert_certificate_product_price_rule(
      'achievement', 'NGN', 2000000, 2500000, 'separate_payment', array['NG'],
      now(), null, true, 'This denied certification pricing change must fail'
    );
    raise exception 'A denied Examination Administrator changed certification pricing.';
  exception
    when others then
      if position('does not have permission to manage certification fees' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.finance_upsert_certificate_product_scope(
      null, 'achievement', 'all', null, null, true,
      'This denied certification applicability change must fail'
    );
    raise exception 'A denied Examination Administrator changed certification applicability.';
  exception
    when others then
      if position('does not have permission to manage certification applicability' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;
select pg_temp.set_cert_rules_actor('31110100-0000-0000-0000-000000000001');
set local role authenticated;
select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.certificate_prices.manage',
  true,
  'Restore certification pricing-rule responsibility'
);

reset role;
select pg_temp.set_cert_rules_actor('31110100-0000-0000-0000-000000000003');
set local role authenticated;

DO $$
begin
  begin
    perform public.get_finance_certification_snapshot(10);
    raise exception 'A candidate accessed the certification finance snapshot.';
  exception
    when others then
      if position('does not have permission to view the finance console' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.finance_set_certificate_product_scope_active(
      (select id from public.agilecert_certificate_product_scopes limit 1),
      false,
      'Candidate applicability denial validation'
    );
    raise exception 'A candidate changed certification applicability.';
  exception
    when others then
      if position('does not have permission to manage certification applicability' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

DO $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agilecert_certificate_product_prices'
      and column_name = 'pricing_mode'
  ) then
    raise exception 'Certification pricing_mode column is missing.';
  end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename = 'agilecert_certificate_product_scopes'
      and rowsecurity = true
  ) then
    raise exception 'Protected certification applicability table is missing.';
  end if;

  if has_table_privilege('authenticated', 'public.agilecert_certificate_product_scopes', 'select') then
    raise exception 'Authenticated browser roles received direct certification-scope table access.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.finance_upsert_certificate_product_price_rule(text,text,bigint,bigint,text,text[],timestamptz,timestamptz,boolean,text)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.finance_upsert_certificate_product_scope(uuid,text,text,uuid,uuid,boolean,text)',
    'execute'
  ) then
    raise exception 'Advanced certification Finance Console RPC privileges are incomplete.';
  end if;
end;
$$;

select jsonb_build_object(
  'pricingModes', (
    select count(distinct pricing_mode)
    from public.agilecert_certificate_product_prices
  ),
  'certificationScopes', (
    select count(*) from public.agilecert_certificate_product_scopes
  ),
  'scopeRls', (
    select rowsecurity from pg_tables
    where schemaname = 'public' and tablename = 'agilecert_certificate_product_scopes'
  ),
  'advancedAuditEvents', (
    select count(*) from public.agilecert_finance_audit_events
    where entity_type in ('certificate_price', 'certificate_scope')
  ),
  'transactionRolledBack', true
) as verification;

rollback;
