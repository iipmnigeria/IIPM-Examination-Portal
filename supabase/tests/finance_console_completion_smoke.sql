\set ON_ERROR_STOP on

begin;

DO $$
begin
  if to_regclass('public.agilecert_exam_pricing_policies') is null then
    raise exception 'advanced examination pricing table is missing';
  end if;
  if to_regclass('public.agilecert_exam_access_grants') is null then
    raise exception 'controlled examination access grants table is missing';
  end if;
  if to_regclass('public.agilecert_coupon_targets') is null then
    raise exception 'coupon target table is missing';
  end if;
  if to_regclass('public.agilecert_finance_recovery_actions') is null then
    raise exception 'finance recovery table is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='coupons'
      and column_name='minimum_module_count'
  ) then raise exception 'coupon minimum module control is missing'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='agilecert_finance_settings'
      and column_name='supported_currencies'
  ) then raise exception 'supported currency setting is missing'; end if;

  if (select count(*) from public.agilecert_finance_permission_definitions
      where permission_key in (
        'finance.settings.manage',
        'finance.transactions.reconcile',
        'finance.access.recover',
        'finance.adjustments.approve',
        'finance.receipts.manage',
        'finance.exports.download',
        'finance.dashboard.view'
      ) and is_active) <> 7 then
    raise exception 'finance completion permissions are incomplete';
  end if;

  if not exists (select 1 from pg_trigger where tgname='agilecert_exam_order_pricing_policy' and not tgisinternal) then
    raise exception 'individual order pricing policy trigger is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='agilecert_bulk_item_policy' and not tgisinternal) then
    raise exception 'bulk item policy trigger is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='agilecert_bulk_coupon_policy' and not tgisinternal) then
    raise exception 'bulk coupon policy trigger is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='agilecert_coupon_redemption_target' and not tgisinternal) then
    raise exception 'coupon target trigger is missing';
  end if;

  if not exists (
    select 1 from pg_proc where proname='get_finance_console_completion_snapshot' and prosecdef
  ) then raise exception 'finance completion snapshot RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc where proname='finance_upsert_exam_pricing_policy' and prosecdef
  ) then raise exception 'advanced pricing RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc where proname='finance_upsert_coupon_advanced' and prosecdef
  ) then raise exception 'advanced coupon RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc where proname='finance_upsert_general_settings' and prosecdef
  ) then raise exception 'general settings RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc where proname='finance_recover_paid_exam_order' and prosecdef
  ) then raise exception 'individual recovery RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc where proname='finance_recover_paid_bulk_order' and prosecdef
  ) then raise exception 'bulk recovery RPC is missing'; end if;

  if has_table_privilege('authenticated','public.agilecert_exam_pricing_policies','select')
     or has_table_privilege('authenticated','public.agilecert_exam_access_grants','select')
     or has_table_privilege('authenticated','public.agilecert_coupon_targets','select')
     or has_table_privilege('authenticated','public.agilecert_finance_recovery_actions','select') then
    raise exception 'authenticated direct finance table access must remain revoked';
  end if;
end;
$$;

select jsonb_build_object(
  'permissionDefinitions', (
    select count(*) from public.agilecert_finance_permission_definitions
    where permission_key like 'finance.%' and is_active
  ),
  'pricingPoliciesBackfilled', (
    select count(*) from public.agilecert_exam_pricing_policies
  ),
  'newTablesWithRls', (
    select count(*) from pg_tables
    where schemaname='public'
      and tablename in (
        'agilecert_exam_pricing_policies',
        'agilecert_exam_access_grants',
        'agilecert_coupon_targets',
        'agilecert_finance_recovery_actions'
      ) and rowsecurity
  ),
  'completionAuthorityVerified', true
) as finance_console_completion_smoke;

rollback;
