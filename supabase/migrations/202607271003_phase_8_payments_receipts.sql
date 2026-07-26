begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agilecert-finance-evidence',
  'agilecert-finance-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.agilecert_institution_payments (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique default (
    'PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  ),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  provider text not null default 'bank_transfer'
    check (provider in ('bank_transfer', 'paystack', 'card', 'cash', 'other')),
  external_reference text,
  provider_transaction_id text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  allocated_amount_minor bigint not null default 0 check (allocated_amount_minor >= 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'confirmed', 'rejected', 'failed', 'reversed', 'refunded')),
  payer_name text,
  payer_email text,
  payment_date date not null default current_date,
  evidence_object_path text,
  review_note text,
  submitted_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  confirmed_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocated_amount_minor <= amount_minor)
);

create unique index if not exists agilecert_institution_payment_external_uidx
  on public.agilecert_institution_payments (provider, external_reference)
  where external_reference is not null;
create index if not exists agilecert_institution_payments_customer_idx
  on public.agilecert_institution_payments (customer_id, status, created_at desc);

create table if not exists public.agilecert_institution_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.agilecert_institution_payments(id) on delete restrict,
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'active' check (status in ('active', 'reversed')),
  allocated_by uuid not null references public.profiles(id),
  allocated_at timestamptz not null default now(),
  reversed_by uuid references public.profiles(id),
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create index if not exists agilecert_payment_allocations_invoice_idx
  on public.agilecert_institution_payment_allocations (invoice_id, status);

create table if not exists public.agilecert_finance_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default public.agilecert_next_finance_number('receipt'),
  payment_id uuid not null unique references public.agilecert_institution_payments(id) on delete restrict,
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.profiles(id),
  status text not null default 'issued' check (status in ('issued', 'void')),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_finance_receipts_customer_idx
  on public.agilecert_finance_receipts (customer_id, issued_at desc);

create trigger agilecert_institution_payments_set_updated_at
  before update on public.agilecert_institution_payments
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

  select * into v_invoice from public.agilecert_institution_invoices where id = p_invoice_id for update;
  if not found then raise exception 'The invoice was not found.'; end if;

  v_balance := greatest(0, v_invoice.total_amount_minor - v_paid - v_invoice.credited_amount_minor);
  v_status := case
    when v_invoice.status in ('void', 'refunded') then v_invoice.status
    when v_balance = 0 then 'paid'
    when v_paid + v_invoice.credited_amount_minor > 0 then 'part_paid'
    when v_invoice.due_date is not null and v_invoice.due_date < current_date then 'overdue'
    else 'issued'
  end;

  update public.agilecert_institution_invoices set
    paid_amount_minor = v_paid,
    balance_amount_minor = v_balance,
    status = v_status,
    paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end,
    updated_at = now()
  where id = p_invoice_id returning * into v_invoice;

  v_remaining := v_paid + v_invoice.credited_amount_minor;
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

