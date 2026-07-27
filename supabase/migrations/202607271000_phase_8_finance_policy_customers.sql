begin;

create or replace function public.agilecert_require_finance_admin()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor and is_active = true;

  if v_role not in ('exam_admin', 'super_admin') then
    raise exception 'Only an examination administrator or Super Administrator may access finance controls.';
  end if;

  return v_actor;
end;
$$;

create or replace function public.agilecert_require_super_admin()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor and is_active = true;

  if v_role <> 'super_admin' then
    raise exception 'Only a Super Administrator may perform this finance action.';
  end if;

  return v_actor;
end;
$$;

create table if not exists public.agilecert_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  rate_percent numeric(7,4) not null default 0 check (rate_percent between 0 and 100),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  registration_number text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agilecert_tax_profiles_code_uidx
  on public.agilecert_tax_profiles (upper(code));
create unique index if not exists agilecert_tax_profiles_one_default_idx
  on public.agilecert_tax_profiles ((is_default)) where is_default and is_active;

insert into public.agilecert_tax_profiles (
  code, name, description, rate_percent, is_default, is_active
)
values (
  'NO-TAX', 'No tax', 'No tax is applied unless an authorised administrator activates a configured tax profile.', 0, true, true
)
on conflict ((upper(code))) do nothing;

create table if not exists public.agilecert_finance_settings (
  singleton boolean primary key default true check (singleton),
  default_currency text not null default 'NGN' check (default_currency ~ '^[A-Z]{3}$'),
  quote_prefix text not null default 'AGQ',
  invoice_prefix text not null default 'AGI',
  receipt_prefix text not null default 'AGR',
  credit_note_prefix text not null default 'AGC',
  refund_prefix text not null default 'AGF',
  quote_validity_days integer not null default 14 check (quote_validity_days between 1 and 180),
  invoice_payment_terms_days integer not null default 14 check (invoice_payment_terms_days between 0 and 365),
  maximum_institutional_discount_percent numeric(7,4) not null default 25 check (maximum_institutional_discount_percent between 0 and 100),
  refund_super_admin_threshold_minor bigint not null default 5000000 check (refund_super_admin_threshold_minor >= 0),
  default_tax_profile_id uuid references public.agilecert_tax_profiles(id) on delete set null,
  allow_partial_payments boolean not null default true,
  allow_overpayments boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agilecert_finance_settings (
  singleton, default_tax_profile_id
)
select true, id
from public.agilecert_tax_profiles
where upper(code) = 'NO-TAX'
limit 1
on conflict (singleton) do nothing;

create table if not exists public.agilecert_institutional_customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique default (
    'ORG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  legal_name text not null,
  trading_name text,
  registration_number text,
  tax_identifier text,
  billing_email text not null,
  billing_phone text,
  billing_address jsonb not null default '{}'::jsonb,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  default_currency text not null default 'NGN' check (default_currency ~ '^[A-Z]{3}$'),
  credit_limit_minor bigint not null default 0 check (credit_limit_minor >= 0),
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 365),
  institutional_discount_percent numeric(7,4) not null default 0 check (institutional_discount_percent between 0 and 100),
  tax_profile_id uuid references public.agilecert_tax_profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'closed')),
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_institutional_customers_status_idx
  on public.agilecert_institutional_customers (status, legal_name);
create unique index if not exists agilecert_institutional_customer_name_uidx
  on public.agilecert_institutional_customers (lower(legal_name));

create table if not exists public.agilecert_institution_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.agilecert_institutional_customers(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  contact_role text not null default 'billing'
    check (contact_role in ('billing', 'sponsor', 'administrator', 'approver', 'other')),
  portal_access boolean not null default false,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, email)
);

create unique index if not exists agilecert_institution_contacts_one_primary_idx
  on public.agilecert_institution_contacts (customer_id)
  where is_primary and is_active;

