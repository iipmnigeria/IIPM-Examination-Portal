begin;

create table if not exists public.agilecert_reconciliation_batches (
  id uuid primary key default gen_random_uuid(),
  batch_reference text not null unique default (
    'REC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  ),
  provider text not null,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  statement_from date,
  statement_to date,
  source_file_name text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed', 'cancelled')),
  total_lines integer not null default 0 check (total_lines >= 0),
  matched_lines integer not null default 0 check (matched_lines >= 0),
  exception_lines integer not null default 0 check (exception_lines >= 0),
  created_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (statement_to is null or statement_from is null or statement_to >= statement_from)
);

create table if not exists public.agilecert_reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.agilecert_reconciliation_batches(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  provider text not null,
  external_reference text not null,
  transaction_date date,
  direction text not null default 'credit' check (direction in ('credit', 'debit')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'unmatched'
    check (status in ('matched', 'unmatched', 'duplicate', 'short_payment', 'overpayment', 'ignored', 'resolved')),
  matched_entity_type text check (matched_entity_type is null or matched_entity_type in ('exam_payment', 'certificate_payment', 'institution_payment', 'refund')),
  matched_entity_id uuid,
  expected_amount_minor bigint,
  variance_amount_minor bigint,
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, line_number)
);

create index if not exists agilecert_reconciliation_lines_reference_idx
  on public.agilecert_reconciliation_lines (provider, external_reference, status);
create index if not exists agilecert_reconciliation_lines_batch_idx
  on public.agilecert_reconciliation_lines (batch_id, status, line_number);

create trigger agilecert_reconciliation_batches_set_updated_at
  before update on public.agilecert_reconciliation_batches
  for each row execute function public.set_updated_at();

create or replace function public.agilecert_match_reconciliation_line(p_line_id uuid)
returns public.agilecert_reconciliation_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.agilecert_reconciliation_lines%rowtype;
  v_entity_type text;
  v_entity_id uuid;
  v_expected bigint;
  v_status text;
  v_duplicate boolean;
begin
  select * into v_line from public.agilecert_reconciliation_lines where id = p_line_id for update;
  if not found then raise exception 'The reconciliation line was not found.'; end if;

  select exists (
    select 1 from public.agilecert_reconciliation_lines other
    where other.id <> v_line.id
      and lower(other.provider) = lower(v_line.provider)
      and upper(other.external_reference) = upper(v_line.external_reference)
      and other.status not in ('ignored')
  ) into v_duplicate;

  if v_duplicate then
    v_status := 'duplicate';
  else
    select 'institution_payment', p.id, p.amount_minor
    into v_entity_type, v_entity_id, v_expected
    from public.agilecert_institution_payments p
    where upper(coalesce(p.external_reference, p.provider_transaction_id, p.payment_reference)) = upper(v_line.external_reference)
      and p.currency = v_line.currency
    order by p.created_at desc limit 1;

    if v_entity_id is null then
      select 'exam_payment', p.id, p.amount_minor
      into v_entity_type, v_entity_id, v_expected
      from public.exam_payments p
      where upper(p.reference) = upper(v_line.external_reference)
         or upper(coalesce(p.provider_transaction_id, '')) = upper(v_line.external_reference)
      order by p.created_at desc limit 1;
    end if;

    if v_entity_id is null then
      select 'certificate_payment', p.id, p.amount_minor
      into v_entity_type, v_entity_id, v_expected
      from public.agilecert_certificate_payments p
      where upper(p.reference) = upper(v_line.external_reference)
         or upper(coalesce(p.provider_transaction_id, '')) = upper(v_line.external_reference)
      order by p.created_at desc limit 1;
    end if;

    if v_entity_id is null then
      select 'refund', r.id, coalesce(r.approved_amount_minor, r.requested_amount_minor)
      into v_entity_type, v_entity_id, v_expected
      from public.agilecert_finance_refund_requests r
      where upper(coalesce(r.external_refund_reference, r.refund_number)) = upper(v_line.external_reference)
      order by r.created_at desc limit 1;
    end if;

    if v_entity_id is null then v_status := 'unmatched';
    elsif v_line.amount_minor = v_expected then v_status := 'matched';
    elsif v_line.amount_minor < v_expected then v_status := 'short_payment';
    else v_status := 'overpayment';
    end if;
  end if;

  update public.agilecert_reconciliation_lines set
    status = v_status,
    matched_entity_type = case when v_status = 'duplicate' then null else v_entity_type end,
    matched_entity_id = case when v_status = 'duplicate' then null else v_entity_id end,
    expected_amount_minor = case when v_status = 'duplicate' then null else v_expected end,
    variance_amount_minor = case when v_expected is null then null else v_line.amount_minor - v_expected end
  where id = v_line.id returning * into v_line;

  return v_line;
end;
$$;

create or replace function public.create_agilecert_reconciliation_batch(
  p_provider text,
  p_currency text,
  p_statement_from date,
  p_statement_to date,
  p_source_file_name text,
  p_lines jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_batch public.agilecert_reconciliation_batches%rowtype;
  v_payload jsonb;
  v_line public.agilecert_reconciliation_lines%rowtype;
  v_line_no integer := 0;
  v_matched integer;
  v_exceptions integer;
begin
  if nullif(trim(p_provider), '') is null then raise exception 'A reconciliation provider is required.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'At least one reconciliation line is required.'; end if;
  if p_currency is not null and upper(trim(p_currency)) !~ '^[A-Z]{3}$' then raise exception 'Invalid reconciliation currency.'; end if;

  insert into public.agilecert_reconciliation_batches (
    provider, currency, statement_from, statement_to, source_file_name,
    status, created_by, metadata
  ) values (
    lower(trim(p_provider)), nullif(upper(trim(coalesce(p_currency, ''))), ''),
    p_statement_from, p_statement_to, nullif(trim(coalesce(p_source_file_name, '')), ''),
    'processing', v_actor, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_batch;

  for v_payload in select value from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    if nullif(trim(coalesce(v_payload ->> 'externalReference', '')), '') is null
       or coalesce(nullif(v_payload ->> 'amountMinor', '')::bigint, 0) <= 0
       or upper(coalesce(nullif(v_payload ->> 'currency', ''), p_currency, '')) !~ '^[A-Z]{3}$' then
      raise exception 'Invalid reconciliation line %.', v_line_no;
    end if;

    insert into public.agilecert_reconciliation_lines (
      batch_id, line_number, provider, external_reference, transaction_date,
      direction, currency, amount_minor, raw_payload
    ) values (
      v_batch.id, v_line_no, lower(trim(coalesce(v_payload ->> 'provider', p_provider))),
      trim(v_payload ->> 'externalReference'), nullif(v_payload ->> 'transactionDate', '')::date,
      lower(coalesce(nullif(v_payload ->> 'direction', ''), 'credit')),
      upper(coalesce(nullif(v_payload ->> 'currency', ''), p_currency)),
      (v_payload ->> 'amountMinor')::bigint, coalesce(v_payload -> 'rawPayload', v_payload)
    ) returning * into v_line;
    perform public.agilecert_match_reconciliation_line(v_line.id);
  end loop;

  select count(*) filter (where status = 'matched'),
         count(*) filter (where status <> 'matched')
  into v_matched, v_exceptions
  from public.agilecert_reconciliation_lines where batch_id = v_batch.id;

  update public.agilecert_reconciliation_batches set
    status = 'completed', total_lines = v_line_no, matched_lines = v_matched,
    exception_lines = v_exceptions, completed_at = now(), updated_at = now()
  where id = v_batch.id returning * into v_batch;

  perform public.agilecert_record_finance_audit(v_actor, null, 'reconciliation_batch', v_batch.id::text,
    'reconciliation_batch_completed', jsonb_build_object('batchReference', v_batch.batch_reference,
      'provider', v_batch.provider, 'totalLines', v_batch.total_lines,
      'matchedLines', v_batch.matched_lines, 'exceptionLines', v_batch.exception_lines));

  return jsonb_build_object('id', v_batch.id, 'batchReference', v_batch.batch_reference,
    'status', v_batch.status, 'totalLines', v_batch.total_lines,
    'matchedLines', v_batch.matched_lines, 'exceptionLines', v_batch.exception_lines);
end;
$$;

create or replace function public.resolve_agilecert_reconciliation_line(
  p_line_id uuid,
  p_status text,
  p_matched_entity_type text default null,
  p_matched_entity_id uuid default null,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_line public.agilecert_reconciliation_lines%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_status not in ('resolved', 'ignored', 'matched') then raise exception 'Invalid reconciliation resolution.'; end if;
  if length(trim(coalesce(p_resolution_note, ''))) < 8 then raise exception 'A reconciliation resolution note is required.'; end if;
  if v_status = 'matched' and (p_matched_entity_type not in ('exam_payment', 'certificate_payment', 'institution_payment', 'refund') or p_matched_entity_id is null) then
    raise exception 'A valid matched finance entity is required.';
  end if;

  update public.agilecert_reconciliation_lines set
    status = v_status,
    matched_entity_type = case when v_status = 'matched' then p_matched_entity_type else matched_entity_type end,
    matched_entity_id = case when v_status = 'matched' then p_matched_entity_id else matched_entity_id end,
    resolution_note = trim(p_resolution_note), resolved_by = v_actor, resolved_at = now()
  where id = p_line_id returning * into v_line;
  if not found then raise exception 'The reconciliation line was not found.'; end if;

  update public.agilecert_reconciliation_batches b set
    matched_lines = (select count(*) from public.agilecert_reconciliation_lines where batch_id = b.id and status in ('matched', 'resolved', 'ignored')),
    exception_lines = (select count(*) from public.agilecert_reconciliation_lines where batch_id = b.id and status not in ('matched', 'resolved', 'ignored')),
    updated_at = now()
  where b.id = v_line.batch_id;

  perform public.agilecert_record_finance_audit(v_actor, null, 'reconciliation_line', v_line.id::text,
    'reconciliation_line_' || v_status, jsonb_build_object('externalReference', v_line.external_reference,
      'matchedEntityType', v_line.matched_entity_type, 'matchedEntityId', v_line.matched_entity_id));
  return jsonb_build_object('id', v_line.id, 'status', v_line.status,
    'matchedEntityType', v_line.matched_entity_type, 'matchedEntityId', v_line.matched_entity_id,
    'resolvedAt', v_line.resolved_at);
end;
$$;

create or replace function public.get_agilecert_finance_admin_console(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  update public.agilecert_institution_quotes set status = 'expired', updated_at = now()
  where status in ('draft', 'issued') and valid_until < current_date;
  update public.agilecert_institution_invoices set status = 'overdue', updated_at = now()
  where status = 'issued' and due_date < current_date and balance_amount_minor > 0;
  update public.agilecert_sponsorship_seat_pools set status = 'expired', updated_at = now()
  where status in ('draft', 'active', 'suspended', 'exhausted') and valid_until is not null and valid_until <= now();
  update public.agilecert_sponsorship_nominations set status = 'expired', updated_at = now()
  where status = 'nominated' and expires_at is not null and expires_at <= now();

  return jsonb_build_object(
    'generatedAt', now(),
    'actorId', v_actor,
    'settings', (select to_jsonb(s) - 'created_at' - 'updated_by' from public.agilecert_finance_settings s where singleton),
    'taxProfiles', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'code', t.code, 'name', t.name, 'ratePercent', t.rate_percent,
      'countryCode', t.country_code, 'registrationNumber', t.registration_number,
      'isDefault', t.is_default, 'isActive', t.is_active
    ) order by t.is_default desc, t.name) from public.agilecert_tax_profiles t), '[]'::jsonb),
    'summary', jsonb_build_object(
      'activeCustomers', (select count(*) from public.agilecert_institutional_customers where status = 'active'),
      'openQuotes', (select count(*) from public.agilecert_institution_quotes where status in ('draft', 'issued', 'accepted')),
      'openInvoices', (select count(*) from public.agilecert_institution_invoices where status in ('issued', 'part_paid', 'overdue')),
      'overdueInvoices', (select count(*) from public.agilecert_institution_invoices where status = 'overdue'),
      'pendingPayments', (select count(*) from public.agilecert_institution_payments where status in ('submitted', 'under_review')),
      'pendingRefunds', (select count(*) from public.agilecert_finance_refund_requests where status in ('requested', 'under_review', 'approved', 'processing')),
      'reconciliationExceptions', (select count(*) from public.agilecert_reconciliation_lines where status in ('unmatched', 'duplicate', 'short_payment', 'overpayment')),
      'invoiceBalancesByCurrency', coalesce((select jsonb_agg(jsonb_build_object(
        'currency', x.currency, 'invoicedAmountMinor', x.invoiced,
        'paidAmountMinor', x.paid, 'creditedAmountMinor', x.credited,
        'balanceAmountMinor', x.balance
      ) order by x.currency) from (
        select currency, sum(total_amount_minor)::bigint invoiced,
          sum(paid_amount_minor)::bigint paid, sum(credited_amount_minor)::bigint credited,
          sum(balance_amount_minor)::bigint balance
        from public.agilecert_institution_invoices where status <> 'void' group by currency
      ) x), '[]'::jsonb),
      'sponsorshipUtilisation', coalesce((select jsonb_agg(jsonb_build_object(
        'productType', x.product_type, 'purchasedSeats', x.purchased,
        'allocatedSeats', x.allocated, 'consumedSeats', x.consumed,
        'availableSeats', greatest(0, x.purchased - x.allocated)
      ) order by x.product_type) from (
        select product_type, sum(purchased_seats)::bigint purchased,
          sum(allocated_seats)::bigint allocated, sum(consumed_seats)::bigint consumed
        from public.agilecert_sponsorship_seat_pools group by product_type
      ) x), '[]'::jsonb),
      'ageingByCurrency', coalesce((select jsonb_agg(jsonb_build_object(
        'currency', a.currency, 'currentMinor', a.current_minor, 'days1To30Minor', a.days_1_30,
        'days31To60Minor', a.days_31_60, 'days61To90Minor', a.days_61_90,
        'daysOver90Minor', a.days_over_90
      ) order by a.currency) from (
        select currency,
          sum(case when due_date is null or due_date >= current_date then balance_amount_minor else 0 end)::bigint current_minor,
          sum(case when current_date - due_date between 1 and 30 then balance_amount_minor else 0 end)::bigint days_1_30,
          sum(case when current_date - due_date between 31 and 60 then balance_amount_minor else 0 end)::bigint days_31_60,
          sum(case when current_date - due_date between 61 and 90 then balance_amount_minor else 0 end)::bigint days_61_90,
          sum(case when current_date - due_date > 90 then balance_amount_minor else 0 end)::bigint days_over_90
        from public.agilecert_institution_invoices
        where status in ('issued', 'part_paid', 'overdue') and balance_amount_minor > 0
        group by currency
      ) a), '[]'::jsonb)
    ),
    'customers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'customerCode', c.customer_code, 'legalName', c.legal_name,
      'tradingName', c.trading_name, 'billingEmail', c.billing_email,
      'billingPhone', c.billing_phone, 'billingAddress', c.billing_address,
      'countryCode', c.country_code, 'defaultCurrency', c.default_currency,
      'creditLimitMinor', c.credit_limit_minor, 'paymentTermsDays', c.payment_terms_days,
      'institutionalDiscountPercent', c.institutional_discount_percent,
      'taxProfileId', c.tax_profile_id, 'status', c.status, 'notes', c.notes,
      'contacts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ct.id, 'profileId', ct.profile_id, 'fullName', ct.full_name,
        'email', ct.email, 'phone', ct.phone, 'contactRole', ct.contact_role,
        'portalAccess', ct.portal_access, 'isPrimary', ct.is_primary, 'isActive', ct.is_active
      ) order by ct.is_primary desc, ct.full_name) from public.agilecert_institution_contacts ct where ct.customer_id = c.id), '[]'::jsonb)
    ) order by c.legal_name) from public.agilecert_institutional_customers c), '[]'::jsonb),
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'quoteNumber', q.quote_number, 'customerId', q.customer_id,
      'customerName', c.legal_name, 'currency', q.currency, 'status', q.status,
      'purchaseOrderReference', q.purchase_order_reference, 'subtotalMinor', q.subtotal_minor,
      'discountAmountMinor', q.discount_amount_minor, 'taxAmountMinor', q.tax_amount_minor,
      'totalAmountMinor', q.total_amount_minor, 'issuedAt', q.issued_at,
      'validUntil', q.valid_until, 'notes', q.notes, 'terms', q.terms, 'createdAt', q.created_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', qi.id, 'lineNumber', qi.line_number, 'productType', qi.product_type,
        'examinationId', qi.examination_id, 'programmeId', qi.programme_id,
        'certificateProductCode', qi.certificate_product_code, 'description', qi.description,
        'quantity', qi.quantity, 'unitAmountMinor', qi.unit_amount_minor,
        'discountPercent', qi.discount_percent, 'taxRatePercent', qi.tax_rate_percent,
        'lineTotalMinor', qi.line_total_minor
      ) order by qi.line_number) from public.agilecert_institution_quote_items qi where qi.quote_id = q.id), '[]'::jsonb)
    ) order by q.created_at desc) from (select * from public.agilecert_institution_quotes order by created_at desc limit v_limit) q
      join public.agilecert_institutional_customers c on c.id = q.customer_id), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'invoiceNumber', i.invoice_number, 'customerId', i.customer_id,
      'customerName', c.legal_name, 'quoteId', i.quote_id, 'currency', i.currency,
      'purchaseOrderReference', i.purchase_order_reference, 'status', i.status,
      'subtotalMinor', i.subtotal_minor, 'discountAmountMinor', i.discount_amount_minor,
      'taxAmountMinor', i.tax_amount_minor, 'totalAmountMinor', i.total_amount_minor,
      'paidAmountMinor', i.paid_amount_minor, 'creditedAmountMinor', i.credited_amount_minor,
      'balanceAmountMinor', i.balance_amount_minor, 'issueDate', i.issue_date,
      'dueDate', i.due_date, 'accessAuthorizedAt', i.access_authorized_at,
      'accessAuthorizationReason', i.access_authorization_reason, 'createdAt', i.created_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ii.id, 'lineNumber', ii.line_number, 'productType', ii.product_type,
        'examinationId', ii.examination_id, 'programmeId', ii.programme_id,
        'certificateProductCode', ii.certificate_product_code, 'description', ii.description,
        'quantity', ii.quantity, 'unitAmountMinor', ii.unit_amount_minor,
        'lineTotalMinor', ii.line_total_minor
      ) order by ii.line_number) from public.agilecert_institution_invoice_items ii where ii.invoice_id = i.id), '[]'::jsonb),
      'paymentSchedule', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'installmentNumber', s.installment_number, 'dueDate', s.due_date,
        'amountMinor', s.amount_minor, 'paidAmountMinor', s.paid_amount_minor, 'status', s.status
      ) order by s.installment_number) from public.agilecert_invoice_payment_schedules s where s.invoice_id = i.id), '[]'::jsonb)
    ) order by i.created_at desc) from (select * from public.agilecert_institution_invoices order by created_at desc limit v_limit) i
      join public.agilecert_institutional_customers c on c.id = i.customer_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'paymentReference', p.payment_reference, 'customerId', p.customer_id,
      'customerName', c.legal_name, 'provider', p.provider, 'externalReference', p.external_reference,
      'providerTransactionId', p.provider_transaction_id, 'currency', p.currency,
      'amountMinor', p.amount_minor, 'allocatedAmountMinor', p.allocated_amount_minor,
      'status', p.status, 'paymentDate', p.payment_date, 'evidenceObjectPath', p.evidence_object_path,
      'reviewNote', p.review_note, 'createdAt', p.created_at
    ) order by p.created_at desc) from (select * from public.agilecert_institution_payments order by created_at desc limit v_limit) p
      join public.agilecert_institutional_customers c on c.id = p.customer_id), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'receiptNumber', r.receipt_number, 'paymentId', r.payment_id,
      'customerId', r.customer_id, 'currency', r.currency, 'amountMinor', r.amount_minor,
      'issuedAt', r.issued_at, 'status', r.status
    ) order by r.issued_at desc) from (select * from public.agilecert_finance_receipts order by issued_at desc limit v_limit) r), '[]'::jsonb),
    'seatPools', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'poolCode', s.pool_code, 'customerId', s.customer_id,
      'customerName', c.legal_name, 'invoiceId', s.invoice_id, 'invoiceItemId', s.invoice_item_id,
      'productType', s.product_type, 'examinationId', s.examination_id,
      'programmeId', s.programme_id, 'certificateProductCode', s.certificate_product_code,
      'purchasedSeats', s.purchased_seats, 'allocatedSeats', s.allocated_seats,
      'consumedSeats', s.consumed_seats, 'releasedSeats', s.released_seats,
      'availableSeats', greatest(0, s.purchased_seats - s.allocated_seats),
      'validFrom', s.valid_from, 'validUntil', s.valid_until, 'status', s.status
    ) order by s.created_at desc) from public.agilecert_sponsorship_seat_pools s
      join public.agilecert_institutional_customers c on c.id = s.customer_id), '[]'::jsonb),
    'nominations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id, 'nominationReference', n.nomination_reference, 'seatPoolId', n.seat_pool_id,
      'candidateId', n.candidate_id, 'candidateName', p.full_name, 'candidateEmail', p.email,
      'eligibilityId', n.eligibility_id, 'status', n.status, 'nominatedAt', n.nominated_at,
      'respondedAt', n.responded_at, 'expiresAt', n.expires_at
    ) order by n.created_at desc) from (select * from public.agilecert_sponsorship_nominations order by created_at desc limit v_limit) n
      join public.profiles p on p.id = n.candidate_id), '[]'::jsonb),
    'refunds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'refundNumber', r.refund_number, 'candidateId', r.candidate_id,
      'customerId', r.customer_id, 'sourceType', r.source_type, 'sourceId', r.source_id,
      'creditNoteId', r.credit_note_id, 'currency', r.currency,
      'requestedAmountMinor', r.requested_amount_minor, 'approvedAmountMinor', r.approved_amount_minor,
      'status', r.status, 'reason', r.reason, 'decisionReason', r.decision_reason,
      'externalRefundReference', r.external_refund_reference, 'requestedAt', r.requested_at,
      'reviewedAt', r.reviewed_at, 'processedAt', r.processed_at
    ) order by r.created_at desc) from (select * from public.agilecert_finance_refund_requests order by created_at desc limit v_limit) r), '[]'::jsonb),
    'creditNotes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'creditNoteNumber', c.credit_note_number, 'customerId', c.customer_id,
      'invoiceId', c.invoice_id, 'currency', c.currency, 'amountMinor', c.amount_minor,
      'reason', c.reason, 'status', c.status, 'issuedAt', c.issued_at, 'createdAt', c.created_at
    ) order by c.created_at desc) from (select * from public.agilecert_finance_credit_notes order by created_at desc limit v_limit) c), '[]'::jsonb),
    'reconciliationBatches', coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'batchReference', b.batch_reference, 'provider', b.provider,
      'currency', b.currency, 'statementFrom', b.statement_from, 'statementTo', b.statement_to,
      'sourceFileName', b.source_file_name, 'status', b.status, 'totalLines', b.total_lines,
      'matchedLines', b.matched_lines, 'exceptionLines', b.exception_lines,
      'completedAt', b.completed_at, 'createdAt', b.created_at,
      'lines', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'lineNumber', l.line_number, 'provider', l.provider,
        'externalReference', l.external_reference, 'transactionDate', l.transaction_date,
        'direction', l.direction, 'currency', l.currency, 'amountMinor', l.amount_minor,
        'status', l.status, 'matchedEntityType', l.matched_entity_type,
        'matchedEntityId', l.matched_entity_id, 'expectedAmountMinor', l.expected_amount_minor,
        'varianceAmountMinor', l.variance_amount_minor, 'resolutionNote', l.resolution_note
      ) order by l.line_number) from public.agilecert_reconciliation_lines l where l.batch_id = b.id), '[]'::jsonb)
    ) order by b.created_at desc) from (select * from public.agilecert_reconciliation_batches order by created_at desc limit v_limit) b), '[]'::jsonb),
    'auditEvents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'actorId', a.actor_id, 'customerId', a.customer_id,
      'entityType', a.entity_type, 'entityId', a.entity_id, 'action', a.action,
      'metadata', a.metadata, 'createdAt', a.created_at
    ) order by a.created_at desc) from (select * from public.agilecert_finance_audit_events order by created_at desc limit v_limit) a), '[]'::jsonb)
  );
end;
$$;

commit;