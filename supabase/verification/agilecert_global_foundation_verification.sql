-- AgileCert Global foundation verification
-- Run after migrations 202607230001 and 202607230002.
-- This script is read-only and should return PASS for each check.

with checks as (
  select
    'platform settings seeded'::text as check_name,
    case when exists (
      select 1
      from public.agilecert_platform_settings
      where singleton
        and brand_name = 'AgileCert Global'
        and checkout_trading_name = 'AgileCert Global by IIPM'
        and early_price_window_days = 7
    ) then 'PASS' else 'FAIL' end as result

  union all

  select
    'two active certificate products',
    case when (
      select count(*)
      from public.agilecert_certificate_products
      where active and code in ('achievement', 'professional')
    ) = 2 then 'PASS' else 'FAIL' end

  union all

  select
    'four active certificate prices',
    case when (
      select count(*)
      from public.agilecert_certificate_product_prices
      where active
        and (product_code, currency) in (
          ('achievement', 'NGN'),
          ('achievement', 'USD'),
          ('professional', 'NGN'),
          ('professional', 'USD')
        )
    ) = 4 then 'PASS' else 'FAIL' end

  union all

  select
    'achievement NGN pricing correct',
    case when exists (
      select 1
      from public.agilecert_certificate_product_prices
      where product_code = 'achievement'
        and currency = 'NGN'
        and standard_amount_minor = 2500000
        and early_amount_minor = 2000000
        and early_window_days = 7
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'professional NGN pricing correct',
    case when exists (
      select 1
      from public.agilecert_certificate_product_prices
      where product_code = 'professional'
        and currency = 'NGN'
        and standard_amount_minor = 7500000
        and early_amount_minor = 5000000
        and early_window_days = 7
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'achievement USD pricing correct',
    case when exists (
      select 1
      from public.agilecert_certificate_product_prices
      where product_code = 'achievement'
        and currency = 'USD'
        and standard_amount_minor = 5000
        and early_amount_minor = 3500
        and early_window_days = 7
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'professional USD pricing correct',
    case when exists (
      select 1
      from public.agilecert_certificate_product_prices
      where product_code = 'professional'
        and currency = 'USD'
        and standard_amount_minor = 7500
        and early_amount_minor = 6000
        and early_window_days = 7
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'all AgileCert tables use RLS',
    case when not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'agilecert_platform_settings',
          'agilecert_candidate_profiles',
          'agilecert_certificate_products',
          'agilecert_certificate_product_prices',
          'agilecert_certificate_eligibilities',
          'agilecert_certificate_orders',
          'agilecert_credentials',
          'agilecert_digital_badges',
          'agilecert_study_materials',
          'agilecert_study_material_entitlements',
          'agilecert_material_download_audit',
          'agilecert_automation_jobs'
        )
        and not c.relrowsecurity
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'offer RPC exists',
    case when to_regprocedure('public.get_my_agilecert_certificate_offers()') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'public verification RPC exists',
    case when to_regprocedure('public.verify_agilecert_credential(text)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'study material RPC exists',
    case when to_regprocedure('public.get_my_agilecert_study_materials()') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'profile RPC exists',
    case when to_regprocedure(
      'public.upsert_my_agilecert_profile(text,text,text,text,text,text,text,text,text,text,text[],text[],boolean,boolean,boolean,boolean,boolean)'
    ) is not null then 'PASS' else 'FAIL' end

  union all

  select
    'follow-up scheduling trigger exists',
    case when exists (
      select 1
      from pg_trigger
      where tgname = 'agilecert_schedule_certificate_followups_trigger'
        and not tgisinternal
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'stop-on-purchase trigger exists',
    case when exists (
      select 1
      from pg_trigger
      where tgname = 'agilecert_stop_certificate_followups_trigger'
        and not tgisinternal
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'open-order partial unique index exists',
    case when to_regclass('public.agilecert_one_open_or_fulfilled_order_idx') is not null
      then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

-- Diagnostic outputs
select
  p.code as product_code,
  p.title,
  pr.currency,
  pr.early_amount_minor,
  pr.standard_amount_minor,
  pr.early_window_days,
  p.requires_identity_verification,
  p.includes_digital_badge,
  p.includes_transcript,
  p.includes_public_profile
from public.agilecert_certificate_products p
join public.agilecert_certificate_product_prices pr on pr.product_code = p.code
order by p.display_order, pr.currency;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename like 'agilecert_%'
order by tablename, policyname;
