\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  full_name text not null,
  email text not null unique,
  role text not null,
  candidate_code text,
  is_active boolean not null default true
);

create table public.programmes (
  id uuid primary key,
  code text not null unique
);

create table public.examinations (
  id uuid primary key,
  programme_id uuid not null references public.programmes(id),
  title text not null,
  pass_mark numeric(5,2) not null default 70
);

create table public.attempts (
  id uuid primary key,
  candidate_id uuid not null references public.profiles(id),
  examination_id uuid not null references public.examinations(id),
  percentage numeric(5,2) not null default 0,
  status text not null,
  suspicious_score numeric(5,2) not null default 0,
  submitted_at timestamptz,
  graded_at timestamptz
);

create table public.agilecert_candidate_profiles (
  user_id uuid primary key references public.profiles(id),
  legal_name text,
  phone text,
  country_code text,
  preferred_currency text,
  preferred_language text not null default 'en',
  timezone text,
  professional_headline text,
  employer text,
  industry text,
  education_summary text,
  skills text[] not null default '{}',
  certification_interests text[] not null default '{}',
  public_profile_enabled boolean not null default false,
  marketing_consent boolean not null default false,
  certificate_email_updates boolean not null default true,
  course_recommendation_emails boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.profiles, public.programmes, public.examinations, public.attempts,
  public.agilecert_candidate_profiles to authenticated;

\i /tmp/phase-3-certificate-authority.sql
\i /tmp/phase-4-certificate-commerce.sql

insert into public.profiles (id, full_name, email, role, candidate_code, is_active) values
  ('11111111-1111-4111-8111-111111111111', 'Ada Candidate', 'ada@example.test', 'candidate', 'AGC-0001', true),
  ('22222222-2222-4222-8222-222222222222', 'Bola Candidate', 'bola@example.test', 'candidate', 'AGC-0002', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Exam Administrator', 'admin@example.test', 'exam_admin', null, true);

insert into public.agilecert_candidate_profiles (user_id, legal_name, country_code, preferred_currency) values
  ('11111111-1111-4111-8111-111111111111', 'Ada Candidate', 'NG', 'NGN'),
  ('22222222-2222-4222-8222-222222222222', 'Bola Candidate', 'US', 'USD');

insert into public.programmes (id, code) values
  ('30000000-0000-4000-8000-000000000001', 'PMFC');

insert into public.examinations (id, programme_id, title, pass_mark) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Project Management Foundation Certified Examination', 70);

insert into public.attempts (
  id, candidate_id, examination_id, percentage, status, suspicious_score, submitted_at, graded_at
) values
  ('50000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', 82, 'submitted', 10, now() - interval '2 days', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '40000000-0000-4000-8000-000000000001', 88, 'submitted', 12, now() - interval '10 days', now() - interval '10 days');

do $$
begin
  if (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status = 'eligible' and integrity_status = 'cleared') <> 2 then
    raise exception 'Expected two cleared eligible results.';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare
  workspace jsonb;
begin
  workspace := public.get_my_agilecert_certificate_commerce();
  if workspace->>'marketCurrency' <> 'NGN' then
    raise exception 'Candidate one market currency is incorrect: %', workspace;
  end if;
  if jsonb_array_length(workspace->'offers') <> 2 then
    raise exception 'Candidate one should receive two product cards: %', workspace;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(workspace->'offers') offer
    where offer->>'productCode' = 'achievement'
      and (offer->>'payableAmountMinor')::bigint = 2000000
      and offer->>'pricingWindow' = 'early'
      and (offer->>'checkoutAvailable')::boolean
  ) then raise exception 'Early Achievement offer is incorrect: %', workspace; end if;
  if not exists (
    select 1 from jsonb_array_elements(workspace->'offers') offer
    where offer->>'productCode' = 'professional'
      and not (offer->>'checkoutAvailable')::boolean
      and offer->>'blockedReason' = 'identity_verification_required'
  ) then raise exception 'Professional offer was not safely blocked: %', workspace; end if;
end $$;

select public.create_agilecert_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
  'achievement',
  'NGN'
);
select public.create_agilecert_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
  'achievement',
  'NGN'
);

do $$
declare
  certificate_order public.agilecert_certificate_orders%rowtype;
begin
  if (select count(*) from public.agilecert_certificate_orders where candidate_id = auth.uid() and status = 'pending') <> 1 then
    raise exception 'Candidate one order creation was not idempotent.';
  end if;
  select * into certificate_order
  from public.agilecert_certificate_orders
  where candidate_id = auth.uid() and status = 'pending';
  if certificate_order.currency <> 'NGN'
     or certificate_order.payable_amount_minor <> 2000000
     or certificate_order.pricing_window <> 'early' then
    raise exception 'Candidate one order pricing is incorrect: %', row_to_json(certificate_order);
  end if;

  begin
    perform public.create_agilecert_certificate_order(
      (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
      'achievement',
      'USD'
    );
    raise exception 'Wrong-market currency unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Wrong-market currency unexpectedly succeeded.' then raise; end if;
  end;

  begin
    perform public.create_agilecert_certificate_order(
      (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
      'professional',
      'NGN'
    );
    raise exception 'Professional checkout unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Professional checkout unexpectedly succeeded.' then raise; end if;
  end;

  begin
    perform public.fulfil_paid_agilecert_certificate_order(certificate_order.id, 'FORBIDDEN', '{}'::jsonb);
    raise exception 'Candidate unexpectedly fulfilled a payment.';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);

select public.create_agilecert_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000002'),
  'achievement',
  'USD'
);

do $$
declare
  certificate_order public.agilecert_certificate_orders%rowtype;
