begin;

-- Private storage bucket for examination-preparation PDFs. Candidates never
-- receive permanent object URLs; downloads are issued through a short-lived
-- signed URL after entitlement verification.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agilecert-study-materials',
  'agilecert-study-materials',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.grant_agilecert_material_entitlement_from_exam_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'waived')
     and new.fulfilled_at is not null
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.fulfilled_at is distinct from new.fulfilled_at
     ) then
    insert into public.agilecert_study_material_entitlements (
      candidate_id,
      examination_id,
      examination_order_id,
      granted_at,
      grant_reason,
      metadata
    )
    values (
      new.candidate_id,
      new.examination_id,
      new.id,
      coalesce(new.fulfilled_at, new.paid_at, now()),
      case when new.status = 'waived'
        then 'verified_exam_waiver'
        else 'verified_exam_payment'
      end,
      jsonb_build_object(
        'orderReference', new.reference,
        'orderStatus', new.status,
        'currency', new.currency,
        'payableAmountMinor', new.payable_amount_minor,
        'source', 'exam_order_fulfilment_trigger'
      )
    )
    on conflict (candidate_id, examination_id) do update
    set
      examination_order_id = excluded.examination_order_id,
      granted_at = least(
        public.agilecert_study_material_entitlements.granted_at,
        excluded.granted_at
      ),
      revoked_at = null,
      grant_reason = excluded.grant_reason,
      metadata = coalesce(public.agilecert_study_material_entitlements.metadata, '{}'::jsonb)
        || excluded.metadata;
  end if;

  return new;
end;
$$;

revoke all on function public.grant_agilecert_material_entitlement_from_exam_order() from public;

drop trigger if exists agilecert_grant_material_entitlement_trigger on public.exam_orders;
create trigger agilecert_grant_material_entitlement_trigger
  after insert or update of status, fulfilled_at
  on public.exam_orders
  for each row
  execute function public.grant_agilecert_material_entitlement_from_exam_order();

-- Backfill successful examination purchases made before this feature existed.
insert into public.agilecert_study_material_entitlements (
  candidate_id,
  examination_id,
  examination_order_id,
  granted_at,
  grant_reason,
  metadata
)
select
  o.candidate_id,
  o.examination_id,
  o.id,
  coalesce(o.fulfilled_at, o.paid_at, o.updated_at, o.created_at),
  case when o.status = 'waived'
    then 'verified_exam_waiver'
    else 'verified_exam_payment'
  end,
  jsonb_build_object(
    'orderReference', o.reference,
    'orderStatus', o.status,
    'currency', o.currency,
    'payableAmountMinor', o.payable_amount_minor,
    'source', 'migration_backfill'
  )
from public.exam_orders o
where o.status in ('paid', 'waived')
  and o.fulfilled_at is not null
on conflict (candidate_id, examination_id) do update
set
  examination_order_id = excluded.examination_order_id,
  granted_at = least(
    public.agilecert_study_material_entitlements.granted_at,
    excluded.granted_at
  ),
  revoked_at = null,
  grant_reason = excluded.grant_reason,
  metadata = coalesce(public.agilecert_study_material_entitlements.metadata, '{}'::jsonb)
    || excluded.metadata;

comment on function public.grant_agilecert_material_entitlement_from_exam_order() is
  'Grants private AgileCert PDF preparation-material access after verified examination payment or waiver.';

commit;
