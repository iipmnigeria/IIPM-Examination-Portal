begin;

create unique index if not exists agilecert_communication_events_one_conversion_idx
  on public.agilecert_communication_events(outbox_id, event_type)
  where outbox_id is not null and event_type = 'conversion';

create or replace function public.record_agilecert_communication_conversions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.agilecert_communication_events(
    outbox_id,
    candidate_id,
    provider_message_id,
    event_type,
    event_at,
    metadata
  )
  select
    box.id,
    box.candidate_id,
    box.provider_message_id,
    'conversion',
    coalesce(cert_order.paid_at, cert_order.waived_at, cert_order.fulfilled_at, cert_order.updated_at),
    jsonb_build_object(
      'conversionType', 'certificate_purchase',
      'certificateOrderId', cert_order.id,
      'productCode', cert_order.product_code,
      'messageType', box.message_type
    )
  from public.agilecert_communication_outbox box
  join public.agilecert_certificate_orders cert_order
    on box.event_key like 'certificate-offer:' || cert_order.eligibility_id || ':%'
  where box.status = 'sent'
    and box.category = 'certificate_reminder'
    and cert_order.status in ('paid', 'waived')
    and not exists (
      select 1
      from public.agilecert_communication_events existing
      where existing.outbox_id = box.id
        and existing.event_type = 'conversion'
    )
  on conflict (outbox_id, event_type)
    where outbox_id is not null and event_type = 'conversion'
  do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.record_agilecert_communication_conversions()
  from public, anon, authenticated;
grant execute on function public.record_agilecert_communication_conversions()
  to service_role;

comment on function public.record_agilecert_communication_conversions() is
  'Attributes verified certificate purchases to previously sent certificate-offer communications without changing commerce authority.';

commit;