begin
  select * into certificate_order
  from public.agilecert_certificate_orders
  where candidate_id = auth.uid() and status = 'pending';
  if certificate_order.currency <> 'USD'
     or certificate_order.payable_amount_minor <> 5000
     or certificate_order.pricing_window <> 'standard' then
    raise exception 'Candidate two standard pricing is incorrect: %', row_to_json(certificate_order);
  end if;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

do $$
begin
  begin
    perform public.issue_agilecert_certificate(
      (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000002')
    );
    raise exception 'Administrator bypassed certificate payment.';
  exception when others then
    if sqlerrm = 'Administrator bypassed certificate payment.' then raise; end if;
  end;
end $$;

reset role;
set role service_role;
select public.fulfil_paid_agilecert_certificate_order(
  (select id from public.agilecert_certificate_orders where candidate_id = '11111111-1111-4111-8111-111111111111' and status = 'pending'),
  'PAYSTACK-TXN-0001',
  '{"status":"success","reference":"scratch"}'::jsonb
);
select public.fulfil_paid_agilecert_certificate_order(
  (select id from public.agilecert_certificate_orders where candidate_id = '11111111-1111-4111-8111-111111111111' and status = 'paid'),
  'PAYSTACK-TXN-0001',
  '{"status":"success","reference":"scratch"}'::jsonb
);

do $$
begin
  if (select count(*) from public.agilecert_certificate_orders where candidate_id = '11111111-1111-4111-8111-111111111111' and status = 'paid') <> 1 then
    raise exception 'Paid order count is not one.';
  end if;
  if (select count(*) from public.agilecert_issued_certificates where candidate_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Paid certificate fulfilment was not idempotent.';
  end if;
  if (select count(*) from public.agilecert_paid_credentials where candidate_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Paid credential fulfilment was not idempotent.';
  end if;
  if not exists (
    select 1 from public.agilecert_paid_credentials
    where candidate_id = '11111111-1111-4111-8111-111111111111'
      and credential_code ~ '^AGC/PMFC/[0-9]{4}/[A-F0-9]{12}$'
      and badge_code ~ '^BADGE-[A-F0-9]{12}$'
      and transcript_code is null
  ) then raise exception 'Achievement credential fields are invalid.'; end if;
end $$;

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  credential_result jsonb;
  badge_result jsonb;
begin
  credential_result := public.verify_agilecert_certificate(
    (select credential_code from public.agilecert_paid_credentials where candidate_id = '11111111-1111-4111-8111-111111111111')
  );
  badge_result := public.verify_agilecert_certificate(
    (select badge_code from public.agilecert_paid_credentials where candidate_id = '11111111-1111-4111-8111-111111111111')
  );
  if not (credential_result->>'found')::boolean
     or not (credential_result->>'valid')::boolean
     or not (credential_result->>'paymentAuthorised')::boolean then
    raise exception 'Credential public verification failed: %', credential_result;
  end if;
  if not (badge_result->>'found')::boolean or not (badge_result->>'valid')::boolean then
    raise exception 'Badge public verification failed: %', badge_result;
  end if;
  if credential_result::text ~* '(candidateEmail|candidateId|payableAmount|transaction|providerPayload)' then
    raise exception 'Public verification exposed private commerce data: %', credential_result;
  end if;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

select public.waive_agilecert_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000002'),
  'achievement',
  'USD',
  'Approved institutional scholarship for scratch validation'
);

do $$
begin
  if not exists (
    select 1 from public.agilecert_certificate_orders
    where candidate_id = '22222222-2222-4222-8222-222222222222'
      and status = 'waived'
      and currency = 'USD'
      and pricing_window = 'waived'
      and payable_amount_minor = 0
      and waiver_reason like 'Approved institutional scholarship%'
  ) then raise exception 'Administrator waiver was not recorded.'; end if;
  if not exists (
    select 1 from public.agilecert_paid_credentials
    where candidate_id = '22222222-2222-4222-8222-222222222222'
  ) then raise exception 'Waiver did not issue a credential.'; end if;

  begin
    perform public.waive_agilecert_certificate_order(
      (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000002'),
      'professional',
      'USD',
      'Professional waiver should remain blocked'
    );
    raise exception 'Professional waiver unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Professional waiver unexpectedly succeeded.' then raise; end if;
  end;
end $$;

select public.upsert_agilecert_certificate_product_price('achievement', 'USD', 4000, 5500, true);

do $$
begin
  if not exists (
    select 1 from public.agilecert_certificate_product_prices
    where product_code = 'achievement'
      and currency = 'USD'
      and early_amount_minor = 4000
      and standard_amount_minor = 5500
  ) then raise exception 'Administrator price update failed.'; end if;
end $$;

select public.set_agilecert_certificate_status(
  (select id from public.agilecert_issued_certificates where candidate_id = '11111111-1111-4111-8111-111111111111'),
  'suspended',
  'Scratch lifecycle validation'
);

do $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.agilecert_paid_credentials
    where candidate_id = '11111111-1111-4111-8111-111111111111'
      and status = 'suspended'
  ) then raise exception 'Credential status did not follow certificate status.'; end if;
  result := public.verify_agilecert_certificate(
    (select credential_code from public.agilecert_paid_credentials where candidate_id = '11111111-1111-4111-8111-111111111111')
  );
  if (result->>'valid')::boolean or result->>'status' <> 'suspended' then
    raise exception 'Suspended credential still verified as active: %', result;
  end if;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
begin
  if (select count(*) from public.agilecert_certificate_orders) <> 1 then
    raise exception 'Candidate RLS exposed another candidate order.';
  end if;
end $$;

reset role;
select 'phase-4-scratch-v2-behaviour-passed' as result;
