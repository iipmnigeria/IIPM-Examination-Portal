begin;

create table if not exists public.agilecert_finance_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_number text not null unique default public.agilecert_next_finance_number('credit_note'),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issued_at timestamptz,
  issued_by uuid references public.profiles(id),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_credit_notes_invoice_idx
  on public.agilecert_finance_credit_notes (invoice_id, status, created_at desc);

create table if not exists public.agilecert_finance_refund_requests (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null unique default public.agilecert_next_finance_number('refund'),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  candidate_id uuid references public.profiles(id) on delete restrict,
  customer_id uuid references public.agilecert_institutional_customers(id) on delete restrict,
  source_type text not null check (source_type in ('exam_order', 'certificate_order', 'institution_payment')),
  source_id uuid not null,
  credit_note_id uuid references public.agilecert_finance_credit_notes(id) on delete set null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  requested_amount_minor bigint not null check (requested_amount_minor > 0),
  approved_amount_minor bigint check (approved_amount_minor is null or approved_amount_minor > 0),
  status text not null default 'requested'
    check (status in ('requested', 'under_review', 'approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled')),
  reason text not null,
  decision_reason text,
  external_refund_reference text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approved_amount_minor is null or approved_amount_minor <= requested_amount_minor),
  check ((candidate_id is not null) <> (customer_id is not null))
);

create index if not exists agilecert_refunds_candidate_idx
  on public.agilecert_finance_refund_requests (candidate_id, status, created_at desc)
  where candidate_id is not null;
create index if not exists agilecert_refunds_customer_idx
  on public.agilecert_finance_refund_requests (customer_id, status, created_at desc)
  where customer_id is not null;
create index if not exists agilecert_refunds_source_idx
  on public.agilecert_finance_refund_requests (source_type, source_id, status);

create trigger agilecert_finance_credit_notes_set_updated_at
  before update on public.agilecert_finance_credit_notes
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_refund_requests_set_updated_at
  before update on public.agilecert_finance_refund_requests
  for each row execute function public.set_updated_at();

create or replace function public.agilecert_refresh_invoice_financial_status(p_invoice_id uuid)
returns public.agilecert_institution_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_paid bigint;
  v_credited bigint;
  v_balance bigint;
  v_status text;
  v_remaining bigint;
  v_schedule public.agilecert_invoice_payment_schedules%rowtype;
  v_applied bigint;
begin
  select coalesce(sum(a.amount_minor), 0)::bigint into v_paid
  from public.agilecert_institution_payment_allocations a
  join public.agilecert_institution_payments p on p.id = a.payment_id
  where a.invoice_id = p_invoice_id and a.status = 'active' and p.status = 'confirmed';

  select coalesce(sum(c.amount_minor), 0)::bigint into v_credited
  from public.agilecert_finance_credit_notes c
  where c.invoice_id = p_invoice_id and c.status = 'issued';

  select * into v_invoice from public.agilecert_institution_invoices where id = p_invoice_id for update;
  if not found then raise exception 'The invoice was not found.'; end if;

  v_balance := greatest(0, v_invoice.total_amount_minor - v_paid - v_credited);
  v_status := case
    when v_invoice.status in ('void', 'refunded') then v_invoice.status
    when v_balance = 0 then 'paid'
    when v_paid + v_credited > 0 then 'part_paid'
    when v_invoice.due_date is not null and v_invoice.due_date < current_date then 'overdue'
    else 'issued'
  end;

  update public.agilecert_institution_invoices set
    paid_amount_minor = v_paid, credited_amount_minor = v_credited,
    balance_amount_minor = v_balance, status = v_status,
    paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end,
    updated_at = now()
  where id = p_invoice_id returning * into v_invoice;

  v_remaining := v_paid + v_credited;
  for v_schedule in
    select * from public.agilecert_invoice_payment_schedules
    where invoice_id = p_invoice_id order by installment_number for update
  loop
    v_applied := least(v_schedule.amount_minor, greatest(0, v_remaining));
    update public.agilecert_invoice_payment_schedules set
      paid_amount_minor = v_applied,
      status = case
        when v_applied >= amount_minor then 'paid'
        when v_applied > 0 then 'part_paid'
        when due_date < current_date then 'overdue'
        else 'pending'
      end,
      updated_at = now()
    where id = v_schedule.id;
    v_remaining := greatest(0, v_remaining - v_applied);
  end loop;

  if v_invoice.status = 'paid' or v_invoice.access_authorized_at is not null then
    update public.agilecert_sponsorship_seat_pools set
      status = case
        when valid_until is not null and valid_until <= now() then 'expired'
        when allocated_seats >= purchased_seats then 'exhausted'
        else 'active'
      end,
      updated_at = now()
    where invoice_id = p_invoice_id and status in ('draft', 'suspended');
  end if;

  return v_invoice;
