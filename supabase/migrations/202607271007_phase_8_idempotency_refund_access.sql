begin;

-- Keep sponsorship counts authoritative even when a nomination is retried,
-- reactivated or changed repeatedly. Existing candidate/admin functions may
-- optimistically adjust counts, but this trigger always recomputes the exact
-- pool state from the nomination ledger after each change.
create or replace function public.agilecert_sync_sponsorship_pool_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid := coalesce(new.seat_pool_id, old.seat_pool_id);
  v_allocated integer;
  v_consumed integer;
  v_released integer;
  v_invoice_status text;
  v_access_authorized_at timestamptz;
  v_current_status text;
  v_valid_until timestamptz;
  v_purchased integer;
begin
  select
    count(*) filter (where status in ('nominated', 'accepted')),
    count(*) filter (where status = 'accepted'),
    count(*) filter (where status in ('declined', 'released', 'expired', 'cancelled'))
  into v_allocated, v_consumed, v_released
  from public.agilecert_sponsorship_nominations
  where seat_pool_id = v_pool_id;

  select pool.status, pool.valid_until, pool.purchased_seats,
         invoice.status, invoice.access_authorized_at
  into v_current_status, v_valid_until, v_purchased,
       v_invoice_status, v_access_authorized_at
  from public.agilecert_sponsorship_seat_pools pool
  join public.agilecert_institution_invoices invoice on invoice.id = pool.invoice_id
  where pool.id = v_pool_id;

  if not found then
    return coalesce(new, old);
  end if;

  update public.agilecert_sponsorship_seat_pools
  set allocated_seats = least(v_purchased, coalesce(v_allocated, 0)),
      consumed_seats = least(v_purchased, coalesce(v_consumed, 0)),
      released_seats = coalesce(v_released, 0),
      status = case
        when v_current_status in ('closed', 'suspended') then v_current_status
        when v_valid_until is not null and v_valid_until <= now() then 'expired'
        when v_invoice_status = 'paid' or v_access_authorized_at is not null then
          case when coalesce(v_allocated, 0) >= v_purchased then 'exhausted' else 'active' end
        else 'draft'
      end,
      updated_at = now()
  where id = v_pool_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists agilecert_sponsorship_nomination_counts_trigger
  on public.agilecert_sponsorship_nominations;
create trigger agilecert_sponsorship_nomination_counts_trigger
  after insert or update of status, seat_pool_id or delete
  on public.agilecert_sponsorship_nominations
  for each row execute function public.agilecert_sync_sponsorship_pool_counts();

-- Recalculate all existing pools once so the migration is safe for already
-- populated environments.
do $$
declare
  v_pool record;
begin
  for v_pool in select id from public.agilecert_sponsorship_seat_pools
  loop
    update public.agilecert_sponsorship_seat_pools pool
    set allocated_seats = least(pool.purchased_seats, stats.allocated),
        consumed_seats = least(pool.purchased_seats, stats.consumed),
        released_seats = stats.released,
        status = case
          when pool.status in ('closed', 'suspended') then pool.status
          when pool.valid_until is not null and pool.valid_until <= now() then 'expired'
          when invoice.status = 'paid' or invoice.access_authorized_at is not null then
            case when stats.allocated >= pool.purchased_seats then 'exhausted' else 'active' end
          else 'draft'
        end,
        updated_at = now()
    from public.agilecert_institution_invoices invoice,
      lateral (
        select
          count(*) filter (where nomination.status in ('nominated', 'accepted'))::integer allocated,
          count(*) filter (where nomination.status = 'accepted')::integer consumed,
          count(*) filter (where nomination.status in ('declined', 'released', 'expired', 'cancelled'))::integer released
        from public.agilecert_sponsorship_nominations nomination
        where nomination.seat_pool_id = pool.id
      ) stats
    where pool.id = v_pool.id and invoice.id = pool.invoice_id;
  end loop;
end;
$$;

-- A payment reversal or completed full refund removes that payment from the
-- invoice's confirmed-payment total. Refresh every linked invoice and suspend
-- unpaid seat pools unless an explicit Super Administrator credit authority
-- remains in force.
create or replace function public.agilecert_refresh_invoices_after_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation record;
  v_invoice public.agilecert_institution_invoices%rowtype;
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'confirmed' or new.status in ('confirmed', 'reversed', 'refunded') then
    for v_allocation in
      select distinct invoice_id
      from public.agilecert_institution_payment_allocations
      where payment_id = new.id
    loop
      v_invoice := public.agilecert_refresh_invoice_financial_status(v_allocation.invoice_id);

      if v_invoice.status <> 'paid' and v_invoice.access_authorized_at is null then
        update public.agilecert_sponsorship_seat_pools
        set status = case
              when valid_until is not null and valid_until <= now() then 'expired'
              when status = 'closed' then 'closed'
              else 'suspended'
            end,
            updated_at = now()
        where invoice_id = v_invoice.id
          and status not in ('closed', 'expired');
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_institution_payment_refresh_trigger
  on public.agilecert_institution_payments;
create trigger agilecert_institution_payment_refresh_trigger
  after update of status on public.agilecert_institution_payments
  for each row execute function public.agilecert_refresh_invoices_after_payment_status_change();

-- A complete examination refund revokes only an unused checkout-created
-- assignment. It never revokes an administrator assignment, a sponsorship
-- grant, an attempted examination or another still-valid paid entitlement.
create or replace function public.agilecert_revoke_unused_exam_access_after_full_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from 'refunded' and new.status = 'refunded' then
    update public.exam_assignments assignment
    set status = 'revoked', updated_at = now()
    where assignment.examination_id = new.examination_id
      and assignment.candidate_id = new.candidate_id
      and assignment.status = 'assigned'
      and assignment.assigned_by is null
      and not exists (
        select 1 from public.attempts attempt
        where attempt.examination_id = new.examination_id
          and attempt.candidate_id = new.candidate_id
      )
      and not exists (
        select 1 from public.exam_orders other_order
        where other_order.id <> new.id
          and other_order.examination_id = new.examination_id
          and other_order.candidate_id = new.candidate_id
          and other_order.status in ('paid', 'waived')
      )
      and not exists (
        select 1
        from public.agilecert_sponsorship_access_grants grant_record
        where grant_record.examination_assignment_id = assignment.id
          and grant_record.status in ('active', 'consumed')
      );

    perform public.agilecert_record_finance_audit(
      auth.uid(), null, 'exam_order', new.id::text,
      'unused_exam_access_reviewed_after_full_refund',
      jsonb_build_object('candidateId', new.candidate_id, 'examinationId', new.examination_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_exam_order_refund_access_trigger on public.exam_orders;
create trigger agilecert_exam_order_refund_access_trigger
  after update of status on public.exam_orders
  for each row execute function public.agilecert_revoke_unused_exam_access_after_full_refund();

revoke all on function public.agilecert_sync_sponsorship_pool_counts() from public, anon, authenticated;
revoke all on function public.agilecert_refresh_invoices_after_payment_status_change() from public, anon, authenticated;
revoke all on function public.agilecert_revoke_unused_exam_access_after_full_refund() from public, anon, authenticated;

commit;