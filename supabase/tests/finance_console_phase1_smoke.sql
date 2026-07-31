\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '31070000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'finance-super@example.test',
    extensions.crypt('FinanceSuper1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Super Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31070000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'finance-exam-admin@example.test',
    extensions.crypt('FinanceAdmin1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Examination Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '31070000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'finance-candidate@example.test',
    extensions.crypt('FinanceCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

-- Make the test independent of trigger timing while preserving the normal
-- auth-user trigger path used by production.
insert into public.profiles (id, full_name, email, role, is_active)
values
  (
    '31070000-0000-0000-0000-000000000001',
    'Finance Super Administrator',
    'finance-super@example.test',
    'super_admin',
    true
  ),
  (
    '31070000-0000-0000-0000-000000000002',
    'Finance Examination Administrator',
    'finance-exam-admin@example.test',
    'exam_admin',
    true
  ),
  (
    '31070000-0000-0000-0000-000000000003',
    'Finance Candidate',
    'finance-candidate@example.test',
    'candidate',
    true
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

DO $$
begin
  if (
    select count(*)
    from public.profiles p
    where p.id in (
      '31070000-0000-0000-0000-000000000001',
      '31070000-0000-0000-0000-000000000002',
      '31070000-0000-0000-0000-000000000003'
    )
      and p.is_active = true
      and (
        (p.id = '31070000-0000-0000-0000-000000000001' and p.role = 'super_admin')
        or (p.id = '31070000-0000-0000-0000-000000000002' and p.role = 'exam_admin')
        or (p.id = '31070000-0000-0000-0000-000000000003' and p.role = 'candidate')
      )
  ) <> 3 then
    raise exception 'The Finance Console test identities were not provisioned correctly.';
  end if;
end;
$$;

create or replace function pg_temp.set_finance_test_actor(p_actor uuid)
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

-- Super Administrators receive all active finance permissions implicitly.
select pg_temp.set_finance_test_actor('31070000-0000-0000-0000-000000000001');
set local role authenticated;

DO $$
declare
  v_access jsonb;
  v_snapshot jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if not (v_access ->> 'canViewConsole')::boolean
     or not (v_access ->> 'canManageExamPrices')::boolean
     or not (v_access ->> 'canManagePermissions')::boolean then
    raise exception 'Super Administrator finance authority is incomplete: %', v_access;
  end if;

  v_snapshot := public.get_finance_console_snapshot(25);
  if jsonb_typeof(v_snapshot -> 'examinations') <> 'array'
     or jsonb_typeof(v_snapshot -> 'permissionMatrix') <> 'array'
     or jsonb_typeof(v_snapshot -> 'financeAudit') <> 'array' then
    raise exception 'The Finance Console snapshot is incomplete: %', v_snapshot;
  end if;
end;
$$;

-- Revoke examination-fee management from the Examination Administrator.
select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.exam_prices.manage',
  false,
  'Temporary permission-denial lifecycle test'
);

reset role;
select pg_temp.set_finance_test_actor('31070000-0000-0000-0000-000000000002');
set local role authenticated;

DO $$
declare
  v_access jsonb;
  v_exam_id uuid;
begin
  v_access := public.get_my_finance_console_access();
  if not (v_access ->> 'canViewConsole')::boolean
     or (v_access ->> 'canManageExamPrices')::boolean
     or (v_access ->> 'canManagePermissions')::boolean then
    raise exception 'Examination Administrator permissions were not enforced: %', v_access;
  end if;

  select e.id into v_exam_id
  from public.examinations e
  where e.status = 'published'
  order by e.created_at, e.id
  limit 1;

  begin
    perform public.finance_upsert_exam_price(
      v_exam_id, 'NGN', 2600000, array['NG'], true, true,
      now(), null, 'This denied change must not be accepted'
    );
    raise exception 'A denied Examination Administrator changed an examination fee.';
  exception
    when others then
      if position('does not have permission to manage examination fees' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Restore fee-management authority as Super Administrator.
reset role;
select pg_temp.set_finance_test_actor('31070000-0000-0000-0000-000000000001');
set local role authenticated;
select public.admin_set_finance_role_permission(
  'exam_admin',
  'finance.exam_prices.manage',
  true,
  'Restore approved examination-fee responsibility'
);

-- The authorised Examination Administrator may save a fee. Audit evidence is
-- read through the protected Finance Console RPC, not by granting browser-side
-- access to the immutable audit table.
reset role;
select pg_temp.set_finance_test_actor('31070000-0000-0000-0000-000000000002');
set local role authenticated;

DO $$
declare
  v_exam_id uuid;
  v_result jsonb;
  v_price_id uuid;
  v_snapshot jsonb;
  v_audit jsonb;
begin
  select e.id into v_exam_id
  from public.examinations e
  where e.status = 'published'
  order by e.created_at, e.id
  limit 1;

  if v_exam_id is null then
    raise exception 'A published examination is required for the Finance Console test.';
  end if;

  v_result := public.finance_upsert_exam_price(
    v_exam_id,
    'NGN',
    2600000,
    array['NG'],
    true,
    true,
    now(),
    null,
    'Approved Phase 1 fee lifecycle validation'
  );
  v_price_id := (v_result ->> 'id')::uuid;

  if (v_result ->> 'amountMinor')::bigint <> 2600000
     or v_result ->> 'currency' <> 'NGN' then
    raise exception 'The examination fee was not saved correctly: %', v_result;
  end if;

  v_snapshot := public.get_finance_console_snapshot(50);
  select event into v_audit
  from jsonb_array_elements(v_snapshot -> 'financeAudit') event
  where event ->> 'entityType' = 'exam_price'
    and event ->> 'entityId' = v_price_id::text
    and event ->> 'action' = 'examination_fee_saved'
    and event ->> 'actorId' = '31070000-0000-0000-0000-000000000002'
  limit 1;

  if v_audit is null then
    raise exception 'The immutable finance audit event was not returned by the protected snapshot.';
  end if;

  begin
    perform a.id from public.agilecert_finance_audit_events a limit 1;
    raise exception 'The authenticated role read the protected finance audit table directly.';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- The database-owner harness verifies that even privileged direct mutation is
-- rejected by the immutable-audit trigger.
reset role;

DO $$
declare
  v_audit_id bigint;
begin
  select a.id into v_audit_id
  from public.agilecert_finance_audit_events a
  where a.entity_type = 'exam_price'
    and a.action = 'examination_fee_saved'
    and a.actor_id = '31070000-0000-0000-0000-000000000002'
  order by a.created_at desc
  limit 1;

  if v_audit_id is null then
    raise exception 'The immutable finance audit event was not recorded.';
  end if;

  begin
    update public.agilecert_finance_audit_events
    set action = 'tampered'
    where id = v_audit_id;
    raise exception 'A finance audit event was modified.';
  exception
    when others then
      if position('immutable' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Candidate accounts have no Finance Console authority.
select pg_temp.set_finance_test_actor('31070000-0000-0000-0000-000000000003');
set local role authenticated;

DO $$
declare
  v_access jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if (v_access ->> 'canViewConsole')::boolean
     or jsonb_array_length(v_access -> 'permissions') <> 0 then
    raise exception 'A candidate received Finance Console authority: %', v_access;
  end if;

  begin
    perform public.get_finance_console_snapshot(10);
    raise exception 'A candidate accessed the Finance Console snapshot.';
  exception
    when others then
      if position('does not have permission to view the finance console' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

DO $$
begin
  if not has_function_privilege('authenticated', 'public.get_finance_console_snapshot(integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.finance_upsert_exam_price(uuid,text,bigint,text[],boolean,boolean,timestamptz,timestamptz,text)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_upsert_exam_price(uuid,text,bigint,text[],boolean,boolean,timestamptz,timestamptz)', 'execute')
     or has_table_privilege('authenticated', 'public.agilecert_finance_permission_definitions', 'select')
     or has_table_privilege('authenticated', 'public.agilecert_finance_role_permissions', 'select')
     or has_table_privilege('authenticated', 'public.agilecert_finance_audit_events', 'select') then
    raise exception 'Finance Console function or table privileges are unsafe.';
  end if;
end;
$$;

select
  (select count(*) from public.agilecert_finance_permission_definitions where is_active) as finance_permission_definitions,
  (select count(*) from public.agilecert_finance_role_permissions where role = 'exam_admin' and is_granted) as exam_admin_finance_grants,
  (select count(*) from public.agilecert_finance_audit_events where entity_type = 'exam_price' and action = 'examination_fee_saved') as fee_audit_events,
  public.agilecert_has_finance_permission('finance.console.view') as current_candidate_console_access;

rollback;