end;
$$;

create or replace function public.create_agilecert_credit_note(
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_issue_now boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_actor_role text;
  v_settings public.agilecert_finance_settings%rowtype;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_note public.agilecert_finance_credit_notes%rowtype;
  v_existing_credit bigint;
begin
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'A credit-note reason of at least 10 characters is required.'; end if;
  select * into v_invoice from public.agilecert_institution_invoices where id = p_invoice_id for update;
  if not found or v_invoice.status in ('void', 'refunded') then raise exception 'The active invoice was not found.'; end if;
  select coalesce(sum(amount_minor), 0)::bigint into v_existing_credit
  from public.agilecert_finance_credit_notes where invoice_id = p_invoice_id and status = 'issued';
  if p_amount_minor <= 0 or p_amount_minor > v_invoice.total_amount_minor - v_existing_credit then
    raise exception 'The credit amount exceeds the remaining invoice value.';
  end if;

  select * into v_settings from public.agilecert_finance_settings where singleton;
  select role into v_actor_role from public.profiles where id = v_actor;
  if p_amount_minor >= v_settings.refund_super_admin_threshold_minor and v_actor_role <> 'super_admin' then
    raise exception 'A Super Administrator must issue a credit note at or above the configured approval threshold.';
  end if;

  insert into public.agilecert_finance_credit_notes (
    customer_id, invoice_id, currency, amount_minor, reason, status,
    issued_at, issued_by, created_by, updated_by
  ) values (
    v_invoice.customer_id, v_invoice.id, v_invoice.currency, p_amount_minor, trim(p_reason),
    case when coalesce(p_issue_now, true) then 'issued' else 'draft' end,
    case when coalesce(p_issue_now, true) then now() else null end,
    case when coalesce(p_issue_now, true) then v_actor else null end,
    v_actor, v_actor
  ) returning * into v_note;

  if v_note.status = 'issued' then perform public.agilecert_refresh_invoice_financial_status(v_invoice.id); end if;
  perform public.agilecert_record_finance_audit(v_actor, v_invoice.customer_id, 'credit_note', v_note.id::text,
    'credit_note_' || v_note.status, jsonb_build_object('creditNoteNumber', v_note.credit_note_number,
      'invoiceNumber', v_invoice.invoice_number, 'amountMinor', v_note.amount_minor));

  return jsonb_build_object('id', v_note.id, 'creditNoteNumber', v_note.credit_note_number,
    'invoiceId', v_note.invoice_id, 'status', v_note.status, 'currency', v_note.currency,
    'amountMinor', v_note.amount_minor);
end;
$$;

create or replace function public.decide_agilecert_credit_note(
  p_credit_note_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note public.agilecert_finance_credit_notes%rowtype;
begin
  select * into v_note from public.agilecert_finance_credit_notes where id = p_credit_note_id for update;
  if not found then raise exception 'The credit note was not found.'; end if;
  if v_decision = 'issued' and v_note.status = 'draft' then
    update public.agilecert_finance_credit_notes set status = 'issued', issued_at = now(), issued_by = v_actor,
      updated_by = v_actor, updated_at = now() where id = v_note.id returning * into v_note;
  elsif v_decision = 'void' and v_note.status in ('draft', 'issued') then
    if length(trim(coalesce(p_reason, ''))) < 8 then raise exception 'A clear void reason is required.'; end if;
    update public.agilecert_finance_credit_notes set status = 'void', voided_at = now(), voided_by = v_actor,
      void_reason = trim(p_reason), updated_by = v_actor, updated_at = now()
    where id = v_note.id returning * into v_note;
  else raise exception 'The credit note cannot move to the requested status.';
  end if;
  perform public.agilecert_refresh_invoice_financial_status(v_note.invoice_id);
  perform public.agilecert_record_finance_audit(v_actor, v_note.customer_id, 'credit_note', v_note.id::text,
    'credit_note_' || v_note.status, jsonb_build_object('creditNoteNumber', v_note.credit_note_number));
  return jsonb_build_object('id', v_note.id, 'creditNoteNumber', v_note.credit_note_number,
    'status', v_note.status, 'amountMinor', v_note.amount_minor);
end;
$$;

create or replace function public.request_my_agilecert_refund(
  p_source_type text,
  p_source_id uuid,
  p_amount_minor bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid := auth.uid();
  v_source_type text := lower(trim(coalesce(p_source_type, '')));
  v_currency text;
  v_paid_amount bigint;
  v_existing bigint;
  v_refund public.agilecert_finance_refund_requests%rowtype;
begin
  if v_candidate is null or not exists (
    select 1 from public.profiles where id = v_candidate and role = 'candidate' and is_active
  ) then raise exception 'An active candidate account is required.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 15 then raise exception 'A refund reason of at least 15 characters is required.'; end if;

  if v_source_type = 'exam_order' then
    select currency, payable_amount_minor into v_currency, v_paid_amount
    from public.exam_orders where id = p_source_id and candidate_id = v_candidate and status = 'paid';
  elsif v_source_type = 'certificate_order' then
    select currency, payable_amount_minor into v_currency, v_paid_amount
    from public.agilecert_certificate_orders where id = p_source_id and candidate_id = v_candidate and status = 'paid';
  else
    raise exception 'Candidates may request refunds only for their paid examination or certificate orders.';
  end if;
  if v_currency is null then raise exception 'The paid order was not found.'; end if;

  select coalesce(sum(coalesce(approved_amount_minor, requested_amount_minor)), 0)::bigint into v_existing
  from public.agilecert_finance_refund_requests
  where source_type = v_source_type and source_id = p_source_id
    and status in ('approved', 'processing', 'paid');
  if p_amount_minor <= 0 or p_amount_minor + v_existing > v_paid_amount then
    raise exception 'The requested refund exceeds the refundable paid amount.';
  end if;

  insert into public.agilecert_finance_refund_requests (
    requester_id, candidate_id, source_type, source_id, currency,
    requested_amount_minor, status, reason
  ) values (
    v_candidate, v_candidate, v_source_type, p_source_id, v_currency,
    p_amount_minor, 'requested', trim(p_reason)
  ) returning * into v_refund;

  perform public.agilecert_record_finance_audit(v_candidate, null, 'refund_request', v_refund.id::text,
    'candidate_refund_requested', jsonb_build_object('refundNumber', v_refund.refund_number,
      'sourceType', v_source_type, 'sourceId', p_source_id, 'amountMinor', p_amount_minor));

  return jsonb_build_object('id', v_refund.id, 'refundNumber', v_refund.refund_number,
    'status', v_refund.status, 'currency', v_refund.currency,
    'requestedAmountMinor', v_refund.requested_amount_minor);
end;
$$;

create or replace function public.request_agilecert_institution_refund(
  p_payment_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_credit_note_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_payment public.agilecert_institution_payments%rowtype;
  v_existing bigint;
  v_refund public.agilecert_finance_refund_requests%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 15 then raise exception 'A refund reason of at least 15 characters is required.'; end if;
  select * into v_payment from public.agilecert_institution_payments
  where id = p_payment_id and status = 'confirmed';
  if not found then raise exception 'A confirmed institutional payment is required.'; end if;
  if p_credit_note_id is not null and not exists (
    select 1 from public.agilecert_finance_credit_notes
    where id = p_credit_note_id and customer_id = v_payment.customer_id and status = 'issued'
  ) then raise exception 'The issued customer credit note was not found.'; end if;

  select coalesce(sum(coalesce(approved_amount_minor, requested_amount_minor)), 0)::bigint into v_existing
  from public.agilecert_finance_refund_requests
  where source_type = 'institution_payment' and source_id = v_payment.id
    and status in ('approved', 'processing', 'paid');
  if p_amount_minor <= 0 or p_amount_minor + v_existing > v_payment.amount_minor then
    raise exception 'The requested refund exceeds the refundable institutional payment amount.';
  end if;

  insert into public.agilecert_finance_refund_requests (
    requester_id, customer_id, source_type, source_id, credit_note_id,
    currency, requested_amount_minor, status, reason
  ) values (
    v_actor, v_payment.customer_id, 'institution_payment', v_payment.id, p_credit_note_id,
    v_payment.currency, p_amount_minor, 'requested', trim(p_reason)
  ) returning * into v_refund;

  perform public.agilecert_record_finance_audit(v_actor, v_payment.customer_id, 'refund_request', v_refund.id::text,
    'institution_refund_requested', jsonb_build_object('refundNumber', v_refund.refund_number,
      'paymentReference', v_payment.payment_reference, 'amountMinor', p_amount_minor));

  return jsonb_build_object('id', v_refund.id, 'refundNumber', v_refund.refund_number,
    'status', v_refund.status, 'currency', v_refund.currency,
    'requestedAmountMinor', v_refund.requested_amount_minor);
end;
$$;

create or replace function public.decide_agilecert_refund_request(
  p_refund_id uuid,
  p_decision text,
  p_approved_amount_minor bigint default null,
  p_decision_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_role text;
  v_settings public.agilecert_finance_settings%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_refund public.agilecert_finance_refund_requests%rowtype;
  v_amount bigint;
begin
  if v_decision not in ('under_review', 'approved', 'rejected', 'cancelled') then raise exception 'Invalid refund decision.'; end if;
  select * into v_refund from public.agilecert_finance_refund_requests where id = p_refund_id for update;
  if not found or v_refund.status not in ('requested', 'under_review') then raise exception 'The active refund request was not found.'; end if;
  if v_decision in ('approved', 'rejected', 'cancelled') and length(trim(coalesce(p_decision_reason, ''))) < 10 then
    raise exception 'A decision reason of at least 10 characters is required.';
  end if;

  v_amount := coalesce(p_approved_amount_minor, v_refund.requested_amount_minor);
  if v_amount <= 0 or v_amount > v_refund.requested_amount_minor then raise exception 'Invalid approved refund amount.'; end if;
  select * into v_settings from public.agilecert_finance_settings where singleton;
  select role into v_role from public.profiles where id = v_actor;
  if v_decision = 'approved' and v_amount >= v_settings.refund_super_admin_threshold_minor and v_role <> 'super_admin' then
    raise exception 'A Super Administrator must approve refunds at or above the configured threshold.';
  end if;

  update public.agilecert_finance_refund_requests set
    status = v_decision,
    approved_amount_minor = case when v_decision = 'approved' then v_amount else approved_amount_minor end,
    decision_reason = nullif(trim(coalesce(p_decision_reason, '')), ''),
    reviewed_at = case when v_decision <> 'under_review' then now() else reviewed_at end,
    reviewed_by = v_actor, updated_at = now()
  where id = v_refund.id returning * into v_refund;

  perform public.agilecert_record_finance_audit(v_actor, v_refund.customer_id, 'refund_request', v_refund.id::text,
    'refund_request_' || v_decision, jsonb_build_object('refundNumber', v_refund.refund_number,
      'approvedAmountMinor', v_refund.approved_amount_minor));
  return jsonb_build_object('id', v_refund.id, 'refundNumber', v_refund.refund_number,
    'status', v_refund.status, 'approvedAmountMinor', v_refund.approved_amount_minor,
    'reviewedAt', v_refund.reviewed_at);
end;
$$;

create or replace function public.mark_agilecert_refund_processed(
  p_refund_id uuid,
  p_status text,
  p_external_refund_reference text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_super_admin();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_refund public.agilecert_finance_refund_requests%rowtype;
  v_full_amount bigint;
begin
  if v_status not in ('processing', 'paid', 'failed') then raise exception 'Invalid refund-processing status.'; end if;
  select * into v_refund from public.agilecert_finance_refund_requests where id = p_refund_id for update;
  if not found or v_refund.status not in ('approved', 'processing') then raise exception 'An approved refund is required.'; end if;
  if v_status = 'paid' and nullif(trim(coalesce(p_external_refund_reference, '')), '') is null then
    raise exception 'An external refund reference is required when payment is completed.';
  end if;

  update public.agilecert_finance_refund_requests set
    status = v_status, external_refund_reference = nullif(trim(coalesce(p_external_refund_reference, '')), ''),
    processed_at = case when v_status in ('paid', 'failed') then now() else processed_at end,
    processed_by = v_actor, decision_reason = coalesce(nullif(trim(coalesce(p_note, '')), ''), decision_reason),
    updated_at = now()
  where id = v_refund.id returning * into v_refund;

  if v_status = 'paid' then
    if v_refund.source_type = 'exam_order' then
      select payable_amount_minor into v_full_amount from public.exam_orders where id = v_refund.source_id;
      if v_refund.approved_amount_minor >= v_full_amount then
        update public.exam_orders set status = 'refunded', updated_at = now() where id = v_refund.source_id;
        update public.exam_payments set status = 'refunded', updated_at = now()
        where order_id = v_refund.source_id and status = 'success';
      end if;
    elsif v_refund.source_type = 'certificate_order' then
      select payable_amount_minor into v_full_amount from public.agilecert_certificate_orders where id = v_refund.source_id;
      if v_refund.approved_amount_minor >= v_full_amount then
        update public.agilecert_certificate_orders set status = 'refunded', updated_at = now() where id = v_refund.source_id;
        update public.agilecert_certificate_payments set status = 'refunded', updated_at = now()
        where order_id = v_refund.source_id and status = 'success';
      end if;
    elsif v_refund.source_type = 'institution_payment' then
      select amount_minor into v_full_amount from public.agilecert_institution_payments where id = v_refund.source_id;
      if v_refund.approved_amount_minor >= v_full_amount then
        update public.agilecert_institution_payments set status = 'refunded', updated_at = now() where id = v_refund.source_id;
      end if;
    end if;
  end if;

  perform public.agilecert_record_finance_audit(v_actor, v_refund.customer_id, 'refund_request', v_refund.id::text,
    'refund_processing_' || v_status, jsonb_build_object('refundNumber', v_refund.refund_number,
      'externalRefundReference', v_refund.external_refund_reference));
  return jsonb_build_object('id', v_refund.id, 'refundNumber', v_refund.refund_number,
    'status', v_refund.status, 'externalRefundReference', v_refund.external_refund_reference,
    'processedAt', v_refund.processed_at);
end;
$$;

commit;