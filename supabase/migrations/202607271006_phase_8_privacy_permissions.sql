begin;

create or replace function public.agilecert_block_finance_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Finance audit events are immutable.';
end;
$$;

drop trigger if exists agilecert_finance_audit_immutable on public.agilecert_finance_audit_events;
create trigger agilecert_finance_audit_immutable
  before update or delete on public.agilecert_finance_audit_events
  for each row execute function public.agilecert_block_finance_audit_mutation();

create or replace function public.get_my_agilecert_finance_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid := auth.uid();
begin
  if v_candidate is null or not exists (
    select 1 from public.profiles where id = v_candidate and role = 'candidate' and is_active
  ) then raise exception 'An active candidate account is required.'; end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'nominations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id,
      'nominationReference', n.nomination_reference,
      'status', n.status,
      'nominatedAt', n.nominated_at,
      'respondedAt', n.responded_at,
      'expiresAt', n.expires_at,
      'responseNote', n.response_note,
      'sponsorName', coalesce(c.trading_name, c.legal_name),
      'poolCode', pool.pool_code,
      'productType', pool.product_type,
      'examinationId', pool.examination_id,
      'examinationTitle', exam.title,
      'programmeCode', programme.code,
      'certificateProductCode', pool.certificate_product_code,
      'certificateProductTitle', product.title,
      'validFrom', pool.valid_from,
      'validUntil', pool.valid_until,
      'poolStatus', pool.status,
      'eligibilityId', n.eligibility_id
    ) order by n.created_at desc)
    from public.agilecert_sponsorship_nominations n
    join public.agilecert_sponsorship_seat_pools pool on pool.id = n.seat_pool_id
    join public.agilecert_institutional_customers c on c.id = pool.customer_id
    left join public.examinations exam on exam.id = pool.examination_id
    left join public.programmes programme on programme.id = coalesce(pool.programme_id, exam.programme_id)
    left join public.agilecert_certificate_products product on product.code = pool.certificate_product_code
    where n.candidate_id = v_candidate), '[]'::jsonb),
    'grants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'nominationId', g.nomination_id,
      'grantType', g.grant_type,
      'status', g.status,
      'grantedAt', g.granted_at,
      'expiresAt', g.expires_at,
      'sponsorName', coalesce(c.trading_name, c.legal_name),
      'examinationAssignmentId', g.examination_assignment_id,
      'certificateOrderId', g.certificate_order_id,
      'credentialId', g.credential_id
    ) order by g.granted_at desc)
    from public.agilecert_sponsorship_access_grants g
    join public.agilecert_institutional_customers c on c.id = g.customer_id
    where g.candidate_id = v_candidate), '[]'::jsonb),
    'refundRequests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'refundNumber', r.refund_number,
      'sourceType', r.source_type,
      'sourceId', r.source_id,
      'currency', r.currency,
      'requestedAmountMinor', r.requested_amount_minor,
      'approvedAmountMinor', r.approved_amount_minor,
      'status', r.status,
      'reason', r.reason,
      'decisionReason', r.decision_reason,
      'externalRefundReference', r.external_refund_reference,
      'requestedAt', r.requested_at,
      'reviewedAt', r.reviewed_at,
      'processedAt', r.processed_at
    ) order by r.created_at desc)
    from public.agilecert_finance_refund_requests r
    where r.candidate_id = v_candidate), '[]'::jsonb),
    'counts', jsonb_build_object(
      'pendingNominations', (select count(*) from public.agilecert_sponsorship_nominations where candidate_id = v_candidate and status = 'nominated'),
      'activeGrants', (select count(*) from public.agilecert_sponsorship_access_grants where candidate_id = v_candidate and status in ('active', 'consumed')),
      'openRefundRequests', (select count(*) from public.agilecert_finance_refund_requests where candidate_id = v_candidate and status in ('requested', 'under_review', 'approved', 'processing'))
    )
  );
end;
$$;