create or replace function public.record_agilecert_institution_payment(
  p_customer_id uuid,
  p_provider text,
  p_external_reference text,
  p_provider_transaction_id text,
  p_currency text,
  p_amount_minor bigint,
  p_payment_date date,
  p_payer_name text,
  p_payer_email text,
  p_evidence_object_path text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_payment public.agilecert_institution_payments%rowtype;
  v_provider text := lower(trim(coalesce(p_provider, 'bank_transfer')));
begin
  if not exists (select 1 from public.agilecert_institutional_customers where id = p_customer_id and status in ('active', 'suspended')) then
    raise exception 'The institutional customer was not found.';
  end if;
  if v_provider not in ('bank_transfer', 'paystack', 'card', 'cash', 'other') then raise exception 'Invalid payment provider.'; end if;
  if upper(trim(p_currency)) !~ '^[A-Z]{3}$' or p_amount_minor <= 0 then raise exception 'A valid currency and payment amount are required.'; end if;
  if v_provider in ('bank_transfer', 'paystack', 'card') and nullif(trim(coalesce(p_external_reference, '')), '') is null then
    raise exception 'An external payment reference is required.';
  end if;

  insert into public.agilecert_institution_payments (
    customer_id, provider, external_reference, provider_transaction_id, currency,
    amount_minor, status, payer_name, payer_email, payment_date, evidence_object_path,
    submitted_by, metadata
  ) values (
    p_customer_id, v_provider, nullif(trim(coalesce(p_external_reference, '')), ''),
    nullif(trim(coalesce(p_provider_transaction_id, '')), ''), upper(trim(p_currency)),
    p_amount_minor, 'submitted', nullif(trim(coalesce(p_payer_name, '')), ''),
    nullif(lower(trim(coalesce(p_payer_email, ''))), ''), coalesce(p_payment_date, current_date),
    nullif(trim(coalesce(p_evidence_object_path, '')), ''), v_actor, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_payment;

  perform public.agilecert_record_finance_audit(v_actor, p_customer_id, 'institution_payment', v_payment.id::text,
    'institution_payment_recorded', jsonb_build_object('paymentReference', v_payment.payment_reference,
      'provider', v_payment.provider, 'amountMinor', v_payment.amount_minor, 'currency', v_payment.currency));

  return jsonb_build_object('id', v_payment.id, 'paymentReference', v_payment.payment_reference,
    'status', v_payment.status, 'currency', v_payment.currency, 'amountMinor', v_payment.amount_minor);
end;
$$;

create or replace function public.review_agilecert_institution_payment(
  p_payment_id uuid,
  p_decision text,
  p_review_note text,
  p_allocations jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_payment public.agilecert_institution_payments%rowtype;
  v_settings public.agilecert_finance_settings%rowtype;
  v_allocation jsonb;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_amount bigint;
  v_total_allocated bigint := 0;
  v_receipt public.agilecert_finance_receipts%rowtype;
begin
  if v_decision not in ('under_review', 'confirmed', 'rejected', 'failed', 'reversed') then raise exception 'Invalid payment decision.'; end if;
  if v_decision in ('rejected', 'failed', 'reversed') and length(trim(coalesce(p_review_note, ''))) < 8 then
    raise exception 'A clear payment review note is required.';
  end if;

  select * into v_payment from public.agilecert_institution_payments where id = p_payment_id for update;
  if not found then raise exception 'The institutional payment was not found.'; end if;
  select * into v_settings from public.agilecert_finance_settings where singleton;

  if v_decision = 'confirmed' then
    if v_payment.status not in ('submitted', 'under_review') then raise exception 'Only a submitted payment may be confirmed.'; end if;
    if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
      raise exception 'At least one invoice allocation is required to confirm this payment.';
    end if;

    delete from public.agilecert_institution_payment_allocations where payment_id = v_payment.id and status = 'active';
    for v_allocation in select value from jsonb_array_elements(p_allocations)
    loop
      select * into v_invoice from public.agilecert_institution_invoices
      where id = nullif(v_allocation ->> 'invoiceId', '')::uuid for update;
      v_amount := coalesce(nullif(v_allocation ->> 'amountMinor', '')::bigint, 0);
      if not found or v_invoice.customer_id <> v_payment.customer_id or v_invoice.currency <> v_payment.currency
         or v_invoice.status in ('void', 'refunded') or v_amount <= 0 then
        raise exception 'Invalid invoice allocation for payment %.', v_payment.payment_reference;
      end if;
      if not v_settings.allow_overpayments and v_amount > v_invoice.balance_amount_minor then
        raise exception 'The allocation exceeds invoice % outstanding balance.', v_invoice.invoice_number;
      end if;
      v_total_allocated := v_total_allocated + v_amount;
      if v_total_allocated > v_payment.amount_minor then raise exception 'Payment allocations exceed the recorded payment amount.'; end if;
      insert into public.agilecert_institution_payment_allocations (
        payment_id, invoice_id, amount_minor, status, allocated_by
      ) values (v_payment.id, v_invoice.id, v_amount, 'active', v_actor)
      on conflict (payment_id, invoice_id) do update set
        amount_minor = excluded.amount_minor, status = 'active', allocated_by = v_actor,
        allocated_at = now(), reversed_by = null, reversed_at = null, reversal_reason = null;
    end loop;

    if not v_settings.allow_partial_payments and v_total_allocated <> v_payment.amount_minor then
      raise exception 'The complete payment amount must be allocated under the current finance policy.';
    end if;

    update public.agilecert_institution_payments set
      status = 'confirmed', allocated_amount_minor = v_total_allocated,
      review_note = nullif(trim(coalesce(p_review_note, '')), ''), reviewed_by = v_actor,
      reviewed_at = now(), confirmed_at = now(), updated_at = now()
    where id = v_payment.id returning * into v_payment;

    for v_invoice in
      select i.* from public.agilecert_institution_invoices i
      join public.agilecert_institution_payment_allocations a on a.invoice_id = i.id
      where a.payment_id = v_payment.id and a.status = 'active'
    loop
      perform public.agilecert_refresh_invoice_financial_status(v_invoice.id);
    end loop;

    insert into public.agilecert_finance_receipts (
      payment_id, customer_id, currency, amount_minor, issued_by, metadata
    ) values (
      v_payment.id, v_payment.customer_id, v_payment.currency, v_total_allocated, v_actor,
      jsonb_build_object('paymentReference', v_payment.payment_reference,
        'externalReference', v_payment.external_reference)
    )
    on conflict (payment_id) do update set
      amount_minor = excluded.amount_minor, status = 'issued', voided_at = null,
      voided_by = null, void_reason = null
    returning * into v_receipt;
  elsif v_decision = 'reversed' then
    if v_payment.status <> 'confirmed' then raise exception 'Only a confirmed payment may be reversed.'; end if;
    update public.agilecert_institution_payment_allocations set
      status = 'reversed', reversed_by = v_actor, reversed_at = now(),
      reversal_reason = trim(p_review_note)
    where payment_id = v_payment.id and status = 'active';
    update public.agilecert_finance_receipts set
      status = 'void', voided_at = now(), voided_by = v_actor, void_reason = trim(p_review_note)
    where payment_id = v_payment.id and status = 'issued';
    update public.agilecert_institution_payments set
      status = 'reversed', allocated_amount_minor = 0, review_note = trim(p_review_note),
      reviewed_by = v_actor, reviewed_at = now(), updated_at = now()
    where id = v_payment.id returning * into v_payment;
    for v_invoice in
      select distinct i.* from public.agilecert_institution_invoices i
      join public.agilecert_institution_payment_allocations a on a.invoice_id = i.id
      where a.payment_id = v_payment.id
    loop
      perform public.agilecert_refresh_invoice_financial_status(v_invoice.id);
    end loop;
  else
    update public.agilecert_institution_payments set
      status = v_decision, review_note = nullif(trim(coalesce(p_review_note, '')), ''),
      reviewed_by = v_actor, reviewed_at = case when v_decision <> 'under_review' then now() else reviewed_at end,
      updated_at = now()
    where id = v_payment.id and status in ('submitted', 'under_review')
    returning * into v_payment;
    if not found then raise exception 'The payment cannot move to the requested status.'; end if;
  end if;

  perform public.agilecert_record_finance_audit(v_actor, v_payment.customer_id, 'institution_payment', v_payment.id::text,
    'institution_payment_' || v_decision, jsonb_build_object('paymentReference', v_payment.payment_reference,
      'allocatedAmountMinor', v_payment.allocated_amount_minor,
      'receiptNumber', case when v_receipt.id is null then null else v_receipt.receipt_number end));

  return jsonb_build_object('id', v_payment.id, 'paymentReference', v_payment.payment_reference,
    'status', v_payment.status, 'amountMinor', v_payment.amount_minor,
    'allocatedAmountMinor', v_payment.allocated_amount_minor,
    'receiptId', v_receipt.id, 'receiptNumber', v_receipt.receipt_number);
end;
$$;

create policy "agilecert_finance_evidence_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'agilecert-finance-evidence' and public.is_exam_admin());
create policy "agilecert_finance_evidence_admin_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'agilecert-finance-evidence' and public.is_exam_admin());
create policy "agilecert_finance_evidence_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'agilecert-finance-evidence' and public.is_exam_admin())
  with check (bucket_id = 'agilecert-finance-evidence' and public.is_exam_admin());
create policy "agilecert_finance_evidence_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'agilecert-finance-evidence' and public.current_user_role() = 'super_admin');

commit;