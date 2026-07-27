begin;

create or replace function public.nominate_agilecert_sponsored_candidate(
  p_seat_pool_id uuid,
  p_candidate_email text,
  p_eligibility_id uuid default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_pool public.agilecert_sponsorship_seat_pools%rowtype;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_candidate public.profiles%rowtype;
  v_nomination public.agilecert_sponsorship_nominations%rowtype;
  v_existing boolean := false;
begin
  select * into v_pool
  from public.agilecert_sponsorship_seat_pools
  where id = p_seat_pool_id
  for update;
  if not found then raise exception 'The sponsorship seat pool was not found.'; end if;

  select * into v_invoice
  from public.agilecert_institution_invoices
  where id = v_pool.invoice_id;

  if v_pool.status not in ('active', 'draft', 'exhausted') then
    raise exception 'The sponsorship seat pool is unavailable.';
  end if;
  if v_pool.valid_from > now() or (v_pool.valid_until is not null and v_pool.valid_until <= now()) then
    raise exception 'The sponsorship seat pool is outside its valid access window.';
  end if;
  if v_invoice.status <> 'paid' and v_invoice.access_authorized_at is null then
    raise exception 'The institutional invoice must be paid or explicitly authorised before candidates may be nominated.';
  end if;

  select * into v_candidate
  from public.profiles
  where lower(email) = lower(trim(p_candidate_email))
    and role = 'candidate'
    and is_active;
  if not found then raise exception 'An active candidate account with this email was not found.'; end if;

  if v_pool.product_type = 'certificate' then
    if p_eligibility_id is null or not exists (
      select 1
      from public.agilecert_certificate_eligibility_records er
      where er.id = p_eligibility_id
        and er.candidate_id = v_candidate.id
        and er.eligibility_status in ('eligible', 'requested')
        and er.integrity_status = 'cleared'
    ) then
      raise exception 'A current cleared certificate eligibility record is required for this sponsored certificate.';
    end if;
  elsif p_eligibility_id is not null then
    raise exception 'Certificate eligibility is not used for an examination seat.';
  end if;

  select * into v_nomination
  from public.agilecert_sponsorship_nominations
  where seat_pool_id = v_pool.id and candidate_id = v_candidate.id
  for update;
  v_existing := found;

  if v_existing and v_nomination.status in ('nominated', 'accepted') then
    update public.agilecert_sponsorship_nominations
    set eligibility_id = coalesce(p_eligibility_id, eligibility_id),
        expires_at = case
          when status = 'accepted' then expires_at
          else least(
            coalesce(p_expires_at, v_pool.valid_until, now() + interval '30 days'),
            coalesce(v_pool.valid_until, 'infinity'::timestamptz)
          )
        end,
        updated_by = v_actor,
        updated_at = now()
    where id = v_nomination.id
    returning * into v_nomination;

    perform public.agilecert_record_finance_audit(
      v_actor, v_pool.customer_id, 'sponsorship_nomination', v_nomination.id::text,
      'candidate_sponsorship_nomination_reaffirmed',
      jsonb_build_object('poolCode', v_pool.pool_code, 'candidateId', v_candidate.id,
        'productType', v_pool.product_type, 'status', v_nomination.status)
    );

    return jsonb_build_object(
      'id', v_nomination.id,
      'nominationReference', v_nomination.nomination_reference,
      'candidateId', v_candidate.id,
      'candidateName', v_candidate.full_name,
      'candidateEmail', v_candidate.email,
      'status', v_nomination.status,
      'productType', v_pool.product_type,
      'expiresAt', v_nomination.expires_at,
      'alreadyNominated', true
    );
  end if;

  if v_pool.allocated_seats >= v_pool.purchased_seats then
    raise exception 'The sponsorship seat pool is fully allocated.';
  end if;

  insert into public.agilecert_sponsorship_nominations (
    seat_pool_id, candidate_id, eligibility_id, status, expires_at, created_by, updated_by
  ) values (
    v_pool.id,
    v_candidate.id,
    p_eligibility_id,
    'nominated',
    least(
      coalesce(p_expires_at, v_pool.valid_until, now() + interval '30 days'),
      coalesce(v_pool.valid_until, 'infinity'::timestamptz)
    ),
    v_actor,
    v_actor
  )
  on conflict (seat_pool_id, candidate_id) do update set
    eligibility_id = excluded.eligibility_id,
    status = 'nominated',
    responded_at = null,
    response_note = null,
    expires_at = excluded.expires_at,
    updated_by = v_actor,
    updated_at = now()
  returning * into v_nomination;

  perform public.agilecert_record_finance_audit(
    v_actor, v_pool.customer_id, 'sponsorship_nomination', v_nomination.id::text,
    'candidate_nominated_for_sponsorship',
    jsonb_build_object('poolCode', v_pool.pool_code, 'candidateId', v_candidate.id,
      'productType', v_pool.product_type)
  );

  return jsonb_build_object(
    'id', v_nomination.id,
    'nominationReference', v_nomination.nomination_reference,
    'candidateId', v_candidate.id,
    'candidateName', v_candidate.full_name,
    'candidateEmail', v_candidate.email,
    'status', v_nomination.status,
    'productType', v_pool.product_type,
    'expiresAt', v_nomination.expires_at,
    'alreadyNominated', false
  );
end;
$$;

create or replace function public.respond_my_agilecert_sponsorship_nomination(
  p_nomination_id uuid,
  p_response text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid := auth.uid();
  v_response text := lower(trim(coalesce(p_response, '')));
  v_nomination public.agilecert_sponsorship_nominations%rowtype;
  v_pool public.agilecert_sponsorship_seat_pools%rowtype;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_order public.agilecert_certificate_orders%rowtype;
  v_issue jsonb;
  v_credential_id uuid;
  v_grant public.agilecert_sponsorship_access_grants%rowtype;
begin
  if v_candidate is null or not exists (
    select 1 from public.profiles
    where id = v_candidate and role = 'candidate' and is_active
  ) then
    raise exception 'An active candidate account is required.';
  end if;
  if v_response not in ('accepted', 'declined') then
    raise exception 'Response must be accepted or declined.';
  end if;

  select * into v_nomination
  from public.agilecert_sponsorship_nominations
  where id = p_nomination_id and candidate_id = v_candidate
  for update;
  if not found or v_nomination.status <> 'nominated' then
    raise exception 'The active sponsorship nomination was not found.';
  end if;

  if v_nomination.expires_at is not null and v_nomination.expires_at <= now() then
    update public.agilecert_sponsorship_nominations
    set status = 'expired', updated_by = v_candidate, updated_at = now()
    where id = v_nomination.id;
    raise exception 'The sponsorship nomination has expired.';
  end if;

  select * into v_pool
  from public.agilecert_sponsorship_seat_pools
  where id = v_nomination.seat_pool_id
  for update;
  select * into v_invoice
  from public.agilecert_institution_invoices
  where id = v_pool.invoice_id;

  if v_invoice.status <> 'paid' and v_invoice.access_authorized_at is null then
    raise exception 'The sponsor invoice is not yet authorised for access.';
  end if;

  if v_response = 'declined' then
    update public.agilecert_sponsorship_nominations
    set status = 'declined',
        responded_at = now(),
        response_note = nullif(trim(coalesce(p_note, '')), ''),
        updated_by = v_candidate,
        updated_at = now()
    where id = v_nomination.id
    returning * into v_nomination;

    perform public.agilecert_record_finance_audit(
      v_candidate, v_pool.customer_id, 'sponsorship_nomination', v_nomination.id::text,
      'sponsorship_nomination_declined',
      jsonb_build_object('poolCode', v_pool.pool_code)
    );

    return jsonb_build_object('id', v_nomination.id, 'status', v_nomination.status);
  end if;

  if v_pool.product_type = 'examination' then
    insert into public.exam_assignments (
      examination_id, candidate_id, assigned_by, available_from, expires_at,
      max_attempts_override, status
    ) values (
      v_pool.examination_id,
      v_candidate,
      v_pool.created_by,
      greatest(v_pool.valid_from, now()),
      v_pool.valid_until,
      v_pool.max_attempts_override,
      'assigned'
    )
    on conflict (examination_id, candidate_id) do update set
      assigned_by = excluded.assigned_by,
      available_from = least(
        coalesce(public.exam_assignments.available_from, excluded.available_from),
        excluded.available_from
      ),
      expires_at = case
        when public.exam_assignments.expires_at is null then excluded.expires_at
        when excluded.expires_at is null then public.exam_assignments.expires_at
        else greatest(public.exam_assignments.expires_at, excluded.expires_at)
      end,
      max_attempts_override = coalesce(
        excluded.max_attempts_override,
        public.exam_assignments.max_attempts_override
      ),
      status = 'assigned',
      updated_at = now()
    returning * into v_assignment;

    insert into public.agilecert_sponsorship_access_grants (
      nomination_id, seat_pool_id, customer_id, invoice_id, candidate_id,
      grant_type, examination_assignment_id, status, expires_at, metadata
    ) values (
      v_nomination.id,
      v_pool.id,
      v_pool.customer_id,
      v_pool.invoice_id,
      v_candidate,
      'examination_assignment',
      v_assignment.id,
      'active',
      v_pool.valid_until,
      jsonb_build_object('poolCode', v_pool.pool_code, 'invoiceNumber', v_invoice.invoice_number)
    )
    returning * into v_grant;
  else
    if exists (
      select 1
      from public.agilecert_issued_certificates
      where eligibility_id = v_nomination.eligibility_id
    ) then
      raise exception 'A certificate has already been issued for this eligibility record.';
    end if;

    insert into public.agilecert_certificate_orders (
      reference, candidate_id, eligibility_id, product_code, currency, pricing_window,
      list_amount_minor, discount_amount_minor, payable_amount_minor, status,
      payment_provider, paid_at, fulfilled_at, waived_at, waived_by, waiver_reason, metadata
    )
    select
      'AGC-SPON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
      v_candidate,
      v_nomination.eligibility_id,
      v_pool.certificate_product_code,
      v_invoice.currency,
      'waived',
      item.unit_amount_minor,
      item.unit_amount_minor,
      0,
      'waived',
      'institutional_sponsorship',
      now(),
      null,
      now(),
      v_pool.created_by,
      'Paid or credit-authorised institutional sponsorship invoice ' || v_invoice.invoice_number,
      jsonb_build_object(
        'sponsorshipPoolId', v_pool.id,
        'invoiceId', v_invoice.id,
        'invoiceNumber', v_invoice.invoice_number,
        'nominationId', v_nomination.id
      )
    from public.agilecert_institution_invoice_items item
    where item.id = v_pool.invoice_item_id
    returning * into v_order;

    v_issue := public.agilecert_issue_certificate_for_order(
      v_order.id,
      v_pool.created_by,
      'institutional_sponsorship'
    );
    v_credential_id := nullif(v_issue ->> 'credentialId', '')::uuid;

    insert into public.agilecert_sponsorship_access_grants (
      nomination_id, seat_pool_id, customer_id, invoice_id, candidate_id,
      grant_type, certificate_order_id, credential_id, status, metadata
    ) values (
      v_nomination.id,
      v_pool.id,
      v_pool.customer_id,
      v_pool.invoice_id,
      v_candidate,
      'certificate_credential',
      v_order.id,
      v_credential_id,
      'consumed',
      jsonb_build_object(
        'poolCode', v_pool.pool_code,
        'invoiceNumber', v_invoice.invoice_number,
        'credentialCode', v_issue ->> 'credentialCode'
      )
    )
    returning * into v_grant;
  end if;

  update public.agilecert_sponsorship_nominations
  set status = 'accepted',
      responded_at = now(),
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_by = v_candidate,
      updated_at = now()
  where id = v_nomination.id
  returning * into v_nomination;

  perform public.agilecert_record_finance_audit(
    v_candidate, v_pool.customer_id, 'sponsorship_access_grant', v_grant.id::text,
    'sponsorship_access_granted',
    jsonb_build_object('poolCode', v_pool.pool_code,
      'grantType', v_grant.grant_type, 'candidateId', v_candidate)
  );

  return jsonb_build_object(
    'nominationId', v_nomination.id,
    'status', v_nomination.status,
    'grantId', v_grant.id,
    'grantType', v_grant.grant_type,
    'assignmentId', v_grant.examination_assignment_id,
    'certificateOrderId', v_grant.certificate_order_id,
    'credentialId', v_grant.credential_id
  );
end;
$$;

revoke all on function public.nominate_agilecert_sponsored_candidate(uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.respond_my_agilecert_sponsorship_nomination(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.nominate_agilecert_sponsored_candidate(uuid, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.respond_my_agilecert_sponsorship_nomination(uuid, text, text)
  to authenticated;

commit;