create or replace function public.get_agilecert_finance_document(
  p_document_type text,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_type text := lower(trim(coalesce(p_document_type, '')));
  v_result jsonb;
begin
  if v_type = 'quote' then
    select jsonb_build_object(
      'documentType', 'quote', 'documentId', q.id, 'documentNumber', q.quote_number,
      'status', q.status, 'currency', q.currency, 'issueDate', q.issued_at,
      'validUntil', q.valid_until, 'purchaseOrderReference', q.purchase_order_reference,
      'subtotalMinor', q.subtotal_minor, 'discountAmountMinor', q.discount_amount_minor,
      'taxAmountMinor', q.tax_amount_minor, 'totalAmountMinor', q.total_amount_minor,
      'notes', q.notes, 'terms', q.terms,
      'customer', jsonb_build_object('customerCode', c.customer_code, 'legalName', c.legal_name,
        'tradingName', c.trading_name, 'billingEmail', c.billing_email,
        'billingPhone', c.billing_phone, 'billingAddress', c.billing_address,
        'registrationNumber', c.registration_number, 'taxIdentifier', c.tax_identifier),
      'taxProfile', case when t.id is null then null else jsonb_build_object(
        'code', t.code, 'name', t.name, 'ratePercent', t.rate_percent,
        'registrationNumber', t.registration_number) end,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'lineNumber', i.line_number, 'productType', i.product_type,
        'description', i.description, 'quantity', i.quantity,
        'unitAmountMinor', i.unit_amount_minor, 'discountPercent', i.discount_percent,
        'taxRatePercent', i.tax_rate_percent, 'listAmountMinor', i.list_amount_minor,
        'discountAmountMinor', i.discount_amount_minor, 'taxAmountMinor', i.tax_amount_minor,
        'lineTotalMinor', i.line_total_minor
      ) order by i.line_number) from public.agilecert_institution_quote_items i where i.quote_id = q.id), '[]'::jsonb)
    ) into v_result
    from public.agilecert_institution_quotes q
    join public.agilecert_institutional_customers c on c.id = q.customer_id
    left join public.agilecert_tax_profiles t on t.id = q.tax_profile_id
    where q.id = p_document_id;
  elsif v_type = 'invoice' then
    select jsonb_build_object(
      'documentType', 'invoice', 'documentId', i.id, 'documentNumber', i.invoice_number,
      'status', i.status, 'currency', i.currency, 'issueDate', i.issue_date,
      'dueDate', i.due_date, 'purchaseOrderReference', i.purchase_order_reference,
      'subtotalMinor', i.subtotal_minor, 'discountAmountMinor', i.discount_amount_minor,
      'taxAmountMinor', i.tax_amount_minor, 'totalAmountMinor', i.total_amount_minor,
      'paidAmountMinor', i.paid_amount_minor, 'creditedAmountMinor', i.credited_amount_minor,
      'balanceAmountMinor', i.balance_amount_minor, 'notes', i.notes, 'terms', i.terms,
      'customer', jsonb_build_object('customerCode', c.customer_code, 'legalName', c.legal_name,
        'tradingName', c.trading_name, 'billingEmail', c.billing_email,
        'billingPhone', c.billing_phone, 'billingAddress', c.billing_address,
        'registrationNumber', c.registration_number, 'taxIdentifier', c.tax_identifier),
      'taxProfile', case when t.id is null then null else jsonb_build_object(
        'code', t.code, 'name', t.name, 'ratePercent', t.rate_percent,
        'registrationNumber', t.registration_number) end,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'lineNumber', item.line_number, 'productType', item.product_type,
        'description', item.description, 'quantity', item.quantity,
        'unitAmountMinor', item.unit_amount_minor, 'discountPercent', item.discount_percent,
        'taxRatePercent', item.tax_rate_percent, 'listAmountMinor', item.list_amount_minor,
        'discountAmountMinor', item.discount_amount_minor, 'taxAmountMinor', item.tax_amount_minor,
        'lineTotalMinor', item.line_total_minor
      ) order by item.line_number) from public.agilecert_institution_invoice_items item where item.invoice_id = i.id), '[]'::jsonb),
      'paymentSchedule', coalesce((select jsonb_agg(jsonb_build_object(
        'installmentNumber', s.installment_number, 'dueDate', s.due_date,
        'amountMinor', s.amount_minor, 'paidAmountMinor', s.paid_amount_minor,
        'status', s.status, 'notes', s.notes
      ) order by s.installment_number) from public.agilecert_invoice_payment_schedules s where s.invoice_id = i.id), '[]'::jsonb)
    ) into v_result
    from public.agilecert_institution_invoices i
    join public.agilecert_institutional_customers c on c.id = i.customer_id
    left join public.agilecert_tax_profiles t on t.id = i.tax_profile_id
    where i.id = p_document_id;
  elsif v_type = 'receipt' then
    select jsonb_build_object(
      'documentType', 'receipt', 'documentId', r.id, 'documentNumber', r.receipt_number,
      'status', r.status, 'currency', r.currency, 'amountMinor', r.amount_minor,
      'issuedAt', r.issued_at, 'paymentReference', p.payment_reference,
      'externalReference', p.external_reference, 'provider', p.provider,
      'paymentDate', p.payment_date,
      'customer', jsonb_build_object('customerCode', c.customer_code, 'legalName', c.legal_name,
        'tradingName', c.trading_name, 'billingEmail', c.billing_email,
        'billingPhone', c.billing_phone, 'billingAddress', c.billing_address),
      'allocations', coalesce((select jsonb_agg(jsonb_build_object(
        'invoiceId', a.invoice_id, 'invoiceNumber', i.invoice_number,
        'amountMinor', a.amount_minor, 'status', a.status
      ) order by i.invoice_number) from public.agilecert_institution_payment_allocations a
        join public.agilecert_institution_invoices i on i.id = a.invoice_id
        where a.payment_id = p.id), '[]'::jsonb)
    ) into v_result
    from public.agilecert_finance_receipts r
    join public.agilecert_institution_payments p on p.id = r.payment_id
    join public.agilecert_institutional_customers c on c.id = r.customer_id
    where r.id = p_document_id;
  elsif v_type = 'credit_note' then
    select jsonb_build_object(
      'documentType', 'credit_note', 'documentId', n.id, 'documentNumber', n.credit_note_number,
      'status', n.status, 'currency', n.currency, 'amountMinor', n.amount_minor,
      'reason', n.reason, 'issuedAt', n.issued_at,
      'invoiceId', n.invoice_id, 'invoiceNumber', i.invoice_number,
      'customer', jsonb_build_object('customerCode', c.customer_code, 'legalName', c.legal_name,
        'tradingName', c.trading_name, 'billingEmail', c.billing_email,
        'billingPhone', c.billing_phone, 'billingAddress', c.billing_address)
    ) into v_result
    from public.agilecert_finance_credit_notes n
    join public.agilecert_institution_invoices i on i.id = n.invoice_id
    join public.agilecert_institutional_customers c on c.id = n.customer_id
    where n.id = p_document_id;
  else
    raise exception 'Unsupported finance document type.';
  end if;

  if v_result is null then raise exception 'The finance document was not found.'; end if;
  perform public.agilecert_record_finance_audit(v_actor, null, 'finance_document', p_document_id::text,
    'finance_document_rendered', jsonb_build_object('documentType', v_type));
  return v_result;
