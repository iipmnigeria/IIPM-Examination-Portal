begin;

create table if not exists public.agilecert_sponsorship_seat_pools (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete restrict,
  invoice_item_id uuid not null unique references public.agilecert_institution_invoice_items(id) on delete restrict,
  pool_code text not null unique default (
    'SEAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14))
  ),
  product_type text not null check (product_type in ('examination', 'certificate')),
  examination_id uuid references public.examinations(id) on delete restrict,
  programme_id uuid references public.programmes(id) on delete restrict,
  certificate_product_code text references public.agilecert_certificate_products(code) on delete restrict,
  purchased_seats integer not null check (purchased_seats > 0),
  allocated_seats integer not null default 0 check (allocated_seats >= 0),
  consumed_seats integer not null default 0 check (consumed_seats >= 0),
  released_seats integer not null default 0 check (released_seats >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  max_attempts_override integer check (max_attempts_override between 1 and 10),
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'exhausted', 'expired', 'closed')),
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocated_seats <= purchased_seats),
  check (consumed_seats <= allocated_seats),
  check (valid_until is null or valid_until > valid_from),
  check (
    (product_type = 'examination' and examination_id is not null and certificate_product_code is null)
    or (product_type = 'certificate' and certificate_product_code is not null)
  )
);

create index if not exists agilecert_sponsorship_pools_customer_idx
  on public.agilecert_sponsorship_seat_pools (customer_id, status, created_at desc);
create index if not exists agilecert_sponsorship_pools_invoice_idx
  on public.agilecert_sponsorship_seat_pools (invoice_id);

create table if not exists public.agilecert_sponsorship_nominations (
  id uuid primary key default gen_random_uuid(),
  seat_pool_id uuid not null references public.agilecert_sponsorship_seat_pools(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  eligibility_id uuid references public.agilecert_certificate_eligibility_records(id) on delete restrict,
  nomination_reference text not null unique default (
    'NOM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  ),
  status text not null default 'nominated'
    check (status in ('nominated', 'accepted', 'declined', 'released', 'expired', 'cancelled')),
  nominated_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz,
  response_note text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seat_pool_id, candidate_id)
);

create index if not exists agilecert_sponsorship_nominations_candidate_idx
  on public.agilecert_sponsorship_nominations (candidate_id, status, created_at desc);

create table if not exists public.agilecert_sponsorship_access_grants (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null unique references public.agilecert_sponsorship_nominations(id) on delete restrict,
  seat_pool_id uuid not null references public.agilecert_sponsorship_seat_pools(id) on delete restrict,
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  grant_type text not null check (grant_type in ('examination_assignment', 'certificate_credential')),
  examination_assignment_id uuid references public.exam_assignments(id) on delete restrict,
  certificate_order_id uuid references public.agilecert_certificate_orders(id) on delete restrict,
  credential_id uuid references public.agilecert_paid_credentials(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'consumed', 'revoked', 'expired')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revocation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (grant_type = 'examination_assignment' and examination_assignment_id is not null and certificate_order_id is null)
    or (grant_type = 'certificate_credential' and certificate_order_id is not null)
  )
);

create index if not exists agilecert_sponsorship_grants_candidate_idx
  on public.agilecert_sponsorship_access_grants (candidate_id, status, granted_at desc);

create trigger agilecert_sponsorship_seat_pools_set_updated_at
  before update on public.agilecert_sponsorship_seat_pools
  for each row execute function public.set_updated_at();
create trigger agilecert_sponsorship_nominations_set_updated_at
  before update on public.agilecert_sponsorship_nominations
  for each row execute function public.set_updated_at();

