-- AgileCert Global study-material access verification
-- Run after migrations 202607230001 through 202607230006.
-- This script is read-only.

with checks as (
  select
    'private study material bucket exists'::text as check_name,
    case when exists (
      select 1
      from storage.buckets
      where id = 'agilecert-study-materials'
        and name = 'agilecert-study-materials'
        and public = false
        and file_size_limit = 52428800
        and 'application/pdf' = any(allowed_mime_types)
    ) then 'PASS' else 'FAIL' end as result

  union all

  select
    'exam-order entitlement trigger exists',
    case when exists (
      select 1
      from pg_trigger
      where tgname = 'agilecert_grant_material_entitlement_trigger'
        and not tgisinternal
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'exam-order entitlement function exists',
    case when to_regprocedure(
      'public.grant_agilecert_material_entitlement_from_exam_order()'
    ) is not null then 'PASS' else 'FAIL' end

  union all

  select
    'all fulfilled purchases have entitlement',
    case when not exists (
      select 1
      from public.exam_orders o
      left join public.agilecert_study_material_entitlements e
        on e.candidate_id = o.candidate_id
       and e.examination_id = o.examination_id
       and e.revoked_at is null
      where o.status in ('paid', 'waived')
        and o.fulfilled_at is not null
        and e.id is null
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'no entitlement points to unsuccessful order',
    case when not exists (
      select 1
      from public.agilecert_study_material_entitlements e
      join public.exam_orders o on o.id = e.examination_order_id
      where e.revoked_at is null
        and (
          o.status not in ('paid', 'waived')
          or o.fulfilled_at is null
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'active materials are PDFs in private bucket',
    case when not exists (
      select 1
      from public.agilecert_study_materials m
      where m.active
        and (
          m.mime_type <> 'application/pdf'
          or m.storage_bucket <> 'agilecert-study-materials'
          or trim(m.storage_path) = ''
        )
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'candidate material RPC exists',
    case when to_regprocedure('public.get_my_agilecert_study_materials()') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'material audit table uses RLS',
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'agilecert_material_download_audit'
        and c.relrowsecurity
    ) then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

-- Diagnostic: successful examination purchases and material entitlements.
select
  o.reference as examination_order_reference,
  o.candidate_id,
  o.examination_id,
  o.status,
  o.fulfilled_at,
  e.id as entitlement_id,
  e.granted_at,
  e.grant_reason,
  e.revoked_at,
  count(m.id) filter (where m.active) as active_material_count
from public.exam_orders o
left join public.agilecert_study_material_entitlements e
  on e.candidate_id = o.candidate_id
 and e.examination_id = o.examination_id
left join public.agilecert_study_materials m
  on m.examination_id = o.examination_id
where o.status in ('paid', 'waived')
  and o.fulfilled_at is not null
group by
  o.reference,
  o.candidate_id,
  o.examination_id,
  o.status,
  o.fulfilled_at,
  e.id,
  e.granted_at,
  e.grant_reason,
  e.revoked_at
order by o.fulfilled_at desc;