create table if not exists public.agilecert_finance_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  customer_id uuid references public.agilecert_institutional_customers(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_finance_audit_entity_idx
  on public.agilecert_finance_audit_events (entity_type, entity_id, created_at desc);
create index if not exists agilecert_finance_audit_customer_idx
  on public.agilecert_finance_audit_events (customer_id, created_at desc);

create or replace function public.agilecert_record_finance_audit(
  p_actor_id uuid,
  p_customer_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agilecert_finance_audit_events (
    actor_id, customer_id, entity_type, entity_id, action, metadata
  ) values (
    p_actor_id,
    p_customer_id,
    left(trim(p_entity_type), 100),
    nullif(left(trim(coalesce(p_entity_id, '')), 200), ''),
    left(trim(p_action), 160),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create trigger agilecert_tax_profiles_set_updated_at
  before update on public.agilecert_tax_profiles
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_settings_set_updated_at
  before update on public.agilecert_finance_settings
  for each row execute function public.set_updated_at();
create trigger agilecert_institutional_customers_set_updated_at
  before update on public.agilecert_institutional_customers
  for each row execute function public.set_updated_at();
create trigger agilecert_institution_contacts_set_updated_at
  before update on public.agilecert_institution_contacts
  for each row execute function public.set_updated_at();

create or replace function public.upsert_agilecert_finance_settings(
  p_default_currency text,
  p_quote_validity_days integer,
  p_invoice_payment_terms_days integer,
  p_maximum_institutional_discount_percent numeric,
  p_refund_super_admin_threshold_minor bigint,
  p_default_tax_profile_id uuid,
  p_allow_partial_payments boolean,
  p_allow_overpayments boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_super_admin();
  v_settings public.agilecert_finance_settings%rowtype;
begin
  if upper(trim(p_default_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'A valid three-letter default currency is required.';
  end if;

  if p_default_tax_profile_id is not null and not exists (
    select 1 from public.agilecert_tax_profiles where id = p_default_tax_profile_id and is_active
  ) then
    raise exception 'The selected active tax profile was not found.';
  end if;

  insert into public.agilecert_finance_settings (
    singleton, default_currency, quote_validity_days, invoice_payment_terms_days,
    maximum_institutional_discount_percent, refund_super_admin_threshold_minor,
    default_tax_profile_id, allow_partial_payments, allow_overpayments, updated_by
  ) values (
    true, upper(trim(p_default_currency)), p_quote_validity_days, p_invoice_payment_terms_days,
    p_maximum_institutional_discount_percent, p_refund_super_admin_threshold_minor,
    p_default_tax_profile_id, coalesce(p_allow_partial_payments, true),
    coalesce(p_allow_overpayments, false), v_actor
  )
  on conflict (singleton) do update set
    default_currency = excluded.default_currency,
    quote_validity_days = excluded.quote_validity_days,
    invoice_payment_terms_days = excluded.invoice_payment_terms_days,
    maximum_institutional_discount_percent = excluded.maximum_institutional_discount_percent,
    refund_super_admin_threshold_minor = excluded.refund_super_admin_threshold_minor,
    default_tax_profile_id = excluded.default_tax_profile_id,
    allow_partial_payments = excluded.allow_partial_payments,
    allow_overpayments = excluded.allow_overpayments,
    updated_by = v_actor,
    updated_at = now()
  returning * into v_settings;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'finance_settings', 'singleton', 'finance_settings_updated',
    jsonb_build_object('defaultCurrency', v_settings.default_currency)
  );

  return jsonb_build_object(
    'defaultCurrency', v_settings.default_currency,
    'quoteValidityDays', v_settings.quote_validity_days,
    'invoicePaymentTermsDays', v_settings.invoice_payment_terms_days,
    'maximumInstitutionalDiscountPercent', v_settings.maximum_institutional_discount_percent,
    'refundSuperAdminThresholdMinor', v_settings.refund_super_admin_threshold_minor,
    'defaultTaxProfileId', v_settings.default_tax_profile_id,
    'allowPartialPayments', v_settings.allow_partial_payments,
    'allowOverpayments', v_settings.allow_overpayments
  );
end;
$$;

create or replace function public.upsert_agilecert_tax_profile(
  p_tax_profile_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_rate_percent numeric,
  p_country_code text,
  p_registration_number text,
  p_is_default boolean,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_super_admin();
  v_profile public.agilecert_tax_profiles%rowtype;
begin
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Tax profile code and name are required.';
  end if;
  if p_rate_percent < 0 or p_rate_percent > 100 then
    raise exception 'Tax rate must be between 0 and 100.';
  end if;

  if coalesce(p_is_default, false) then
    update public.agilecert_tax_profiles set is_default = false, updated_by = v_actor where is_default;
  end if;

  if p_tax_profile_id is null then
    insert into public.agilecert_tax_profiles (
      code, name, description, rate_percent, country_code, registration_number,
      is_default, is_active, created_by, updated_by
    ) values (
      upper(trim(p_code)), trim(p_name), nullif(trim(coalesce(p_description, '')), ''),
      p_rate_percent, nullif(upper(trim(coalesce(p_country_code, ''))), ''),
      nullif(trim(coalesce(p_registration_number, '')), ''), coalesce(p_is_default, false),
      coalesce(p_is_active, true), v_actor, v_actor
    ) returning * into v_profile;
  else
    update public.agilecert_tax_profiles set
      code = upper(trim(p_code)), name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      rate_percent = p_rate_percent,
      country_code = nullif(upper(trim(coalesce(p_country_code, ''))), ''),
      registration_number = nullif(trim(coalesce(p_registration_number, '')), ''),
      is_default = coalesce(p_is_default, false), is_active = coalesce(p_is_active, true),
      updated_by = v_actor, updated_at = now()
    where id = p_tax_profile_id
    returning * into v_profile;
    if not found then raise exception 'The tax profile was not found.'; end if;
  end if;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'tax_profile', v_profile.id::text, 'tax_profile_saved',
    jsonb_build_object('code', v_profile.code, 'ratePercent', v_profile.rate_percent)
  );

  return jsonb_build_object('id', v_profile.id, 'code', v_profile.code, 'name', v_profile.name,
    'ratePercent', v_profile.rate_percent, 'isDefault', v_profile.is_default, 'isActive', v_profile.is_active);
end;
$$;

create or replace function public.upsert_agilecert_institutional_customer(
  p_customer_id uuid,
  p_legal_name text,
  p_trading_name text,
  p_registration_number text,
  p_tax_identifier text,
  p_billing_email text,
  p_billing_phone text,
  p_billing_address jsonb,
  p_country_code text,
  p_default_currency text,
  p_credit_limit_minor bigint,
  p_payment_terms_days integer,
  p_institutional_discount_percent numeric,
  p_tax_profile_id uuid,
  p_status text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_settings public.agilecert_finance_settings%rowtype;
  v_customer public.agilecert_institutional_customers%rowtype;
  v_status text := lower(trim(coalesce(p_status, 'draft')));
begin
  select * into v_settings from public.agilecert_finance_settings where singleton;
  if nullif(trim(p_legal_name), '') is null or nullif(trim(p_billing_email), '') is null then
    raise exception 'Legal name and billing email are required.';
  end if;
  if v_status not in ('draft', 'active', 'suspended', 'closed') then
    raise exception 'Invalid institutional customer status.';
  end if;
  if p_institutional_discount_percent < 0
     or p_institutional_discount_percent > v_settings.maximum_institutional_discount_percent then
    raise exception 'Institutional discount exceeds the configured maximum of % percent.', v_settings.maximum_institutional_discount_percent;
  end if;
  if upper(trim(p_default_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'A valid three-letter currency is required.';
  end if;

  if p_customer_id is null then
    insert into public.agilecert_institutional_customers (
      legal_name, trading_name, registration_number, tax_identifier, billing_email,
      billing_phone, billing_address, country_code, default_currency, credit_limit_minor,
      payment_terms_days, institutional_discount_percent, tax_profile_id, status, notes,
      created_by, updated_by
    ) values (
      trim(p_legal_name), nullif(trim(coalesce(p_trading_name, '')), ''),
      nullif(trim(coalesce(p_registration_number, '')), ''), nullif(trim(coalesce(p_tax_identifier, '')), ''),
      lower(trim(p_billing_email)), nullif(trim(coalesce(p_billing_phone, '')), ''),
      coalesce(p_billing_address, '{}'::jsonb), nullif(upper(trim(coalesce(p_country_code, ''))), ''),
      upper(trim(p_default_currency)), greatest(0, coalesce(p_credit_limit_minor, 0)),
      greatest(0, least(coalesce(p_payment_terms_days, v_settings.invoice_payment_terms_days), 365)),
      p_institutional_discount_percent, p_tax_profile_id, v_status,
      nullif(trim(coalesce(p_notes, '')), ''), v_actor, v_actor
    ) returning * into v_customer;
  else
    update public.agilecert_institutional_customers set
      legal_name = trim(p_legal_name), trading_name = nullif(trim(coalesce(p_trading_name, '')), ''),
      registration_number = nullif(trim(coalesce(p_registration_number, '')), ''),
      tax_identifier = nullif(trim(coalesce(p_tax_identifier, '')), ''),
      billing_email = lower(trim(p_billing_email)), billing_phone = nullif(trim(coalesce(p_billing_phone, '')), ''),
      billing_address = coalesce(p_billing_address, '{}'::jsonb),
      country_code = nullif(upper(trim(coalesce(p_country_code, ''))), ''),
      default_currency = upper(trim(p_default_currency)), credit_limit_minor = greatest(0, coalesce(p_credit_limit_minor, 0)),
      payment_terms_days = greatest(0, least(coalesce(p_payment_terms_days, v_settings.invoice_payment_terms_days), 365)),
      institutional_discount_percent = p_institutional_discount_percent,
      tax_profile_id = p_tax_profile_id, status = v_status,
      notes = nullif(trim(coalesce(p_notes, '')), ''), updated_by = v_actor, updated_at = now()
    where id = p_customer_id
    returning * into v_customer;
    if not found then raise exception 'The institutional customer was not found.'; end if;
  end if;

  perform public.agilecert_record_finance_audit(
    v_actor, v_customer.id, 'institutional_customer', v_customer.id::text,
    'institutional_customer_saved', jsonb_build_object('status', v_customer.status)
  );

  return jsonb_build_object(
    'id', v_customer.id, 'customerCode', v_customer.customer_code,
    'legalName', v_customer.legal_name, 'status', v_customer.status,
    'defaultCurrency', v_customer.default_currency
  );
end;
$$;

create or replace function public.upsert_agilecert_institution_contact(
  p_contact_id uuid,
  p_customer_id uuid,
  p_profile_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_contact_role text,
  p_portal_access boolean,
  p_is_primary boolean,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.agilecert_require_finance_admin();
  v_contact public.agilecert_institution_contacts%rowtype;
  v_role text := lower(trim(coalesce(p_contact_role, 'billing')));
begin
  if not exists (select 1 from public.agilecert_institutional_customers where id = p_customer_id) then
    raise exception 'The institutional customer was not found.';
  end if;
  if nullif(trim(p_full_name), '') is null or nullif(trim(p_email), '') is null then
    raise exception 'Contact name and email are required.';
  end if;
  if v_role not in ('billing', 'sponsor', 'administrator', 'approver', 'other') then
    raise exception 'Invalid institutional contact role.';
  end if;
  if p_profile_id is not null and not exists (select 1 from public.profiles where id = p_profile_id and is_active) then
    raise exception 'The linked active portal profile was not found.';
  end if;

  if coalesce(p_is_primary, false) then
    update public.agilecert_institution_contacts set is_primary = false, updated_by = v_actor
    where customer_id = p_customer_id and is_primary;
  end if;

  if p_contact_id is null then
    insert into public.agilecert_institution_contacts (
      customer_id, profile_id, full_name, email, phone, contact_role,
      portal_access, is_primary, is_active, created_by, updated_by
    ) values (
      p_customer_id, p_profile_id, trim(p_full_name), lower(trim(p_email)),
      nullif(trim(coalesce(p_phone, '')), ''), v_role, coalesce(p_portal_access, false),
      coalesce(p_is_primary, false), coalesce(p_is_active, true), v_actor, v_actor
    ) returning * into v_contact;
  else
    update public.agilecert_institution_contacts set
      profile_id = p_profile_id, full_name = trim(p_full_name), email = lower(trim(p_email)),
      phone = nullif(trim(coalesce(p_phone, '')), ''), contact_role = v_role,
      portal_access = coalesce(p_portal_access, false), is_primary = coalesce(p_is_primary, false),
      is_active = coalesce(p_is_active, true), updated_by = v_actor, updated_at = now()
    where id = p_contact_id and customer_id = p_customer_id
    returning * into v_contact;
    if not found then raise exception 'The institutional contact was not found.'; end if;
  end if;

  perform public.agilecert_record_finance_audit(
    v_actor, p_customer_id, 'institution_contact', v_contact.id::text,
    'institution_contact_saved', jsonb_build_object('role', v_contact.contact_role, 'portalAccess', v_contact.portal_access)
  );

  return jsonb_build_object('id', v_contact.id, 'customerId', v_contact.customer_id,
    'fullName', v_contact.full_name, 'email', v_contact.email, 'contactRole', v_contact.contact_role,
    'portalAccess', v_contact.portal_access, 'isPrimary', v_contact.is_primary, 'isActive', v_contact.is_active);
end;
$$;

commit;