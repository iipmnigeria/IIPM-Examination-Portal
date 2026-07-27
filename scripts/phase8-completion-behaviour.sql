\set ON_ERROR_STOP on

begin;

do $$
declare
  v_admin_id uuid := '00000000-0000-0000-0000-00000000a008';
  v_candidate_id uuid := '00000000-0000-0000-0000-00000000c008';
  v_programme_id uuid := extensions.gen_random_uuid();
  v_exam_id uuid := extensions.gen_random_uuid();
  v_assignment_id uuid := extensions.gen_random_uuid();
  v_session_id uuid := extensions.gen_random_uuid();
  v_attempt_id uuid := extensions.gen_random_uuid();
  v_eligibility_id uuid;
  v_tax_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_invoice_id uuid;
  v_exam_item_id uuid;
  v_cert_item_id uuid;
  v_exam_pool_id uuid;
  v_cert_pool_id uuid;
  v_exam_nomination_id uuid;
  v_cert_nomination_id uuid;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_credit_note_id uuid;
  v_refund_id uuid;
  v_exam_order_id uuid := extensions.gen_random_uuid();
  v_batch_id uuid;
  v_result jsonb;
  v_workspace jsonb;
  v_console jsonb;
  v_expected_error boolean;
  v_status text;
  v_count integer;
  v_amount bigint;
  v_credential_id uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (
      v_admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase8-admin@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 8 Super Administrator'), now(), now()
    ),
    (
      v_candidate_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase8-candidate@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 8 Candidate'), now(), now()
    );

  update public.profiles set role = 'super_admin', full_name = 'Phase 8 Super Administrator', is_active = true where id = v_admin_id;
  update public.profiles set role = 'candidate', full_name = 'Phase 8 Candidate', is_active = true where id = v_candidate_id;

  insert into public.agilecert_candidate_profiles (
    user_id, legal_name, country_code, preferred_currency, created_at, updated_at
  ) values (
    v_candidate_id, 'Phase 8 Candidate', 'NG', 'NGN', now(), now()
  ) on conflict (user_id) do update set legal_name = excluded.legal_name, country_code = excluded.country_code,
      preferred_currency = excluded.preferred_currency, updated_at = now();

  insert into public.programmes (id, code, name, description, is_active)
  values (v_programme_id, 'P8-COMPLETE', 'Original Phase 8 Completion Test',
    'Isolated finance, commerce and institutional sponsorship lifecycle validation.', true);

  insert into public.examinations (
    id, programme_id, title, instructions, duration_minutes, pass_mark,
    status, max_attempts, randomize_questions, randomize_options, allow_self_enrollment,
    requires_payment
  ) values (
    v_exam_id, v_programme_id, 'Original Phase 8 Sponsored Examination',
    'Validate paid and credit-authorised institutional sponsorship.', 60, 70,
    'published', 1, false, false, false, true
  );

  insert into public.exam_prices (
    examination_id, currency, amount_minor, country_codes, is_default, is_active, created_by
  ) values (v_exam_id, 'NGN', 1000000, array['NG'], true, true, v_admin_id)
  on conflict (examination_id, currency) do update set amount_minor = excluded.amount_minor,
    is_default = true, is_active = true, updated_at = now();

  insert into public.exam_assignments (
    id, examination_id, candidate_id, assigned_by, available_from, expires_at, status
  ) values (
    v_assignment_id, v_exam_id, v_candidate_id, v_admin_id,
    now() - interval '2 hours', now() + interval '30 days', 'assigned'
  );

  insert into public.exam_sessions (
    id, assignment_id, examination_id, candidate_id, status, started_at,
    expires_at, submitted_at, tab_away_count, suspicious_score, client_fingerprint
  ) values (
    v_session_id, v_assignment_id, v_exam_id, v_candidate_id, 'submitted',
    now() - interval '1 hour', now() + interval '1 hour', now(), 0, 0,
    jsonb_build_object('test', 'phase8-completion')
  );

  insert into public.attempts (
    id, session_id, examination_id, candidate_id, raw_score, maximum_score,
    percentage, status, suspicious_score, started_at, submitted_at, graded_at
  ) values (
    v_attempt_id, v_session_id, v_exam_id, v_candidate_id, 100, 100,
    100, 'submitted', 0, now() - interval '1 hour', now(), now()
  );

  select id into v_eligibility_id
  from public.agilecert_certificate_eligibility_records
  where attempt_id = v_attempt_id;
  if v_eligibility_id is null then raise exception 'The authoritative certificate eligibility record was not created.'; end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select id into v_tax_id from public.agilecert_tax_profiles where upper(code) = 'NO-TAX';
  v_result := public.upsert_agilecert_institutional_customer(
    null, 'Phase 8 Sponsor Limited', 'Phase 8 Sponsor', 'RC-P8-001', 'TIN-P8-001',
    'billing@phase8.example.test', '+2348000000008',
    jsonb_build_object('line1', '1 Finance Test Avenue', 'city', 'Abuja', 'country', 'Nigeria'),
    'NG', 'NGN', 10000000, 14, 0, v_tax_id, 'active',
    'Isolated sponsor used only for Phase 8 lifecycle validation.'
  );
  v_customer_id := nullif(v_result->>'id', '')::uuid;
  if v_customer_id is null then raise exception 'Institutional customer creation failed: %', v_result; end if;

  v_result := public.upsert_agilecert_institution_contact(
    null, v_customer_id, null, 'Phase 8 Billing Contact', 'accounts@phase8.example.test',
    '+2348000000009', 'billing', false, true, true
  );
  if nullif(v_result->>'id', '') is null then raise exception 'Institution contact creation failed: %', v_result; end if;

  v_result := public.create_agilecert_institution_quote(
    v_customer_id, 'NGN', 'PO-P8-001', current_date + 30,
    'Two examination seats and one achievement credential seat.',
    'Payment or approved institutional credit is required before sponsored access.',
    jsonb_build_array(
      jsonb_build_object(
        'productType', 'examination', 'examinationId', v_exam_id,
        'programmeId', v_programme_id, 'description', 'Sponsored examination access',
        'quantity', 2, 'unitAmountMinor', 1000000, 'discountPercent', 0,
        'taxRatePercent', 0
      ),
      jsonb_build_object(
        'productType', 'certificate', 'programmeId', v_programme_id,
        'certificateProductCode', 'achievement',
        'description', 'Sponsored Certificate of Achievement',
        'quantity', 1, 'unitAmountMinor', 500000, 'discountPercent', 0,
        'taxRatePercent', 0
      )
    )
  );
  v_quote_id := nullif(v_result->>'id', '')::uuid;
  if v_quote_id is null or (v_result->>'totalAmountMinor')::bigint <> 2500000 then
    raise exception 'Quotation totals are invalid: %', v_result;
  end if;

  perform public.issue_agilecert_institution_quote(v_quote_id);
  perform public.decide_agilecert_institution_quote(v_quote_id, 'accepted', 'Accepted for isolated Phase 8 lifecycle validation.');
  v_result := public.convert_agilecert_quote_to_invoice(v_quote_id, current_date, current_date + 14, null);
  v_invoice_id := nullif(v_result->>'id', '')::uuid;
  if v_invoice_id is null or v_result->>'status' <> 'issued' then raise exception 'Invoice conversion failed: %', v_result; end if;

  select id into v_exam_item_id from public.agilecert_institution_invoice_items
  where invoice_id = v_invoice_id and product_type = 'examination';
  select id into v_cert_item_id from public.agilecert_institution_invoice_items
  where invoice_id = v_invoice_id and product_type = 'certificate';

  v_result := public.create_agilecert_sponsorship_seat_pool(v_exam_item_id, now(), now() + interval '30 days', 1, 'Phase 8 examination pool');
  v_exam_pool_id := nullif(v_result->>'id', '')::uuid;
  v_result := public.create_agilecert_sponsorship_seat_pool(v_cert_item_id, now(), now() + interval '30 days', null, 'Phase 8 certificate pool');
  v_cert_pool_id := nullif(v_result->>'id', '')::uuid;

  v_expected_error := false;
  begin
    perform public.nominate_agilecert_sponsored_candidate(v_exam_pool_id, 'phase8-candidate@example.test', null, now() + interval '20 days');
  exception when others then
    if position('must be paid or explicitly authorised' in sqlerrm) > 0 then v_expected_error := true; else raise; end if;
  end;
  if not v_expected_error then raise exception 'An unpaid and unauthorised sponsorship invoice granted a nomination.'; end if;

  perform public.authorize_agilecert_invoice_sponsored_access(
    v_invoice_id,
    'Approved within the configured institutional credit limit for isolated Phase 8 validation.'
  );

  v_result := public.nominate_agilecert_sponsored_candidate(
    v_exam_pool_id, 'phase8-candidate@example.test', null, now() + interval '20 days'
  );
  v_exam_nomination_id := nullif(v_result->>'id', '')::uuid;
  v_result := public.nominate_agilecert_sponsored_candidate(
    v_cert_pool_id, 'phase8-candidate@example.test', v_eligibility_id, now() + interval '20 days'
  );
  v_cert_nomination_id := nullif(v_result->>'id', '')::uuid;

  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  v_result := public.respond_my_agilecert_sponsorship_nomination(v_exam_nomination_id, 'accepted', 'Accepted sponsored examination access.');
  if v_result->>'grantType' <> 'examination_assignment' or nullif(v_result->>'assignmentId', '') is null then
    raise exception 'Sponsored examination access was not granted: %', v_result;
  end if;
  v_result := public.respond_my_agilecert_sponsorship_nomination(v_cert_nomination_id, 'accepted', 'Accepted sponsored achievement credential.');
  v_credential_id := nullif(v_result->>'credentialId', '')::uuid;
  if v_result->>'grantType' <> 'certificate_credential' or v_credential_id is null then
    raise exception 'Sponsored certificate credential was not issued: %', v_result;
  end if;

  v_workspace := public.get_my_agilecert_finance_workspace();
  if jsonb_array_length(v_workspace->'grants') <> 2 then raise exception 'Candidate sponsorship workspace is incomplete: %', v_workspace; end if;
  if v_workspace::text ilike '%billing@phase8.example.test%'
     or v_workspace::text ilike '%TIN-P8-001%'
     or v_workspace::text ilike '%Finance Test Avenue%' then
    raise exception 'Candidate finance workspace exposed private institutional billing data.';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  v_result := public.record_agilecert_institution_payment(
    v_customer_id, 'bank_transfer', 'BANK-P8-001', 'TX-P8-001', 'NGN', 2500000,
    current_date, 'Phase 8 Sponsor Limited', 'accounts@phase8.example.test',
    'phase8/finance-evidence/bank-p8-001.pdf', jsonb_build_object('test', 'phase8-completion')
  );
  v_payment_id := nullif(v_result->>'id', '')::uuid;
  v_result := public.review_agilecert_institution_payment(
    v_payment_id, 'confirmed', 'Payment verified against the isolated bank-transfer evidence.',
    jsonb_build_array(jsonb_build_object('invoiceId', v_invoice_id, 'amountMinor', 2500000))
  );
  v_receipt_id := nullif(v_result->>'receiptId', '')::uuid;
  if v_receipt_id is null or v_result->>'status' <> 'confirmed' then raise exception 'Institutional payment confirmation failed: %', v_result; end if;
  select status, balance_amount_minor into v_status, v_amount from public.agilecert_institution_invoices where id = v_invoice_id;
  if v_status <> 'paid' or v_amount <> 0 then raise exception 'Invoice did not become paid: status %, balance %', v_status, v_amount; end if;

  v_result := public.create_agilecert_credit_note(
    v_invoice_id, 100000, 'Approved service-value adjustment for isolated Phase 8 validation.', true
  );
  v_credit_note_id := nullif(v_result->>'id', '')::uuid;
  if v_credit_note_id is null or v_result->>'status' <> 'issued' then raise exception 'Credit note issuance failed: %', v_result; end if;

  v_result := public.request_agilecert_institution_refund(
    v_payment_id, 100000, 'Refund of the issued institutional credit adjustment for validation.', v_credit_note_id
  );
  v_refund_id := nullif(v_result->>'id', '')::uuid;
  perform public.decide_agilecert_refund_request(
    v_refund_id, 'approved', 100000, 'Approved because the institutional credit note is valid and issued.'
  );
  v_result := public.mark_agilecert_refund_processed(
    v_refund_id, 'paid', 'REF-P8-INST-001', 'Institutional credit refund completed in the isolated validation.'
  );
  if v_result->>'status' <> 'paid' then raise exception 'Institutional refund processing failed: %', v_result; end if;

  insert into public.exam_orders (
    id, reference, candidate_id, examination_id, price_id, currency,
    list_amount_minor, discount_amount_minor, payable_amount_minor,
    status, gateway, expires_at, paid_at, fulfilled_at, metadata
  )
  select v_exam_order_id, 'IIPM-P8-REFUND-ORDER', v_candidate_id, v_exam_id, ep.id, 'NGN',
    1000000, 0, 1000000, 'paid', 'paystack', now() + interval '1 day', now(), now(),
    jsonb_build_object('test', 'phase8-candidate-refund')
  from public.exam_prices ep where ep.examination_id = v_exam_id and ep.currency = 'NGN';

  insert into public.exam_payments (
    order_id, provider, reference, provider_transaction_id, status,
    amount_minor, currency, paid_at, provider_payload
  ) values (
    v_exam_order_id, 'paystack', 'PAYSTACK-P8-CANDIDATE-001', 'PS-P8-001', 'success',
    1000000, 'NGN', now(), jsonb_build_object('test', 'phase8-candidate-refund')
  );

  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  v_result := public.request_my_agilecert_refund(
    'exam_order', v_exam_order_id, 500000,
    'Candidate requests a partial examination refund for isolated Phase 8 validation.'
  );
  v_refund_id := nullif(v_result->>'id', '')::uuid;
  if v_refund_id is null then raise exception 'Candidate refund request failed: %', v_result; end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform public.decide_agilecert_refund_request(
    v_refund_id, 'approved', 500000, 'Approved partial candidate refund after finance review.'
  );
  v_result := public.mark_agilecert_refund_processed(
    v_refund_id, 'paid', 'REF-P8-CANDIDATE-001', 'Candidate partial refund completed.'
  );
  if v_result->>'status' <> 'paid' then raise exception 'Candidate refund was not completed: %', v_result; end if;
  select status into v_status from public.exam_orders where id = v_exam_order_id;
  if v_status <> 'paid' then raise exception 'A partial refund incorrectly changed the paid examination order status: %', v_status; end if;

  v_result := public.create_agilecert_reconciliation_batch(
    'bank_transfer', 'NGN', current_date, current_date, 'phase8-bank-statement.csv',
    jsonb_build_array(
      jsonb_build_object('externalReference', 'BANK-P8-001', 'transactionDate', current_date,
        'direction', 'credit', 'currency', 'NGN', 'amountMinor', 2500000),
      jsonb_build_object('externalReference', 'BANK-P8-001', 'transactionDate', current_date,
        'direction', 'credit', 'currency', 'NGN', 'amountMinor', 2500000),
      jsonb_build_object('externalReference', 'BANK-P8-UNMATCHED', 'transactionDate', current_date,
        'direction', 'credit', 'currency', 'NGN', 'amountMinor', 150000)
    ), jsonb_build_object('test', 'phase8-completion')
  );
  v_batch_id := nullif(v_result->>'id', '')::uuid;
  if v_batch_id is null or (v_result->>'totalLines')::integer <> 3 then raise exception 'Reconciliation batch failed: %', v_result; end if;
  select count(*) into v_count from public.agilecert_reconciliation_lines
  where batch_id = v_batch_id and status = 'matched';
  if v_count <> 1 then raise exception 'Expected one exactly matched reconciliation line, found %.', v_count; end if;
  select count(*) into v_count from public.agilecert_reconciliation_lines
  where batch_id = v_batch_id and status = 'duplicate';
  if v_count <> 1 then raise exception 'Expected one duplicate reconciliation line, found %.', v_count; end if;
  select count(*) into v_count from public.agilecert_reconciliation_lines
  where batch_id = v_batch_id and status = 'unmatched';
  if v_count <> 1 then raise exception 'Expected one unmatched reconciliation line, found %.', v_count; end if;

  v_console := public.get_agilecert_finance_admin_console(100);
  if jsonb_array_length(v_console->'customers') < 1
     or jsonb_array_length(v_console->'invoices') < 1
     or jsonb_array_length(v_console->'seatPools') <> 2
     or jsonb_array_length(v_console->'receipts') < 1 then
    raise exception 'The finance administration console is incomplete: %', v_console;
  end if;

  if has_table_privilege('authenticated', 'public.agilecert_institutional_customers', 'SELECT')
     or has_table_privilege('authenticated', 'public.agilecert_institution_invoices', 'INSERT')
     or has_table_privilege('authenticated', 'public.agilecert_finance_audit_events', 'UPDATE') then
    raise exception 'Direct authenticated finance-table access is not fully blocked.';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_agilecert_finance_workspace()', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_agilecert_finance_workspace()', 'EXECUTE') then
    raise exception 'Candidate finance workspace function permissions are invalid.';
  end if;
  if has_function_privilege('authenticated', 'public.agilecert_next_finance_number(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.agilecert_record_finance_audit(uuid,uuid,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'Internal finance helper functions remain executable by authenticated users.';
  end if;

  if to_regprocedure('public.quote_exam_purchase(uuid,text,text)') is null
     or to_regprocedure('public.create_agilecert_certificate_order(uuid,text,text)') is null
     or to_regprocedure('public.start_exam_secure(uuid,jsonb)') is null then
    raise exception 'An existing examination or certificate commerce authority is missing after Phase 8.';
  end if;

  select count(*) into v_count from public.agilecert_finance_audit_events;
  if v_count < 15 then raise exception 'The finance lifecycle did not create the expected audit history: %', v_count; end if;
end;
$$;

rollback;