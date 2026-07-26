begin;

create sequence if not exists public.agilecert_quote_number_seq start 1001;
create sequence if not exists public.agilecert_invoice_number_seq start 1001;
create sequence if not exists public.agilecert_receipt_number_seq start 1001;
create sequence if not exists public.agilecert_credit_note_number_seq start 1001;
create sequence if not exists public.agilecert_refund_number_seq start 1001;

create or replace function public.agilecert_next_finance_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.agilecert_finance_settings%rowtype;
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_prefix text;
  v_number bigint;
begin
  select * into v_settings from public.agilecert_finance_settings where singleton;
  case v_kind
    when 'quote' then v_prefix := v_settings.quote_prefix; v_number := nextval('public.agilecert_quote_number_seq');
    when 'invoice' then v_prefix := v_settings.invoice_prefix; v_number := nextval('public.agilecert_invoice_number_seq');
    when 'receipt' then v_prefix := v_settings.receipt_prefix; v_number := nextval('public.agilecert_receipt_number_seq');
    when 'credit_note' then v_prefix := v_settings.credit_note_prefix; v_number := nextval('public.agilecert_credit_note_number_seq');
    when 'refund' then v_prefix := v_settings.refund_prefix; v_number := nextval('public.agilecert_refund_number_seq');
    else raise exception 'Unsupported finance document type.';
  end case;
  return upper(v_prefix) || '-' || to_char(current_date, 'YYYY') || '-' || lpad(v_number::text, 6, '0');
end;
$$;

create table if not exists public.agilecert_institution_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default public.agilecert_next_finance_number('quote'),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_profile_id uuid references public.agilecert_tax_profiles(id) on delete set null,
  purchase_order_reference text,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'accepted', 'rejected', 'expired', 'converted', 'void')),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  tax_amount_minor bigint not null default 0 check (tax_amount_minor >= 0),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  issued_at timestamptz,
  valid_until date not null,
  decided_at timestamptz,
  converted_at timestamptz,
  notes text,
  terms text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount_minor = subtotal_minor - discount_amount_minor + tax_amount_minor),
  check (discount_amount_minor <= subtotal_minor)
);

create index if not exists agilecert_institution_quotes_customer_idx
  on public.agilecert_institution_quotes (customer_id, created_at desc);
create index if not exists agilecert_institution_quotes_status_idx
  on public.agilecert_institution_quotes (status, valid_until);

create table if not exists public.agilecert_institution_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.agilecert_institution_quotes(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_type text not null check (product_type in ('examination', 'certificate', 'service')),
  examination_id uuid references public.examinations(id) on delete restrict,
  programme_id uuid references public.programmes(id) on delete restrict,
  certificate_product_code text references public.agilecert_certificate_products(code) on delete restrict,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  discount_percent numeric(7,4) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_percent numeric(7,4) not null default 0 check (tax_rate_percent between 0 and 100),
  list_amount_minor bigint not null check (list_amount_minor >= 0),
  discount_amount_minor bigint not null check (discount_amount_minor >= 0),
  tax_amount_minor bigint not null check (tax_amount_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (quote_id, line_number),
  check (discount_amount_minor <= list_amount_minor),
  check (line_total_minor = list_amount_minor - discount_amount_minor + tax_amount_minor),
  check (
    (product_type = 'examination' and examination_id is not null and certificate_product_code is null)
    or (product_type = 'certificate' and certificate_product_code is not null)
    or (product_type = 'service')
  )
);

create table if not exists public.agilecert_institution_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.agilecert_next_finance_number('invoice'),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete restrict,
  quote_id uuid unique references public.agilecert_institution_quotes(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_profile_id uuid references public.agilecert_tax_profiles(id) on delete set null,
  purchase_order_reference text,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'part_paid', 'paid', 'overdue', 'void', 'refunded')),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  tax_amount_minor bigint not null default 0 check (tax_amount_minor >= 0),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  paid_amount_minor bigint not null default 0 check (paid_amount_minor >= 0),
  credited_amount_minor bigint not null default 0 check (credited_amount_minor >= 0),
  balance_amount_minor bigint not null default 0 check (balance_amount_minor >= 0),
  issue_date date,
  due_date date,
  issued_at timestamptz,
  paid_at timestamptz,
  access_authorized_at timestamptz,
  access_authorized_by uuid references public.profiles(id),
  access_authorization_reason text,
  notes text,
  terms text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount_minor = subtotal_minor - discount_amount_minor + tax_amount_minor),
  check (discount_amount_minor <= subtotal_minor),
  check (balance_amount_minor = greatest(0, total_amount_minor - paid_amount_minor - credited_amount_minor)),
  check (due_date is null or issue_date is null or due_date >= issue_date)
);