end;
$$;

alter table public.agilecert_tax_profiles enable row level security;
alter table public.agilecert_finance_settings enable row level security;
alter table public.agilecert_institutional_customers enable row level security;
alter table public.agilecert_institution_contacts enable row level security;
alter table public.agilecert_finance_audit_events enable row level security;
alter table public.agilecert_institution_quotes enable row level security;
alter table public.agilecert_institution_quote_items enable row level security;
alter table public.agilecert_institution_invoices enable row level security;
alter table public.agilecert_institution_invoice_items enable row level security;
alter table public.agilecert_invoice_payment_schedules enable row level security;
alter table public.agilecert_sponsorship_seat_pools enable row level security;
alter table public.agilecert_sponsorship_nominations enable row level security;
alter table public.agilecert_sponsorship_access_grants enable row level security;
alter table public.agilecert_institution_payments enable row level security;
alter table public.agilecert_institution_payment_allocations enable row level security;
alter table public.agilecert_finance_receipts enable row level security;
alter table public.agilecert_finance_credit_notes enable row level security;
alter table public.agilecert_finance_refund_requests enable row level security;
alter table public.agilecert_reconciliation_batches enable row level security;
alter table public.agilecert_reconciliation_lines enable row level security;

revoke all on table public.agilecert_tax_profiles from public, anon, authenticated;
revoke all on table public.agilecert_finance_settings from public, anon, authenticated;
revoke all on table public.agilecert_institutional_customers from public, anon, authenticated;
revoke all on table public.agilecert_institution_contacts from public, anon, authenticated;
revoke all on table public.agilecert_finance_audit_events from public, anon, authenticated;
revoke all on table public.agilecert_institution_quotes from public, anon, authenticated;
revoke all on table public.agilecert_institution_quote_items from public, anon, authenticated;
revoke all on table public.agilecert_institution_invoices from public, anon, authenticated;
revoke all on table public.agilecert_institution_invoice_items from public, anon, authenticated;
revoke all on table public.agilecert_invoice_payment_schedules from public, anon, authenticated;
revoke all on table public.agilecert_sponsorship_seat_pools from public, anon, authenticated;
revoke all on table public.agilecert_sponsorship_nominations from public, anon, authenticated;
revoke all on table public.agilecert_sponsorship_access_grants from public, anon, authenticated;
revoke all on table public.agilecert_institution_payments from public, anon, authenticated;
revoke all on table public.agilecert_institution_payment_allocations from public, anon, authenticated;
revoke all on table public.agilecert_finance_receipts from public, anon, authenticated;
revoke all on table public.agilecert_finance_credit_notes from public, anon, authenticated;
revoke all on table public.agilecert_finance_refund_requests from public, anon, authenticated;
revoke all on table public.agilecert_reconciliation_batches from public, anon, authenticated;
revoke all on table public.agilecert_reconciliation_lines from public, anon, authenticated;

