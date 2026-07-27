begin;

create or replace function public.agilecert_capture_certificate_communication_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'waived')
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.record_agilecert_communication_conversions();
  end if;
  return new;
end;
$$;

drop trigger if exists agilecert_certificate_order_communication_conversion
  on public.agilecert_certificate_orders;
create trigger agilecert_certificate_order_communication_conversion
  after insert or update of status on public.agilecert_certificate_orders
  for each row execute function public.agilecert_capture_certificate_communication_conversion();

revoke all on function public.agilecert_capture_certificate_communication_conversion()
  from public, anon, authenticated;

comment on trigger agilecert_certificate_order_communication_conversion
  on public.agilecert_certificate_orders is
  'Records communication conversion attribution after authoritative certificate order fulfilment.';

commit;