create index if not exists agilecert_institution_invoices_customer_idx
  on public.agilecert_institution_invoices (customer_id, created_at desc);
create index if not exists agilecert_institution_invoices_status_idx
  on public.agilecert_institution_invoices (status, due_date);

create table if not exists public.agilecert_institution_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete cascade,
  quote_item_id uuid references public.agilecert_institution_quote_items(id) on delete set null,
  line_number integer not null check (line_number > 0),
  product_type text not null check (product_type in ('examination', 'certificate', 'service')),
  examination_id uuid references public.examinations(id) on delete restrict,
  programme_id uuid references public.programmes(id) on delete restrict,
  certificate_product_code text references public.agilecert_certificate_products(code) on delete restrict,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  discount_percent numeric(7,4) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_percent numeric(7,4) not null default 0 check (tax_rate_percent between 0 and 100),
  list_amount_minor bigint not null check (list_amount_minor >= 0),
  discount_amount_minor bigint not null check (discount_amount_minor >= 0),
  tax_amount_minor bigint not null check (tax_amount_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (invoice_id, line_number),
  check (line_total_minor = list_amount_minor - discount_amount_minor + tax_amount_minor)
);

create table if not exists public.agilecert_invoice_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.agilecert_institution_invoices(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  paid_amount_minor bigint not null default 0 check (paid_amount_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'part_paid', 'paid', 'overdue', 'waived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, installment_number),
  check (paid_amount_minor <= amount_minor)
);

create trigger agilecert_institution_quotes_set_updated_at
  before update on public.agilecert_institution_quotes
  for each row execute function public.set_updated_at();
create trigger agilecert_institution_invoices_set_updated_at
  before update on public.agilecert_institution_invoices
  for each row execute function public.set_updated_at();
create trigger agilecert_invoice_payment_schedules_set_updated_at
  before update on public.agilecert_invoice_payment_schedules
  for each row execute function public.set_updated_at();

create or replace function public.create_agilecert_institution_quote(
  p_customer_id uuid,
  p_currency text,
  p_purchase_order_reference text,
  p_valid_until date,
  p_notes text,
  p_terms text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_customer public.agilecert_institutional_customers%rowtype;
  v_settings public.agilecert_finance_settings%rowtype;
  v_tax public.agilecert_tax_profiles%rowtype;
  v_quote public.agilecert_institution_quotes%rowtype;
  v_item jsonb;
  v_line integer := 0;
  v_product_type text;
  v_description text;
  v_quantity integer;
  v_unit bigint;
  v_discount_percent numeric;
  v_tax_rate numeric;
  v_list bigint;
  v_discount bigint;
  v_tax_amount bigint;
  v_total bigint;
  v_examination_id uuid;
  v_programme_id uuid;
  v_certificate_product_code text;
  v_subtotal bigint := 0;
  v_discount_total bigint := 0;
  v_tax_total bigint := 0;
  v_grand_total bigint := 0;
begin
  select * into v_customer from public.agilecert_institutional_customers
  where id = p_customer_id and status = 'active';
  if not found then raise exception 'An active institutional customer is required.'; end if;
  select * into v_settings from public.agilecert_finance_settings where singleton;
  select * into v_tax from public.agilecert_tax_profiles
  where id = coalesce(v_customer.tax_profile_id, v_settings.default_tax_profile_id) and is_active;

  if upper(trim(p_currency)) !~ '^[A-Z]{3}$' then raise exception 'A valid currency is required.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one quotation item is required.';
  end if;

  insert into public.agilecert_institution_quotes (
    customer_id, currency, tax_profile_id, purchase_order_reference, valid_until,
    notes, terms, created_by, updated_by
  ) values (
    p_customer_id, upper(trim(p_currency)), v_tax.id,
    nullif(trim(coalesce(p_purchase_order_reference, '')), ''),
    coalesce(p_valid_until, current_date + v_settings.quote_validity_days),
    nullif(trim(coalesce(p_notes, '')), ''), nullif(trim(coalesce(p_terms, '')), ''),
    v_actor, v_actor
  ) returning * into v_quote;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_line := v_line + 1;
    v_product_type := lower(trim(coalesce(v_item ->> 'productType', '')));
    v_description := nullif(trim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::integer, 0);
    v_unit := coalesce(nullif(v_item ->> 'unitAmountMinor', '')::bigint, 0);
    v_discount_percent := coalesce(nullif(v_item ->> 'discountPercent', '')::numeric, v_customer.institutional_discount_percent);
    v_tax_rate := coalesce(nullif(v_item ->> 'taxRatePercent', '')::numeric, coalesce(v_tax.rate_percent, 0));
    v_examination_id := nullif(v_item ->> 'examinationId', '')::uuid;
    v_programme_id := nullif(v_item ->> 'programmeId', '')::uuid;
    v_certificate_product_code := nullif(trim(coalesce(v_item ->> 'certificateProductCode', '')), '');

    if v_product_type not in ('examination', 'certificate', 'service') then raise exception 'Invalid product type on line %.', v_line; end if;
    if v_description is null or v_quantity < 1 or v_unit < 0 then raise exception 'Invalid description, quantity or unit amount on line %.', v_line; end if;
    if v_discount_percent < 0 or v_discount_percent > v_settings.maximum_institutional_discount_percent then
      raise exception 'Discount on line % exceeds the configured institutional maximum.', v_line;
    end if;
    if v_tax_rate < 0 or v_tax_rate > 100 then raise exception 'Invalid tax rate on line %.', v_line; end if;
    if v_product_type = 'examination' and (v_examination_id is null or not exists (
      select 1 from public.examinations where id = v_examination_id and status = 'published'
    )) then raise exception 'A published examination is required on line %.', v_line; end if;
    if v_product_type = 'certificate' and (v_certificate_product_code is null or not exists (
      select 1 from public.agilecert_certificate_products where code = v_certificate_product_code and active
    )) then raise exception 'An active certificate product is required on line %.', v_line; end if;

    v_list := v_unit * v_quantity;
    v_discount := round(v_list * v_discount_percent / 100.0)::bigint;
    v_tax_amount := round((v_list - v_discount) * v_tax_rate / 100.0)::bigint;
    v_total := v_list - v_discount + v_tax_amount;

    insert into public.agilecert_institution_quote_items (
      quote_id, line_number, product_type, examination_id, programme_id,
      certificate_product_code, description, quantity, unit_amount_minor,
      discount_percent, tax_rate_percent, list_amount_minor, discount_amount_minor,
      tax_amount_minor, line_total_minor, metadata
    ) values (
      v_quote.id, v_line, v_product_type, v_examination_id, v_programme_id,
      v_certificate_product_code, v_description, v_quantity, v_unit,
      v_discount_percent, v_tax_rate, v_list, v_discount, v_tax_amount, v_total,
      coalesce(v_item -> 'metadata', '{}'::jsonb)
    );

    v_subtotal := v_subtotal + v_list;
    v_discount_total := v_discount_total + v_discount;
    v_tax_total := v_tax_total + v_tax_amount;
    v_grand_total := v_grand_total + v_total;
  end loop;

  update public.agilecert_institution_quotes set
    subtotal_minor = v_subtotal, discount_amount_minor = v_discount_total,
    tax_amount_minor = v_tax_total, total_amount_minor = v_grand_total,
    updated_by = v_actor, updated_at = now()
  where id = v_quote.id returning * into v_quote;

  perform public.agilecert_record_finance_audit(
    v_actor, v_customer.id, 'institution_quote', v_quote.id::text, 'institution_quote_created',
    jsonb_build_object('quoteNumber', v_quote.quote_number, 'currency', v_quote.currency,
      'totalAmountMinor', v_quote.total_amount_minor, 'itemCount', v_line)
  );

  return jsonb_build_object('id', v_quote.id, 'quoteNumber', v_quote.quote_number,
    'status', v_quote.status, 'currency', v_quote.currency,
    'totalAmountMinor', v_quote.total_amount_minor, 'validUntil', v_quote.valid_until);
exception when others then
  if v_quote.id is not null then delete from public.agilecert_institution_quotes where id = v_quote.id; end if;
  raise;
end;
$$;

create or replace function public.issue_agilecert_institution_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_quote public.agilecert_institution_quotes%rowtype;
begin
  update public.agilecert_institution_quotes set
    status = 'issued', issued_at = now(), updated_by = v_actor, updated_at = now()
  where id = p_quote_id and status = 'draft' and valid_until >= current_date
  returning * into v_quote;
  if not found then raise exception 'Only a current draft quotation may be issued.'; end if;
  perform public.agilecert_record_finance_audit(v_actor, v_quote.customer_id, 'institution_quote', v_quote.id::text,
    'institution_quote_issued', jsonb_build_object('quoteNumber', v_quote.quote_number));
  return jsonb_build_object('id', v_quote.id, 'quoteNumber', v_quote.quote_number, 'status', v_quote.status, 'issuedAt', v_quote.issued_at);
end;
$$;

create or replace function public.decide_agilecert_institution_quote(
  p_quote_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_quote public.agilecert_institution_quotes%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if v_decision not in ('accepted', 'rejected', 'void') then raise exception 'Invalid quotation decision.'; end if;
  update public.agilecert_institution_quotes set
    status = v_decision, decided_at = now(), notes = coalesce(nullif(trim(coalesce(p_note, '')), ''), notes),
    updated_by = v_actor, updated_at = now()
  where id = p_quote_id and status in ('issued', 'accepted') and valid_until >= current_date
  returning * into v_quote;
  if not found then raise exception 'The active issued quotation was not found.'; end if;
  perform public.agilecert_record_finance_audit(v_actor, v_quote.customer_id, 'institution_quote', v_quote.id::text,
    'institution_quote_' || v_decision, jsonb_build_object('quoteNumber', v_quote.quote_number));
  return jsonb_build_object('id', v_quote.id, 'quoteNumber', v_quote.quote_number, 'status', v_quote.status, 'decidedAt', v_quote.decided_at);
end;
$$;

create or replace function public.convert_agilecert_quote_to_invoice(
  p_quote_id uuid,
  p_issue_date date default current_date,
  p_due_date date default null,
  p_payment_schedule jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_quote public.agilecert_institution_quotes%rowtype;
  v_customer public.agilecert_institutional_customers%rowtype;
  v_invoice public.agilecert_institution_invoices%rowtype;
  v_schedule jsonb;
  v_schedule_total bigint := 0;
  v_installment integer := 0;
  v_due date;
  v_amount bigint;
begin
  select * into v_quote from public.agilecert_institution_quotes where id = p_quote_id for update;
  if not found or v_quote.status <> 'accepted' or v_quote.valid_until < current_date then
    raise exception 'Only an accepted current quotation may be converted.';
  end if;
  if exists (select 1 from public.agilecert_institution_invoices where quote_id = p_quote_id) then
    select * into v_invoice from public.agilecert_institution_invoices where quote_id = p_quote_id;
    return jsonb_build_object('id', v_invoice.id, 'invoiceNumber', v_invoice.invoice_number,
      'status', v_invoice.status, 'alreadyConverted', true);
  end if;
  select * into v_customer from public.agilecert_institutional_customers where id = v_quote.customer_id;

  insert into public.agilecert_institution_invoices (
    customer_id, quote_id, currency, tax_profile_id, purchase_order_reference,
    status, subtotal_minor, discount_amount_minor, tax_amount_minor, total_amount_minor,
    paid_amount_minor, credited_amount_minor, balance_amount_minor,
    issue_date, due_date, issued_at, notes, terms, created_by, updated_by
  ) values (
    v_quote.customer_id, v_quote.id, v_quote.currency, v_quote.tax_profile_id,
    v_quote.purchase_order_reference, 'issued', v_quote.subtotal_minor,
    v_quote.discount_amount_minor, v_quote.tax_amount_minor, v_quote.total_amount_minor,
    0, 0, v_quote.total_amount_minor, coalesce(p_issue_date, current_date),
    coalesce(p_due_date, coalesce(p_issue_date, current_date) + v_customer.payment_terms_days),
    now(), v_quote.notes, v_quote.terms, v_actor, v_actor
  ) returning * into v_invoice;

  insert into public.agilecert_institution_invoice_items (
    invoice_id, quote_item_id, line_number, product_type, examination_id, programme_id,
    certificate_product_code, description, quantity, unit_amount_minor, discount_percent,
    tax_rate_percent, list_amount_minor, discount_amount_minor, tax_amount_minor,
    line_total_minor, metadata
  )
  select v_invoice.id, qi.id, qi.line_number, qi.product_type, qi.examination_id, qi.programme_id,
    qi.certificate_product_code, qi.description, qi.quantity, qi.unit_amount_minor,
    qi.discount_percent, qi.tax_rate_percent, qi.list_amount_minor, qi.discount_amount_minor,
    qi.tax_amount_minor, qi.line_total_minor, qi.metadata
  from public.agilecert_institution_quote_items qi where qi.quote_id = v_quote.id;

  if p_payment_schedule is null or jsonb_typeof(p_payment_schedule) <> 'array' or jsonb_array_length(p_payment_schedule) = 0 then
    insert into public.agilecert_invoice_payment_schedules (
      invoice_id, installment_number, due_date, amount_minor, status
    ) values (v_invoice.id, 1, v_invoice.due_date, v_invoice.total_amount_minor, 'pending');
  else
    for v_schedule in select value from jsonb_array_elements(p_payment_schedule)
    loop
      v_installment := v_installment + 1;
      v_due := nullif(v_schedule ->> 'dueDate', '')::date;
      v_amount := coalesce(nullif(v_schedule ->> 'amountMinor', '')::bigint, 0);
      if v_due is null or v_due < v_invoice.issue_date or v_amount <= 0 then
        raise exception 'Invalid payment schedule installment %.', v_installment;
      end if;
      insert into public.agilecert_invoice_payment_schedules (
        invoice_id, installment_number, due_date, amount_minor, status,
        notes
      ) values (
        v_invoice.id, v_installment, v_due, v_amount, 'pending',
        nullif(trim(coalesce(v_schedule ->> 'notes', '')), '')
      );
      v_schedule_total := v_schedule_total + v_amount;
    end loop;
    if v_schedule_total <> v_invoice.total_amount_minor then
      raise exception 'Payment schedule total must equal the invoice total.';
    end if;
  end if;

  update public.agilecert_institution_quotes set status = 'converted', converted_at = now(), updated_by = v_actor, updated_at = now()
  where id = v_quote.id;

  perform public.agilecert_record_finance_audit(v_actor, v_invoice.customer_id, 'institution_invoice', v_invoice.id::text,
    'institution_invoice_created', jsonb_build_object('invoiceNumber', v_invoice.invoice_number,
      'quoteNumber', v_quote.quote_number, 'totalAmountMinor', v_invoice.total_amount_minor));

  return jsonb_build_object('id', v_invoice.id, 'invoiceNumber', v_invoice.invoice_number,
    'status', v_invoice.status, 'currency', v_invoice.currency, 'totalAmountMinor', v_invoice.total_amount_minor,
    'balanceAmountMinor', v_invoice.balance_amount_minor, 'dueDate', v_invoice.due_date);
end;
$$;

commit;