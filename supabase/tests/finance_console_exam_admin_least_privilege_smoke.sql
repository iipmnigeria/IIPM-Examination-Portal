\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '81320000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'finance-access-admin@example.test',
    extensions.crypt('FinanceAccessAdmin1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Access Examination Administrator"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81320000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'finance-access-candidate@example.test',
    extensions.crypt('FinanceAccessCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Access Candidate"}'::jsonb,
    now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, is_active)
values
  (
    '81320000-0000-0000-0000-000000000001',
    'Finance Access Examination Administrator',
    'finance-access-admin@example.test',
    'exam_admin',
    true
  ),
  (
    '81320000-0000-0000-0000-000000000002',
    'Finance Access Candidate',
    'finance-access-candidate@example.test',
    'candidate',
    true
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function pg_temp.set_finance_access_actor(p_actor uuid)
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

-- Verify the exact role matrix before exercising the public access snapshot.
do $$
declare
  v_enabled text[];
  v_disabled text[];
begin
  select array_agg(permission_key order by permission_key)
  into v_enabled
  from public.agilecert_finance_role_permissions
  where role = 'exam_admin'
    and is_granted
    and permission_key in (
      'finance.console.view',
      'finance.dashboard.view',
      'finance.receipts.manage',
      'finance.exports.download',
      'finance.exam_prices.manage',
      'finance.certificate_prices.manage',
      'finance.coupons.manage',
      'finance.orders.manage',
      'finance.settings.manage',
      'finance.transactions.reconcile',
      'finance.access.recover',
      'finance.adjustments.approve',
      'finance.permissions.manage'
    );

  if v_enabled is distinct from array[
    'finance.console.view',
    'finance.dashboard.view',
    'finance.exports.download',
    'finance.receipts.manage'
  ]::text[] then
    raise exception 'Unexpected enabled Examination Administrator finance permissions: %', v_enabled;
  end if;

  select array_agg(permission_key order by permission_key)
  into v_disabled
  from public.agilecert_finance_role_permissions
  where role = 'exam_admin'
    and not is_granted
    and permission_key in (
      'finance.exam_prices.manage',
      'finance.certificate_prices.manage',
      'finance.coupons.manage',
      'finance.orders.manage',
      'finance.settings.manage',
      'finance.transactions.reconcile',
      'finance.access.recover',
      'finance.adjustments.approve',
      'finance.permissions.manage'
    );

  if v_disabled is distinct from array[
    'finance.access.recover',
    'finance.adjustments.approve',
    'finance.certificate_prices.manage',
    'finance.coupons.manage',
    'finance.exam_prices.manage',
    'finance.orders.manage',
    'finance.permissions.manage',
    'finance.settings.manage',
    'finance.transactions.reconcile'
  ]::text[] then
    raise exception 'Unexpected disabled Examination Administrator finance permissions: %', v_disabled;
  end if;
end;
$$;

select pg_temp.set_finance_access_actor('81320000-0000-0000-0000-000000000001');
set local role authenticated;

do $$
declare
  v_access jsonb;
begin
  v_access := public.get_my_finance_console_access();

  if not (v_access ->> 'canViewConsole')::boolean
     or not (v_access ->> 'canViewDashboard')::boolean
     or not (v_access ->> 'canManageReceipts')::boolean
     or not (v_access ->> 'canExportTransactions')::boolean then
    raise exception 'Approved Finance Console access is incomplete: %', v_access;
  end if;

  if (v_access ->> 'canManageExamPrices')::boolean
     or (v_access ->> 'canManageCertificatePrices')::boolean
     or (v_access ->> 'canManageCoupons')::boolean
     or (v_access ->> 'canManageOrders')::boolean
     or (v_access ->> 'canManageSettings')::boolean
     or (v_access ->> 'canReconcileTransactions')::boolean
     or (v_access ->> 'canRecoverAccess')::boolean
     or (v_access ->> 'canApproveAdjustments')::boolean
     or (v_access ->> 'canManagePermissions')::boolean then
    raise exception 'Restricted Finance Console authority leaked to Examination Administrator: %', v_access;
  end if;
end;
$$;

reset role;
select pg_temp.set_finance_access_actor('81320000-0000-0000-0000-000000000002');
set local role authenticated;

do $$
declare
  v_access jsonb;
begin
  v_access := public.get_my_finance_console_access();
  if (v_access ->> 'canViewConsole')::boolean then
    raise exception 'Candidate Finance Console access must remain denied: %', v_access;
  end if;
end;
$$;

reset role;

select jsonb_build_object(
  'financeConsoleActivated', true,
  'enabledPermissions', array[
    'finance.console.view',
    'finance.dashboard.view',
    'finance.receipts.manage',
    'finance.exports.download'
  ],
  'restrictedPermissionsDenied', true,
  'candidateDenied', true
) as finance_console_exam_admin_least_privilege_smoke;

rollback;