revoke all on function public.agilecert_require_finance_admin() from public, anon, authenticated;
revoke all on function public.agilecert_require_super_admin() from public, anon, authenticated;
revoke all on function public.agilecert_record_finance_audit(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.agilecert_next_finance_number(text) from public, anon, authenticated;
revoke all on function public.agilecert_refresh_invoice_financial_status(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_match_reconciliation_line(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_block_finance_audit_mutation() from public, anon, authenticated;

revoke all on function public.get_my_agilecert_finance_workspace() from public, anon, authenticated;
revoke all on function public.respond_my_agilecert_sponsorship_nomination(uuid, text, text) from public, anon, authenticated;
revoke all on function public.request_my_agilecert_refund(text, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.get_my_agilecert_finance_workspace() to authenticated;
grant execute on function public.respond_my_agilecert_sponsorship_nomination(uuid, text, text) to authenticated;
grant execute on function public.request_my_agilecert_refund(text, uuid, bigint, text) to authenticated;

revoke all on function public.upsert_agilecert_finance_settings(text, integer, integer, numeric, bigint, uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.upsert_agilecert_tax_profile(uuid, text, text, text, numeric, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.upsert_agilecert_institutional_customer(uuid, text, text, text, text, text, text, jsonb, text, text, bigint, integer, numeric, uuid, text, text) from public, anon, authenticated;
revoke all on function public.upsert_agilecert_institution_contact(uuid, uuid, uuid, text, text, text, text, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.create_agilecert_institution_quote(uuid, text, text, date, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.issue_agilecert_institution_quote(uuid) from public, anon, authenticated;
revoke all on function public.decide_agilecert_institution_quote(uuid, text, text) from public, anon, authenticated;
revoke all on function public.convert_agilecert_quote_to_invoice(uuid, date, date, jsonb) from public, anon, authenticated;
revoke all on function public.authorize_agilecert_invoice_sponsored_access(uuid, text) from public, anon, authenticated;
revoke all on function public.create_agilecert_sponsorship_seat_pool(uuid, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.nominate_agilecert_sponsored_candidate(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_agilecert_institution_payment(uuid, text, text, text, text, bigint, date, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.review_agilecert_institution_payment(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_agilecert_credit_note(uuid, bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.decide_agilecert_credit_note(uuid, text, text) from public, anon, authenticated;
revoke all on function public.request_agilecert_institution_refund(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.decide_agilecert_refund_request(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.mark_agilecert_refund_processed(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.create_agilecert_reconciliation_batch(text, text, date, date, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.resolve_agilecert_reconciliation_line(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.get_agilecert_finance_admin_console(integer) from public, anon, authenticated;
revoke all on function public.get_agilecert_finance_document(text, uuid) from public, anon, authenticated;

grant execute on function public.upsert_agilecert_finance_settings(text, integer, integer, numeric, bigint, uuid, boolean, boolean) to authenticated;
grant execute on function public.upsert_agilecert_tax_profile(uuid, text, text, text, numeric, text, text, boolean, boolean) to authenticated;
grant execute on function public.upsert_agilecert_institutional_customer(uuid, text, text, text, text, text, text, jsonb, text, text, bigint, integer, numeric, uuid, text, text) to authenticated;
grant execute on function public.upsert_agilecert_institution_contact(uuid, uuid, uuid, text, text, text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.create_agilecert_institution_quote(uuid, text, text, date, text, text, jsonb) to authenticated;
grant execute on function public.issue_agilecert_institution_quote(uuid) to authenticated;
grant execute on function public.decide_agilecert_institution_quote(uuid, text, text) to authenticated;
grant execute on function public.convert_agilecert_quote_to_invoice(uuid, date, date, jsonb) to authenticated;
grant execute on function public.authorize_agilecert_invoice_sponsored_access(uuid, text) to authenticated;
grant execute on function public.create_agilecert_sponsorship_seat_pool(uuid, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.nominate_agilecert_sponsored_candidate(uuid, text, uuid, timestamptz) to authenticated;
grant execute on function public.record_agilecert_institution_payment(uuid, text, text, text, text, bigint, date, text, text, text, jsonb) to authenticated;
grant execute on function public.review_agilecert_institution_payment(uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_agilecert_credit_note(uuid, bigint, text, boolean) to authenticated;
grant execute on function public.decide_agilecert_credit_note(uuid, text, text) to authenticated;
grant execute on function public.request_agilecert_institution_refund(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.decide_agilecert_refund_request(uuid, text, bigint, text) to authenticated;
grant execute on function public.mark_agilecert_refund_processed(uuid, text, text, text) to authenticated;
grant execute on function public.create_agilecert_reconciliation_batch(text, text, date, date, text, jsonb, jsonb) to authenticated;
grant execute on function public.resolve_agilecert_reconciliation_line(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.get_agilecert_finance_admin_console(integer) to authenticated;
grant execute on function public.get_agilecert_finance_document(text, uuid) to authenticated;

commit;