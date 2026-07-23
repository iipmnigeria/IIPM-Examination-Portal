-- AgileCert Global identity verification audit
-- Run after migrations 202607230010 through 202607230012.
-- Read-only.

with checks as (
  select
    'private identity bucket exists'::text as check_name,
    case when exists (
      select 1
      from storage.buckets
      where id = 'agilecert-identity-documents'
        and public = false
        and file_size_limit = 15728640
    ) then 'PASS' else 'FAIL' end as result

  union all

  select
    'identity request table uses RLS',
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'agilecert_identity_verification_requests'
        and c.relrowsecurity
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'authenticated role has no direct identity table select',
    case when not has_table_privilege(
      'authenticated',
      'public.agilecert_identity_verification_requests',
      'SELECT'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'candidate redacted status function exists',
    case when to_regprocedure('public.get_my_agilecert_identity_request()') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'staff redacted queue function exists',
    case when to_regprocedure('public.list_agilecert_identity_review_queue(text,integer)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'trusted provider decision function exists',
    case when to_regprocedure('public.record_agilecert_identity_provider_decision(uuid,text,text,text,text,timestamptz,numeric,numeric,jsonb)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'no verified profile without verified request',
    case when not exists (
      select 1
      from public.agilecert_candidate_profiles p
      left join public.agilecert_identity_verification_requests r
        on r.candidate_id = p.user_id
       and r.status = 'verified'
       and (r.expires_at is null or r.expires_at > now())
      where p.identity_verification_status = 'verified'
        and r.id is null
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'verified identity locks correct currency',
    case when not exists (
      select 1
      from public.agilecert_identity_verification_requests r
      join public.agilecert_candidate_profiles p on p.user_id = r.candidate_id
      where r.status = 'verified'
        and (
          p.pricing_country_code is distinct from r.issuing_country_code
          or p.pricing_currency is distinct from case when r.issuing_country_code = 'NG' then 'NGN' else 'USD' end
          or p.pricing_verified_at is null
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'professional orders have verified identity',
    case when not exists (
      select 1
      from public.agilecert_certificate_orders o
      join public.agilecert_candidate_profiles p on p.user_id = o.candidate_id
      where o.product_code = 'professional'
        and o.status not in ('cancelled', 'expired')
        and p.identity_verification_status <> 'verified'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'one active identity request per candidate',
    case when not exists (
      select candidate_id
      from public.agilecert_identity_verification_requests
      where status in ('draft', 'submitted', 'processing')
      group by candidate_id
      having count(*) > 1
    ) then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

select
  status,
  verification_method,
  issuing_country_code,
  count(*) as total,
  min(created_at) as earliest,
  max(updated_at) as latest
from public.agilecert_identity_verification_requests
group by status, verification_method, issuing_country_code
order by status, verification_method, issuing_country_code;
