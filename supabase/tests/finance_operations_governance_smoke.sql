\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '81500000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'finance-governance-exam-admin@example.test',
    extensions.crypt('FinanceGovernanceAdmin1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Governance Examination Administrator"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81500000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'finance-governance-super-one@example.test',
    extensions.crypt('FinanceGovernanceSuper1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Governance Super One"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81500000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'finance-governance-super-two@example.test',
    extensions.crypt('FinanceGovernanceSuper2!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Governance Super Two"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81500000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'finance-governance-super-three@example.test',
    extensions.crypt('FinanceGovernanceSuper3!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Governance Super Three"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81500000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'finance-governance-candidate@example.test',
    extensions.crypt('FinanceGovernanceCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finance Governance Candidate"}'::jsonb,
    now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, is_active)
values
  ('81500000-0000-0000-0000-000000000001', 'Finance Governance Examination Administrator', 'finance-governance-exam-admin@example.test', 'exam_admin', true),
  ('81500000-0000-0000-0000-000000000002', 'Finance Governance Super One', 'finance-governance-super-one@example.test', 'super_admin', true),
  ('81500000-0000-0000-0000-000000000003', 'Finance Governance Super Two', 'finance-governance-super-two@example.test', 'super_admin', true),
  ('81500000-0000-0000-0000-000000000004', 'Finance Governance Super Three', 'finance-governance-super-three@example.test', 'super_admin', true),
  ('81500000-0000-0000-0000-000000000005', 'Finance Governance Candidate', 'finance-governance-candidate@example.test', 'candidate', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

create temporary table finance_governance_before_state as
select
  (select count(*) from public.exam_orders) as exam_orders,
  (select count(*) from public.exam_payments) as exam_payments,
  (select count(*) from public.exam_bulk_orders) as bulk_orders,
  (select count(*) from public.exam_bulk_payments) as bulk_payments,
  (select count(*) from public.coupons) as coupons,
  (select count(*) from public.coupon_redemptions) as coupon_redemptions,
  (select count(*) from public.exam_prices) as exam_prices;

create temporary table finance_governance_test_ids (
  key text primary key,
  id uuid not null
);

create or replace function pg_temp.set_finance_governance_actor(p_actor uuid)
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

-- Exact least-privilege defaults for Examination Administrators.
do $$
declare
  v_access jsonb;
begin
  perform pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000001');
  v_access := public.get_my_finance_console_access();
  if not (v_access ->> 'canViewGovernance')::boolean
     or not (v_access ->> 'canSubmitCases')::boolean then
    raise exception 'Examination Administrator governance access is incomplete: %', v_access;
  end if;
  if (v_access ->> 'canReviewCases')::boolean
     or (v_access ->> 'canManageAlerts')::boolean
     or (v_access ->> 'canScheduleReports')::boolean then
    raise exception 'Restricted governance authority leaked to Examination Administrator: %', v_access;
  end if;
end;
$$;

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000001');
set local role authenticated;
insert into finance_governance_test_ids(key, id)
select 'exam_admin_case', (public.finance_create_operation_case(
  'reconciliation',
  'Review unmatched test payment',
  'Review the provider evidence and determine the correct controlled reconciliation path.',
  'normal', null, null, 'GOV-EXAM-ADMIN-001', null, null, null,
  jsonb_build_object('test', true)
)->>'id')::uuid;
reset role;

-- A high-impact adjustment requires two independent approvals.
select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000002');
set local role authenticated;
insert into finance_governance_test_ids(key, id)
select 'adjustment_case', (public.finance_create_operation_case(
  'adjustment',
  'Approve controlled finance adjustment',
  'Validate and approve a controlled adjustment without directly changing any payment or order record.',
  'high', null, null, 'GOV-ADJUST-001', '81500000-0000-0000-0000-000000000005',
  'NGN', 2500000, jsonb_build_object('test', true)
)->>'id')::uuid;

-- Maker-checker: requester cannot approve own case.
do $$
declare
  v_case_id uuid;
begin
  select id into v_case_id from finance_governance_test_ids where key = 'adjustment_case';
  perform public.finance_decide_operation_case(
    v_case_id,
    'approve',
    'Requester must not be able to approve this case'
  );
  raise exception 'Requester self-approval was accepted.';
exception
  when others then
    if sqlerrm not ilike '%requester%' then raise; end if;
end;
$$;
reset role;

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000003');
set local role authenticated;
select public.finance_decide_operation_case(
  (select id from finance_governance_test_ids where key = 'adjustment_case'),
  'approve',
  'First independent reviewer approved the adjustment evidence.'
);
reset role;

do $$
declare
  v_case_id uuid;
  v_status text;
  v_approvals integer;
begin
  select id into v_case_id from finance_governance_test_ids where key = 'adjustment_case';
  select status into v_status
  from public.agilecert_finance_operation_cases
  where id = v_case_id;
  select count(*)::integer into v_approvals
  from public.agilecert_finance_operation_case_events
  where case_id = v_case_id and event_type = 'approved';
  if v_status <> 'in_review' or v_approvals <> 1 then
    raise exception 'First approval did not preserve two-person control: status %, approvals %', v_status, v_approvals;
  end if;
end;
$$;

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000004');
set local role authenticated;
select public.finance_decide_operation_case(
  (select id from finance_governance_test_ids where key = 'adjustment_case'),
  'approve',
  'Second independent reviewer approved the adjustment evidence.'
);
reset role;

do $$
declare
  v_case_id uuid;
  v_status text;
  v_approvals integer;
begin
  select id into v_case_id from finance_governance_test_ids where key = 'adjustment_case';
  select status into v_status
  from public.agilecert_finance_operation_cases
  where id = v_case_id;
  select count(*)::integer into v_approvals
  from public.agilecert_finance_operation_case_events
  where case_id = v_case_id and event_type = 'approved';
  if v_status <> 'approved' or v_approvals <> 2 then
    raise exception 'Dual approval did not complete correctly: status %, approvals %', v_status, v_approvals;
  end if;
end;
$$;

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000003');
set local role authenticated;
select public.finance_execute_operation_case(
  (select id from finance_governance_test_ids where key = 'adjustment_case'),
  jsonb_build_object('executionReference', 'GOV-EXEC-001', 'recordOnly', true),
  'Recorded execution after the approved action was completed through existing controlled authority.'
);
reset role;

-- The immutable case timeline cannot be rewritten or deleted.
do $$
declare
  v_case_id uuid;
  v_event_id uuid;
begin
  select id into v_case_id from finance_governance_test_ids where key = 'adjustment_case';
  select id into v_event_id
  from public.agilecert_finance_operation_case_events
  where case_id = v_case_id
  order by created_at
  limit 1;
  begin
    update public.agilecert_finance_operation_case_events
    set note = 'tampered'
    where id = v_event_id;
    raise exception 'Immutable case event update was accepted.';
  exception
    when others then
      if sqlerrm not ilike '%immutable%' then raise; end if;
  end;
  begin
    delete from public.agilecert_finance_operation_case_events where id = v_event_id;
    raise exception 'Immutable case event delete was accepted.';
  exception
    when others then
      if sqlerrm not ilike '%immutable%' then raise; end if;
  end;
end;
$$;

-- Create an overdue case and verify server-authoritative alert generation.
select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000002');
set local role authenticated;
insert into finance_governance_test_ids(key, id)
select 'overdue_case', (public.finance_create_operation_case(
  'exception',
  'Investigate overdue finance exception',
  'This test case is deliberately made overdue to verify operational alert generation.',
  'critical', null, null, 'GOV-OVERDUE-001', null, null, null,
  jsonb_build_object('test', true)
)->>'id')::uuid;
reset role;

update public.agilecert_finance_operation_cases
set due_at = now() - interval '1 hour'
where id = (select id from finance_governance_test_ids where key = 'overdue_case');

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000002');
set local role authenticated;
select public.finance_scan_governance_alerts();
reset role;

do $$
declare
  v_case_id uuid;
begin
  select id into v_case_id from finance_governance_test_ids where key = 'overdue_case';
  if not exists (
    select 1 from public.agilecert_finance_alerts
    where entity_type = 'finance_operation_case'
      and entity_id = v_case_id::text
      and status = 'open'
  ) then
    raise exception 'Overdue finance case alert was not generated.';
  end if;
end;
$$;

-- Schedule and process a management report through the existing outbox.
select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000002');
set local role authenticated;
insert into finance_governance_test_ids(key, id)
select 'report_schedule', (public.finance_upsert_report_schedule(
  null,
  'Weekly Finance Governance Test',
  'governance_cases',
  'weekly',
  1,
  null,
  '08:00'::time,
  'Africa/Lagos',
  array['81500000-0000-0000-0000-000000000003'::uuid],
  'Weekly Finance Governance Test Report',
  true,
  'Approved test schedule for governance validation'
)->>'id')::uuid;
reset role;

update public.agilecert_finance_report_schedules
set next_run_at = now() - interval '1 minute'
where id = (select id from finance_governance_test_ids where key = 'report_schedule');

select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000002');
set local role authenticated;
select public.finance_process_due_report_schedules(5);
reset role;

do $$
declare
  v_schedule_id uuid;
  v_schedule public.agilecert_finance_report_schedules%rowtype;
begin
  select id into v_schedule_id from finance_governance_test_ids where key = 'report_schedule';
  select * into v_schedule
  from public.agilecert_finance_report_schedules
  where id = v_schedule_id;
  if v_schedule.last_run_at is null or v_schedule.next_run_at <= v_schedule.last_run_at then
    raise exception 'Report schedule did not advance after processing.';
  end if;
  if not exists (
    select 1 from public.agilecert_finance_report_runs
    where schedule_id = v_schedule_id and status = 'queued'
  ) then
    raise exception 'Scheduled finance report run was not recorded.';
  end if;
  if not exists (
    select 1 from public.agilecert_communication_outbox
    where message_type = 'admin_message'
      and event_key like 'finance-report:' || v_schedule_id::text || ':%'
      and recipient_email = 'finance-governance-super-two@example.test'
  ) then
    raise exception 'Scheduled finance report was not queued to the controlled outbox.';
  end if;
end;
$$;

-- Candidate access remains denied.
select pg_temp.set_finance_governance_actor('81500000-0000-0000-0000-000000000005');
set local role authenticated;
do $$
begin
  perform public.get_finance_governance_snapshot(25);
  raise exception 'Candidate Finance Governance access was accepted.';
exception
  when others then
    if sqlerrm not ilike '%permission%' then raise; end if;
end;
$$;
reset role;

-- Direct browser table access remains denied.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agilecert_finance_operation_cases',
    'agilecert_finance_operation_case_events',
    'agilecert_finance_alert_rules',
    'agilecert_finance_alerts',
    'agilecert_finance_report_schedules',
    'agilecert_finance_report_runs'
  ] loop
    if has_table_privilege('authenticated', 'public.' || v_table, 'select')
       or has_table_privilege('authenticated', 'public.' || v_table, 'insert')
       or has_table_privilege('authenticated', 'public.' || v_table, 'update')
       or has_table_privilege('authenticated', 'public.' || v_table, 'delete') then
      raise exception 'Direct authenticated privilege leaked on %', v_table;
    end if;
  end loop;
end;
$$;

-- Existing finance and commerce records remain untouched.
do $$
declare
  v_before finance_governance_before_state%rowtype;
begin
  select * into v_before from finance_governance_before_state;
  if v_before.exam_orders <> (select count(*) from public.exam_orders)
     or v_before.exam_payments <> (select count(*) from public.exam_payments)
     or v_before.bulk_orders <> (select count(*) from public.exam_bulk_orders)
     or v_before.bulk_payments <> (select count(*) from public.exam_bulk_payments)
     or v_before.coupons <> (select count(*) from public.coupons)
     or v_before.coupon_redemptions <> (select count(*) from public.coupon_redemptions)
     or v_before.exam_prices <> (select count(*) from public.exam_prices) then
    raise exception 'Finance Governance changed protected commerce record counts.';
  end if;
end;
$$;

select jsonb_build_object(
  'financeGovernanceReady', true,
  'examAdminCanViewAndSubmit', true,
  'restrictedGovernanceDeniedByDefault', true,
  'makerCheckerSelfApprovalDenied', true,
  'dualApprovalPassed', true,
  'immutableTimelinePassed', true,
  'operationalAlertPassed', true,
  'scheduledReportQueued', true,
  'candidateDenied', true,
  'protectedFinanceRecordsPreserved', true
) as finance_operations_governance_smoke;

rollback;
