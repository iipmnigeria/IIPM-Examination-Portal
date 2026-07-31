\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '31110000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'cert-finance-super@example.test',
    extensions.crypt('CertFinanceSuper1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Finance Super Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31110000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'cert-finance-admin@example.test',
    extensions.crypt('CertFinanceAdmin1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Finance Examination Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31110000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'cert-finance-candidate@example.test',
    extensions.crypt('CertFinanceCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Certification Finance Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, is_active)
values
  (
    '31110000-0000-0000-0000-000000000001',
    'Certification Finance Super Administrator',
    'cert-finance-super@example.test',
    'super_admin',
    true
  ),
  (
    '31110000-0000-0000-0000-000000000002',
    'Certification Finance Examination Administrator',
    'cert-finance-admin@example.test',
    'exam_admin',
    true
  ),
  (
    '31110000-0000-0000-0000-000000000003',
    'Certification Finance Candidate',
    'cert-finance-candidate@example.test',
    'candidate',
    true
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function pg_temp.set_cert_finance_actor(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_actor::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Super Administrator authority and snapshot shape.
select pg_temp.set_cert_finance_actor('31110000-0000-0000-0000-000000000001');
set local role authenticated;

DO $$
declare
  v_access jsonb;
  v_snapshot jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if not (v_access ->> 'canViewConsole')::boolean
     or not (v_access ->> 'canManageCertificatePrices')::boolean
     or not (v_access ->> 'canManagePermissions')::boolean then
    raise exception 'Super Administrator certification-finance authority is incomplete: %', v_access;
  end if;

  v_snapshot := public.get_finance_certification_snapshot(25);
  if jsonb_typeof(v_snapshot -> 'products') <> 'array'
     or jsonb_array_length(v_snapshot -> 'products') <> 2
     or jsonb_typeof(v_snapshot -> 'prices') <> 'array'
     or jsonb_typeof(v_snapshot -> 'audit') <> 'array'
     or jsonb_typeof(v_snapshot -> 'summary') <> 'object' then
    raise exception 'Certification Finance snapshot is incomplete: %', v_snapshot;
  end if;
end;
$$;

-- Revoke certification-fee management from Examination Administrators.
select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.certificate_prices.manage',
  false,
  'Temporary certification-fee permission denial test'
);

reset role;
select pg_temp.set_cert_finance_actor('31110000-0000-0000-0000-000000000002');
set local role authenticated;

DO $$
declare
  v_access jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if not (v_access ->> 'canViewConsole')::boolean
     or (v_access ->> 'canManageCertificatePrices')::boolean then
    raise exception 'Certification-fee permission revocation was not enforced: %', v_access;
  end if;

  begin
    perform public.finance_upsert_certificate_product_price(
      'achievement', 'NGN', 2100000, 2600000, true,
      'This denied certification fee change must fail'
    );
    raise exception 'A denied Examination Administrator changed a certification fee.';
  exception
    when others then
      if position('does not have permission to manage certification fees' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.upsert_agilecert_certificate_product_price(
      'achievement', 'NGN', 2100000, 2600000, true
    );
    raise exception 'The legacy certificate pricing RPC bypassed Finance Console permission.';
  exception
    when others then
      if position('does not have permission to manage certification fees' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Restore authority and exercise price and product status controls.
reset role;
select pg_temp.set_cert_finance_actor('31110000-0000-0000-0000-000000000001');
set local role authenticated;
select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.certificate_prices.manage',
  true,
  'Restore approved certification-fee responsibility'
);

reset role;
select pg_temp.set_cert_finance_actor('31110000-0000-0000-0000-000000000002');
set local role authenticated;

DO $$
declare
  v_result jsonb;
  v_snapshot jsonb;
  v_price jsonb;
  v_price_audit jsonb;
  v_product_audit jsonb;
begin
  v_result := public.finance_upsert_certificate_product_price(
    'achievement',
    'NGN',
    2100000,
    2600000,
    true,
    'Approved Certificate of Achievement fee validation'
  );

  if (v_result ->> 'earlyAmountMinor')::bigint <> 2100000
     or (v_result ->> 'standardAmountMinor')::bigint <> 2600000
     or v_result ->> 'currency' <> 'NGN' then
    raise exception 'The certification fee was not saved correctly: %', v_result;
  end if;

  perform public.finance_set_certificate_product_price_active(
    'achievement',
    'NGN',
    false,
    'Temporary fee deactivation validation'
  );
  perform public.finance_set_certificate_product_price_active(
    'achievement',
    'NGN',
    true,
    'Restore active certification fee after validation'
  );

  perform public.finance_set_certificate_product_active(
    'professional',
    false,
    'Temporary product deactivation validation'
  );
  perform public.finance_set_certificate_product_active(
    'professional',
    true,
    'Restore Professional Certificate availability'
  );

  v_snapshot := public.get_finance_certification_snapshot(100);

  select item into v_price
  from jsonb_array_elements(v_snapshot -> 'prices') item
  where item ->> 'productCode' = 'achievement'
    and item ->> 'currency' = 'NGN'
  limit 1;

  if v_price is null
     or (v_price ->> 'earlyAmountMinor')::bigint <> 2100000
     or not (v_price ->> 'active')::boolean then
    raise exception 'The protected certification snapshot did not return the saved fee: %', v_snapshot;
  end if;

  select event into v_price_audit
  from jsonb_array_elements(v_snapshot -> 'audit') event
  where event ->> 'entityType' = 'certificate_price'
    and event ->> 'entityId' = 'achievement:NGN'
    and event ->> 'action' = 'certification_fee_saved'
    and event ->> 'actorId' = '31110000-0000-0000-0000-000000000002'
  limit 1;

  select event into v_product_audit
  from jsonb_array_elements(v_snapshot -> 'audit') event
  where event ->> 'entityType' = 'certificate_product'
    and event ->> 'entityId' = 'professional'
    and event ->> 'action' = 'certification_product_status_changed'
    and event ->> 'actorId' = '31110000-0000-0000-0000-000000000002'
  limit 1;

  if v_price_audit is null or v_product_audit is null then
    raise exception 'Immutable certification finance audit evidence is incomplete.';
  end if;
end;
$$;

-- Candidate accounts can neither view nor mutate certification finance data.
reset role;
select pg_temp.set_cert_finance_actor('31110000-0000-0000-0000-000000000003');
set local role authenticated;

DO $$
declare
  v_access jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if (v_access ->> 'canViewConsole')::boolean
     or (v_access ->> 'canManageCertificatePrices')::boolean then
    raise exception 'A candidate received certification finance authority: %', v_access;
  end if;

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
    perform public.finance_set_certificate_product_active(
      'achievement', false, 'Candidate denial validation'
    );
    raise exception 'A candidate changed certification product availability.';
  exception
    when others then
      if position('does not have permission to manage certification products' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

DO $$
begin
  if not has_function_privilege(
      'authenticated',
      'public.get_finance_certification_snapshot(integer)',
      'execute'
    )
     or not has_function_privilege(
      'authenticated',
      'public.finance_upsert_certificate_product_price(text,text,bigint,bigint,boolean,text)',
      'execute'
    )
     or not has_function_privilege(
      'authenticated',
      'public.finance_set_certificate_product_price_active(text,text,boolean,text)',
      'execute'
    )
     or not has_function_privilege(
      'authenticated',
      'public.finance_set_certificate_product_active(text,boolean,text)',
      'execute'
    ) then
    raise exception 'Certification Finance function privileges are incomplete.';
  end if;
end;
$$;

select
  (select count(*) from public.agilecert_finance_permission_definitions where is_active) as finance_permission_definitions,
  (select count(*) from public.agilecert_finance_role_permissions where role = 'exam_admin' and is_granted) as exam_admin_finance_grants,
  (select count(*) from public.agilecert_certificate_products) as certification_products,
  (select count(*) from public.agilecert_certificate_product_prices) as certification_prices,
  (select count(*) from public.agilecert_finance_audit_events where entity_type in ('certificate_price', 'certificate_product')) as certification_finance_audit_events;

rollback;