create or replace function public.authorize_agilecert_invoice_sponsored_access(
  p_invoice_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_super_admin();
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_customer public.agilecert_institutional_customers%rowtype;
  v_outstanding bigint;
begin
  if length(trim(coalesce(p_reason, ''))) < 15 then
    raise exception 'A clear credit-authorisation reason of at least 15 characters is required.';
  end if;
  select * into v_invoice from public.agilecert_institution_invoices where id = p_invoice_id for update;
  if not found or v_invoice.status in ('void', 'refunded') then raise exception 'The active invoice was not found.'; end if;
  select * into v_customer from public.agilecert_institutional_customers where id = v_invoice.customer_id;
  v_outstanding := v_invoice.balance_amount_minor;
  if v_invoice.status <> 'paid' and v_outstanding > v_customer.credit_limit_minor then
    raise exception 'The outstanding invoice balance exceeds the customer credit limit.';
  end if;

  update public.agilecert_institution_invoices set
    access_authorized_at = now(), access_authorized_by = v_actor,
    access_authorization_reason = trim(p_reason), updated_by = v_actor, updated_at = now()
  where id = v_invoice.id returning * into v_invoice;

  update public.agilecert_sponsorship_seat_pools set
    status = case when valid_until is not null and valid_until <= now() then 'expired' else 'active' end,
    updated_by = v_actor, updated_at = now()
  where invoice_id = v_invoice.id and status = 'draft';

  perform public.agilecert_record_finance_audit(v_actor, v_invoice.customer_id, 'institution_invoice', v_invoice.id::text,
    'sponsored_access_credit_authorized', jsonb_build_object('invoiceNumber', v_invoice.invoice_number,
      'outstandingMinor', v_outstanding, 'reason', left(trim(p_reason), 500)));

  return jsonb_build_object('invoiceId', v_invoice.id, 'invoiceNumber', v_invoice.invoice_number,
    'accessAuthorizedAt', v_invoice.access_authorized_at, 'accessAuthorizedBy', v_invoice.access_authorized_by);
end;
$$;

create or replace function public.create_agilecert_sponsorship_seat_pool(
  p_invoice_item_id uuid,
  p_valid_from timestamptz default now(),
  p_valid_until timestamptz default null,
  p_max_attempts_override integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_item public.agilecert_institution_invoice_items%rowtype;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_pool public.agilecert_sponsorship_seat_pools%rowtype;
  v_status text;
begin
  select * into v_item from public.agilecert_institution_invoice_items where id = p_invoice_item_id;
  if not found or v_item.product_type not in ('examination', 'certificate') then
    raise exception 'A sponsored examination or certificate invoice item is required.';
  end if;
  select * into v_invoice from public.agilecert_institution_invoices where id = v_item.invoice_id;
  if v_invoice.status in ('void', 'refunded') then raise exception 'A seat pool cannot be created for this invoice.'; end if;
  if p_max_attempts_override is not null and (p_max_attempts_override < 1 or p_max_attempts_override > 10) then
    raise exception 'Maximum attempts must be between 1 and 10.';
  end if;
  if p_valid_until is not null and p_valid_until <= coalesce(p_valid_from, now()) then
    raise exception 'Seat-pool expiry must follow its start time.';
  end if;
  if v_item.product_type = 'certificate' and v_invoice.currency not in ('NGN', 'USD') then
    raise exception 'Sponsored certificate orders require NGN or USD because the credential authority supports those currencies.';
  end if;

  v_status := case
    when p_valid_until is not null and p_valid_until <= now() then 'expired'
    when v_invoice.status = 'paid' or v_invoice.access_authorized_at is not null then 'active'
    else 'draft'
  end;

  insert into public.agilecert_sponsorship_seat_pools (
    customer_id, invoice_id, invoice_item_id, product_type, examination_id,
    programme_id, certificate_product_code, purchased_seats, valid_from, valid_until,
    max_attempts_override, status, notes, created_by, updated_by
  ) values (
    v_invoice.customer_id, v_invoice.id, v_item.id, v_item.product_type, v_item.examination_id,
    v_item.programme_id, v_item.certificate_product_code, v_item.quantity,
    coalesce(p_valid_from, now()), p_valid_until, p_max_attempts_override, v_status,
    nullif(trim(coalesce(p_notes, '')), ''), v_actor, v_actor
  )
  on conflict (invoice_item_id) do update set
    valid_from = excluded.valid_from, valid_until = excluded.valid_until,
    max_attempts_override = excluded.max_attempts_override,
    notes = excluded.notes, updated_by = v_actor, updated_at = now()
  returning * into v_pool;

  perform public.agilecert_record_finance_audit(v_actor, v_pool.customer_id, 'sponsorship_seat_pool', v_pool.id::text,
    'sponsorship_seat_pool_saved', jsonb_build_object('poolCode', v_pool.pool_code,
      'productType', v_pool.product_type, 'purchasedSeats', v_pool.purchased_seats, 'status', v_pool.status));

  return jsonb_build_object('id', v_pool.id, 'poolCode', v_pool.pool_code,
    'productType', v_pool.product_type, 'purchasedSeats', v_pool.purchased_seats,
    'availableSeats', v_pool.purchased_seats - v_pool.allocated_seats, 'status', v_pool.status);
end;
$$;

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
begin
  select * into v_pool from public.agilecert_sponsorship_seat_pools where id = p_seat_pool_id for update;
  if not found then raise exception 'The sponsorship seat pool was not found.'; end if;
  select * into v_invoice from public.agilecert_institution_invoices where id = v_pool.invoice_id;
  if v_pool.status not in ('active', 'draft') then raise exception 'The sponsorship seat pool is unavailable.'; end if;
  if v_pool.valid_from > now() or (v_pool.valid_until is not null and v_pool.valid_until <= now()) then
    raise exception 'The sponsorship seat pool is outside its valid access window.';
  end if;
  if v_invoice.status <> 'paid' and v_invoice.access_authorized_at is null then
    raise exception 'The institutional invoice must be paid or explicitly authorised before candidates may be nominated.';
  end if;
  if v_pool.allocated_seats >= v_pool.purchased_seats then raise exception 'The sponsorship seat pool is fully allocated.'; end if;

  select * into v_candidate from public.profiles
  where lower(email) = lower(trim(p_candidate_email)) and role = 'candidate' and is_active;
  if not found then raise exception 'An active candidate account with this email was not found.'; end if;

  if v_pool.product_type = 'certificate' then
    if p_eligibility_id is null or not exists (
      select 1 from public.agilecert_certificate_eligibility_records er
      where er.id = p_eligibility_id and er.candidate_id = v_candidate.id
        and er.eligibility_status in ('eligible', 'requested') and er.integrity_status = 'cleared'
    ) then raise exception 'A current cleared certificate eligibility record is required for this sponsored certificate.'; end if;
  elsif p_eligibility_id is not null then
    raise exception 'Certificate eligibility is not used for an examination seat.';
  end if;

  insert into public.agilecert_sponsorship_nominations (
    seat_pool_id, candidate_id, eligibility_id, status, expires_at, created_by, updated_by
  ) values (
    v_pool.id, v_candidate.id, p_eligibility_id, 'nominated',
    least(coalesce(p_expires_at, v_pool.valid_until, now() + interval '30 days'),
      coalesce(v_pool.valid_until, 'infinity'::timestamptz)), v_actor, v_actor
  )
  on conflict (seat_pool_id, candidate_id) do update set
    eligibility_id = excluded.eligibility_id,
    status = case when public.agilecert_sponsorship_nominations.status in ('declined', 'released', 'expired', 'cancelled') then 'nominated' else public.agilecert_sponsorship_nominations.status end,
    expires_at = excluded.expires_at, updated_by = v_actor, updated_at = now()
  returning * into v_nomination;

  if v_nomination.status = 'nominated' and not exists (
    select 1 from public.agilecert_sponsorship_access_grants where nomination_id = v_nomination.id
  ) then
    update public.agilecert_sponsorship_seat_pools set
      allocated_seats = least(purchased_seats, allocated_seats + 1),
      status = case when allocated_seats + 1 >= purchased_seats then 'exhausted' else 'active' end,
      updated_by = v_actor, updated_at = now()
    where id = v_pool.id;
  end if;

  perform public.agilecert_record_finance_audit(v_actor, v_pool.customer_id, 'sponsorship_nomination', v_nomination.id::text,
    'candidate_nominated_for_sponsorship', jsonb_build_object('poolCode', v_pool.pool_code,
      'candidateId', v_candidate.id, 'productType', v_pool.product_type));

  return jsonb_build_object('id', v_nomination.id, 'nominationReference', v_nomination.nomination_reference,
    'candidateId', v_candidate.id, 'candidateName', v_candidate.full_name,
    'candidateEmail', v_candidate.email, 'status', v_nomination.status,
    'productType', v_pool.product_type, 'expiresAt', v_nomination.expires_at);
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
    select 1 from public.profiles where id = v_candidate and role = 'candidate' and is_active
  ) then raise exception 'An active candidate account is required.'; end if;
  if v_response not in ('accepted', 'declined') then raise exception 'Response must be accepted or declined.'; end if;

  select * into v_nomination from public.agilecert_sponsorship_nominations
  where id = p_nomination_id and candidate_id = v_candidate for update;
  if not found or v_nomination.status <> 'nominated' then raise exception 'The active sponsorship nomination was not found.'; end if;
  if v_nomination.expires_at is not null and v_nomination.expires_at <= now() then
    update public.agilecert_sponsorship_nominations set status = 'expired', updated_by = v_candidate, updated_at = now()
    where id = v_nomination.id;
    raise exception 'The sponsorship nomination has expired.';
  end if;
  select * into v_pool from public.agilecert_sponsorship_seat_pools where id = v_nomination.seat_pool_id for update;
  select * into v_invoice from public.agilecert_institution_invoices where id = v_pool.invoice_id;
  if v_invoice.status <> 'paid' and v_invoice.access_authorized_at is null then
    raise exception 'The sponsor invoice is not yet authorised for access.';
  end if;

  if v_response = 'declined' then
    update public.agilecert_sponsorship_nominations set
      status = 'declined', responded_at = now(), response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_by = v_candidate, updated_at = now()
    where id = v_nomination.id returning * into v_nomination;
    update public.agilecert_sponsorship_seat_pools set
      allocated_seats = greatest(0, allocated_seats - 1), released_seats = released_seats + 1,
      status = 'active', updated_by = v_candidate, updated_at = now()
    where id = v_pool.id;
    perform public.agilecert_record_finance_audit(v_candidate, v_pool.customer_id, 'sponsorship_nomination', v_nomination.id::text,
      'sponsorship_nomination_declined', jsonb_build_object('poolCode', v_pool.pool_code));
    return jsonb_build_object('id', v_nomination.id, 'status', v_nomination.status);
  end if;

  if v_pool.product_type = 'examination' then
    insert into public.exam_assignments (
      examination_id, candidate_id, assigned_by, available_from, expires_at,
      max_attempts_override, status
    ) values (
      v_pool.examination_id, v_candidate, v_pool.created_by,
      greatest(v_pool.valid_from, now()), v_pool.valid_until, v_pool.max_attempts_override, 'assigned'
    )
    on conflict (examination_id, candidate_id) do update set
      assigned_by = excluded.assigned_by,
      available_from = least(coalesce(public.exam_assignments.available_from, excluded.available_from), excluded.available_from),
      expires_at = case
        when public.exam_assignments.expires_at is null then excluded.expires_at
        when excluded.expires_at is null then public.exam_assignments.expires_at
        else greatest(public.exam_assignments.expires_at, excluded.expires_at)
      end,
      max_attempts_override = coalesce(excluded.max_attempts_override, public.exam_assignments.max_attempts_override),
      status = 'assigned', updated_at = now()
    returning * into v_assignment;

    insert into public.agilecert_sponsorship_access_grants (
      nomination_id, seat_pool_id, customer_id, invoice_id, candidate_id,
      grant_type, examination_assignment_id, status, expires_at, metadata
    ) values (
      v_nomination.id, v_pool.id, v_pool.customer_id, v_pool.invoice_id, v_candidate,
      'examination_assignment', v_assignment.id, 'active', v_pool.valid_until,
      jsonb_build_object('poolCode', v_pool.pool_code, 'invoiceNumber', v_invoice.invoice_number)
    ) returning * into v_grant;
  else
    if exists (
      select 1 from public.agilecert_issued_certificates where eligibility_id = v_nomination.eligibility_id
    ) then raise exception 'A certificate has already been issued for this eligibility record.'; end if;

    insert into public.agilecert_certificate_orders (
      reference, candidate_id, eligibility_id, product_code, currency, pricing_window,
      list_amount_minor, discount_amount_minor, payable_amount_minor, status,
      payment_provider, paid_at, fulfilled_at, waived_at, waived_by, waiver_reason, metadata
    )
    select
      'AGC-SPON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
      v_candidate, v_nomination.eligibility_id, v_pool.certificate_product_code,
      v_invoice.currency, 'waived', item.unit_amount_minor, item.unit_amount_minor, 0,
      'waived', 'institutional_sponsorship', now(), null, now(), v_pool.created_by,
      'Paid or credit-authorised institutional sponsorship invoice ' || v_invoice.invoice_number,
      jsonb_build_object('sponsorshipPoolId', v_pool.id, 'invoiceId', v_invoice.id,
        'invoiceNumber', v_invoice.invoice_number, 'nominationId', v_nomination.id)
    from public.agilecert_institution_invoice_items item
    where item.id = v_pool.invoice_item_id
    returning * into v_order;

    v_issue := public.agilecert_issue_certificate_for_order(v_order.id, v_pool.created_by, 'institutional_sponsorship');
    v_credential_id := nullif(v_issue ->> 'credentialId', '')::uuid;

    insert into public.agilecert_sponsorship_access_grants (
      nomination_id, seat_pool_id, customer_id, invoice_id, candidate_id,
      grant_type, certificate_order_id, credential_id, status, metadata
    ) values (
      v_nomination.id, v_pool.id, v_pool.customer_id, v_pool.invoice_id, v_candidate,
      'certificate_credential', v_order.id, v_credential_id, 'consumed',
      jsonb_build_object('poolCode', v_pool.pool_code, 'invoiceNumber', v_invoice.invoice_number,
        'credentialCode', v_issue ->> 'credentialCode')
    ) returning * into v_grant;
  end if;

  update public.agilecert_sponsorship_nominations set
    status = 'accepted', responded_at = now(), response_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_by = v_candidate, updated_at = now()
  where id = v_nomination.id returning * into v_nomination;

  update public.agilecert_sponsorship_seat_pools set
    consumed_seats = consumed_seats + 1,
    status = case when allocated_seats >= purchased_seats then 'exhausted' else 'active' end,
    updated_by = v_candidate, updated_at = now()
  where id = v_pool.id;

  perform public.agilecert_record_finance_audit(v_candidate, v_pool.customer_id, 'sponsorship_access_grant', v_grant.id::text,
    'sponsorship_access_granted', jsonb_build_object('poolCode', v_pool.pool_code,
      'grantType', v_grant.grant_type, 'candidateId', v_candidate));

  return jsonb_build_object('nominationId', v_nomination.id, 'status', v_nomination.status,
    'grantId', v_grant.id, 'grantType', v_grant.grant_type,
    'assignmentId', v_grant.examination_assignment_id, 'certificateOrderId', v_grant.certificate_order_id,
    'credentialId', v_grant.credential_id);
end;
$$;

commit;