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

create schema if not exists storage;
create or replace function storage.foldername(p_name text)
returns text[]
language sql
stable
as $$
  select string_to_array(coalesce(p_name, ''), '/');
$$;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null,
  owner uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

grant usage on schema auth, public, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;

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
grant update on public.agilecert_candidate_profiles to service_role;

\i /tmp/phase-3-certificate-authority.sql
\i /tmp/phase-4-certificate-commerce.sql
\i /tmp/phase-5-identity-assurance.sql
\i /tmp/phase-5-identity-hardening.sql

insert into public.profiles (id, full_name, email, role, candidate_code, is_active) values
  ('11111111-1111-4111-8111-111111111111', 'Ada Candidate', 'ada@example.test', 'candidate', 'AGC-0001', true),
  ('22222222-2222-4222-8222-222222222222', 'Bola Candidate', 'bola@example.test', 'candidate', 'AGC-0002', true),
  ('33333333-3333-4333-8333-333333333333', 'Chika Candidate', 'chika@example.test', 'candidate', 'AGC-0003', true),
  ('44444444-4444-4444-8444-444444444444', 'Diego Candidate', 'diego@example.test', 'candidate', 'AGC-0004', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Exam Administrator', 'admin@example.test', 'exam_admin', null, true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Read Only Auditor', 'auditor@example.test', 'auditor', null, true);

insert into public.agilecert_candidate_profiles (
  user_id, legal_name, phone, country_code, preferred_currency, employer
) values
  ('11111111-1111-4111-8111-111111111111', 'Ada Candidate', '+2347000000001', 'NG', 'NGN', 'IIPM Test Employer'),
  ('22222222-2222-4222-8222-222222222222', 'Bola Candidate', '+12025550102', 'US', 'USD', 'Global Test Corporation'),
  ('33333333-3333-4333-8333-333333333333', 'Chika Candidate', '+2347000000003', 'NG', 'NGN', 'Test Professional Body'),
  ('44444444-4444-4444-8444-444444444444', 'Diego Candidate', '+12025550104', 'US', 'USD', 'Achievement Test Employer');

insert into public.programmes (id, code) values
  ('30000000-0000-4000-8000-000000000001', 'PMFC');

insert into public.examinations (id, programme_id, title, pass_mark) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Project Management Foundation Certified Examination', 70);

insert into public.attempts (
  id, candidate_id, examination_id, percentage, status, suspicious_score, submitted_at, graded_at
) values
  ('50000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', 82, 'submitted', 10, now() - interval '2 days', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '40000000-0000-4000-8000-000000000001', 88, 'submitted', 12, now() - interval '10 days', now() - interval '10 days'),
  ('50000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', '40000000-0000-4000-8000-000000000001', 79, 'submitted', 8, now() - interval '10 days', now() - interval '10 days');

do $$
begin
  if (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status = 'eligible' and integrity_status = 'cleared') <> 3 then
    raise exception 'Expected three cleared eligible results.';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'agilecert-identity-evidence'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['application/pdf', 'image/jpeg', 'image/png']::text[]
  ) then
    raise exception 'Private evidence bucket configuration is incorrect.';
  end if;
end $$;

-- Candidate one: private upload, ownership controls and pre-approval lock.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

insert into storage.objects (bucket_id, name, owner, metadata) values (
  'agilecert-identity-evidence',
  '11111111-1111-4111-8111-111111111111/ada-professional-membership.pdf',
  auth.uid(),
  '{"mimetype":"application/pdf","size":4096}'::jsonb
);

do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner, metadata) values (
      'agilecert-identity-evidence',
      '22222222-2222-4222-8222-222222222222/forbidden.pdf',
      auth.uid(),
      '{"mimetype":"application/pdf","size":1024}'::jsonb
    );
    raise exception 'Candidate inserted evidence into another candidate path.';
  exception when others then
    if sqlerrm = 'Candidate inserted evidence into another candidate path.' then raise; end if;
  end;

  if (select count(*) from storage.objects) <> 1 then
    raise exception 'Candidate storage select policy exposed another path.';
  end if;

  begin
    perform public.create_agilecert_professional_certificate_order(
      (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
      'NGN'
    );
    raise exception 'Professional checkout unexpectedly opened before approval.';
  exception when others then
    if sqlerrm = 'Professional checkout unexpectedly opened before approval.' then raise; end if;
  end;
end $$;

select public.submit_my_agilecert_identity_assurance(
  'professional_body',
  'Integrated Test Management Association',
  'MEM-ADA-001',
  'professional_membership',
  '11111111-1111-4111-8111-111111111111/ada-professional-membership.pdf',
  'ada-professional-membership.pdf',
  'application/pdf',
  4096,
  'Professional membership evidence for manual review.',
  true
);

do $$
declare
  workspace jsonb;
begin
  workspace := public.get_my_agilecert_identity_assurance();
  if workspace->'verification'->>'status' <> 'submitted'
     or (workspace->>'professionalCheckoutUnlocked')::boolean then
    raise exception 'Candidate identity workspace is incorrect before review: %', workspace;
  end if;
  if (select count(*) from public.agilecert_identity_verifications) <> 1 then
    raise exception 'Candidate RLS exposed another identity record.';
  end if;
  begin
    perform public.submit_my_agilecert_identity_assurance(
      'employer', 'Duplicate Employer', null, 'employer_confirmation',
      '11111111-1111-4111-8111-111111111111/ada-professional-membership.pdf',
      'ada-professional-membership.pdf', 'application/pdf', 4096, null, true
    );
    raise exception 'Duplicate active identity submission unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Duplicate active identity submission unexpectedly succeeded.' then raise; end if;
  end;
end $$;

reset role;

-- Auditor cannot use the admin console or inspect evidence.
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);

do $$
begin
  begin
    perform public.get_agilecert_identity_assurance_admin_console(null, 100);
    raise exception 'Auditor unexpectedly opened identity administration.';
  exception when others then
    if sqlerrm = 'Auditor unexpectedly opened identity administration.' then raise; end if;
  end;
  if (select count(*) from storage.objects) <> 0 then
    raise exception 'Auditor unexpectedly read private evidence.';
  end if;
end $$;

reset role;

-- Administrator starts and approves candidate one's review.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

do $$
declare
  v_id uuid := (select id from public.agilecert_identity_verifications where candidate_id = '11111111-1111-4111-8111-111111111111');
begin
  begin
    perform public.review_agilecert_identity_assurance(v_id, 'approved', 'No');
    raise exception 'Approval without a clear note unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Approval without a clear note unexpectedly succeeded.' then raise; end if;
  end;
end $$;

select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '11111111-1111-4111-8111-111111111111'),
  'under_review',
  'Professional membership evidence opened through private signed access.'
);
select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '11111111-1111-4111-8111-111111111111'),
  'approved',
  'Legal name and professional membership evidence manually verified by IIPM.'
);

do $$
begin
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'Administrator did not receive authorised private evidence access.';
  end if;
  if not exists (
    select 1 from public.agilecert_identity_verifications
    where candidate_id = '11111111-1111-4111-8111-111111111111'
      and status = 'approved'
      and reviewed_by = auth.uid()
      and approval_expires_at > now() + interval '23 months'
  ) then
    raise exception 'Administrator approval was not recorded correctly.';
  end if;
end $$;

reset role;

-- Candidate one: approved checkout, idempotency, active-payment guards.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare
  workspace jsonb;
begin
  workspace := public.get_my_agilecert_identity_assurance();
  if not (workspace->>'professionalCheckoutUnlocked')::boolean then
    raise exception 'Approved candidate did not unlock Professional Certificate checkout: %', workspace;
  end if;
end $$;

select public.create_agilecert_professional_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
  'NGN'
);
select public.create_agilecert_professional_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000001'),
  'NGN'
);

do $$
declare
  v_order public.agilecert_certificate_orders%rowtype;
  v_identity uuid := (select id from public.agilecert_identity_verifications where candidate_id = auth.uid() and status = 'approved');
begin
  if (select count(*) from public.agilecert_certificate_orders where candidate_id = auth.uid() and product_code = 'professional' and status = 'pending') <> 1 then
    raise exception 'Professional order creation was not idempotent.';
  end if;
  select * into v_order
  from public.agilecert_certificate_orders
  where candidate_id = auth.uid() and product_code = 'professional' and status = 'pending';
  if v_order.currency <> 'NGN'
     or v_order.payable_amount_minor <> 5000000
     or v_order.pricing_window <> 'early'
     or (v_order.metadata->>'identityVerificationId')::uuid <> v_identity then
    raise exception 'Professional order pricing or identity binding is incorrect: %', row_to_json(v_order);
  end if;

  begin
    perform public.withdraw_my_agilecert_identity_assurance('Attempt during active order');
    raise exception 'Identity withdrawal unexpectedly succeeded during active payment.';
  exception when others then
    if sqlerrm = 'Identity withdrawal unexpectedly succeeded during active payment.' then raise; end if;
  end;
end $$;

reset role;
set role service_role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
begin
  begin
    update public.agilecert_candidate_profiles
    set legal_name = 'Ada Changed During Payment'
    where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'Profile change unexpectedly succeeded during active payment.';
  exception when others then
    if sqlerrm = 'Profile change unexpectedly succeeded during active payment.' then raise; end if;
  end;
end $$;

select public.fulfil_paid_agilecert_certificate_order(
  (select id from public.agilecert_certificate_orders where candidate_id = '11111111-1111-4111-8111-111111111111' and product_code = 'professional' and status = 'pending'),
  'PAYSTACK-PRO-ADA-001',
  '{"status":"success","reference":"professional-ada"}'::jsonb
);
select public.fulfil_paid_agilecert_certificate_order(
  (select id from public.agilecert_certificate_orders where candidate_id = '11111111-1111-4111-8111-111111111111' and product_code = 'professional' and status = 'paid'),
  'PAYSTACK-PRO-ADA-001',
  '{"status":"success","reference":"professional-ada"}'::jsonb
);

do $$
declare
  v_identity uuid := (select id from public.agilecert_identity_verifications where candidate_id = '11111111-1111-4111-8111-111111111111' and status = 'approved');
begin
  if (select count(*) from public.agilecert_issued_certificates where candidate_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Professional certificate fulfilment was not idempotent.';
  end if;
  if not exists (
    select 1
    from public.agilecert_paid_credentials pc
    join public.agilecert_issued_certificates c on c.id = pc.certificate_id
    where pc.candidate_id = '11111111-1111-4111-8111-111111111111'
      and pc.product_code = 'professional'
      and pc.transcript_code is not null
      and c.certificate_title = 'Professional Certificate'
      and (pc.metadata->>'identityVerificationId')::uuid = v_identity
      and (c.metadata->>'identityVerificationId')::uuid = v_identity
      and pc.metadata->>'identityVerificationMethod' = 'manual_iipm_review'
  ) then
    raise exception 'Professional credential identity metadata or transcript is incorrect.';
  end if;
  if not exists (
    select 1 from public.agilecert_certificate_products
    where code = 'professional' and requires_identity_verification = true
  ) then
    raise exception 'Professional product identity requirement was not restored after issuance.';
  end if;
end $$;

-- Profile change after completed fulfilment expires the approval but preserves credential snapshot.
update public.agilecert_candidate_profiles
set legal_name = 'Ada Candidate Updated'
where user_id = '11111111-1111-4111-8111-111111111111';

do $$
begin
  if not exists (
    select 1 from public.agilecert_identity_verifications
    where candidate_id = '11111111-1111-4111-8111-111111111111'
      and status = 'expired'
      and metadata->>'expiredReason' = 'candidate_profile_changed'
  ) then
    raise exception 'Approved identity was not invalidated after profile change.';
  end if;
  if not exists (
    select 1 from public.agilecert_issued_certificates
    where candidate_id = '11111111-1111-4111-8111-111111111111'
      and holder_name = 'Ada Candidate'
  ) then
    raise exception 'Issued credential snapshot changed after profile edit.';
  end if;
end $$;

reset role;

-- Candidate two: bind an order to approval A, create approval B, and ensure fulfilment cannot switch records.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
insert into storage.objects (bucket_id, name, owner, metadata) values (
  'agilecert-identity-evidence',
  '22222222-2222-4222-8222-222222222222/bola-employer-letter.pdf',
  auth.uid(),
  '{"mimetype":"application/pdf","size":5000}'::jsonb
);
select public.submit_my_agilecert_identity_assurance(
  'employer', 'Global Test Corporation', 'EMP-BOLA-002',
  'employer_confirmation',
  '22222222-2222-4222-8222-222222222222/bola-employer-letter.pdf',
  'bola-employer-letter.pdf', 'application/pdf', 5000,
  'Employer confirmation for manual review.', true
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '22222222-2222-4222-8222-222222222222'),
  'under_review', 'Employer evidence opened and compared with the profile.'
);
select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '22222222-2222-4222-8222-222222222222'),
  'approved', 'Employer evidence and legal name manually verified by IIPM.'
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select public.create_agilecert_professional_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000002'),
  'USD'
);
reset role;

set role service_role;
do $$
declare
  v_old public.agilecert_identity_verifications%rowtype;
begin
  select * into v_old
  from public.agilecert_identity_verifications
  where candidate_id = '22222222-2222-4222-8222-222222222222' and status = 'approved';

  update public.agilecert_identity_verifications
  set status = 'expired', approval_expires_at = now(), updated_at = now()
  where id = v_old.id;

  insert into public.agilecert_identity_verifications (
    candidate_id, status, legal_name_snapshot, phone_snapshot, country_code_snapshot,
    affiliation_type, affiliation_name, affiliation_reference, evidence_category,
    evidence_object_path, evidence_filename, evidence_mime_type, evidence_size_bytes,
    candidate_notes, attested_at, submitted_at, review_started_at, reviewed_at,
    reviewed_by, review_note, approval_expires_at, supersedes_id, metadata
  ) values (
    v_old.candidate_id, 'approved', v_old.legal_name_snapshot, v_old.phone_snapshot,
    v_old.country_code_snapshot, v_old.affiliation_type, v_old.affiliation_name,
    'EMP-BOLA-NEW', v_old.evidence_category, v_old.evidence_object_path,
    v_old.evidence_filename, v_old.evidence_mime_type, v_old.evidence_size_bytes,
    'Replacement approval for exact-binding test', now(), now(), now(), now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Replacement approval must not fulfil the order linked to the old record.',
    now() + interval '2 years', v_old.id,
    '{"verificationMethod":"manual_iipm_review"}'::jsonb
  );

  begin
    perform public.fulfil_paid_agilecert_certificate_order(
      (select id from public.agilecert_certificate_orders where candidate_id = v_old.candidate_id and product_code = 'professional' and status = 'pending'),
      'PAYSTACK-PRO-BOLA-002',
      '{"status":"success"}'::jsonb
    );
    raise exception 'Order unexpectedly fulfilled against a replacement identity record.';
  exception when others then
    if sqlerrm = 'Order unexpectedly fulfilled against a replacement identity record.' then raise; end if;
  end;

  if not exists (
    select 1 from public.agilecert_certificate_orders
    where candidate_id = v_old.candidate_id and product_code = 'professional' and status = 'pending'
  ) then
    raise exception 'Failed exact-binding fulfilment did not roll the order back to pending.';
  end if;
end $$;
reset role;

-- Candidate three: changes requested, direct resubmission, supersession and accurate withdrawal audit.
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('agilecert-identity-evidence', '33333333-3333-4333-8333-333333333333/chika-first.pdf', auth.uid(), '{"mimetype":"application/pdf","size":3000}'::jsonb),
  ('agilecert-identity-evidence', '33333333-3333-4333-8333-333333333333/chika-second.pdf', auth.uid(), '{"mimetype":"application/pdf","size":3500}'::jsonb);
select public.submit_my_agilecert_identity_assurance(
  'professional_body', 'Test Professional Body', 'CHIKA-FIRST',
  'professional_membership',
  '33333333-3333-4333-8333-333333333333/chika-first.pdf',
  'chika-first.pdf', 'application/pdf', 3000, null, true
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '33333333-3333-4333-8333-333333333333'),
  'under_review', 'First professional membership evidence opened for review.'
);
select public.review_agilecert_identity_assurance(
  (select id from public.agilecert_identity_verifications where candidate_id = '33333333-3333-4333-8333-333333333333'),
  'changes_requested', 'Upload a clearer professional membership document.'
);
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
select public.submit_my_agilecert_identity_assurance(
  'professional_body', 'Test Professional Body', 'CHIKA-SECOND',
  'professional_membership',
  '33333333-3333-4333-8333-333333333333/chika-second.pdf',
  'chika-second.pdf', 'application/pdf', 3500,
  'Replacement evidence after reviewer feedback.', true
);

do $$
begin
  if not exists (
    select 1 from public.agilecert_identity_verifications current
    join public.agilecert_identity_verifications previous on previous.id = current.supersedes_id
    where current.candidate_id = auth.uid()
      and current.status = 'submitted'
      and previous.status = 'withdrawn'
      and previous.affiliation_reference = 'CHIKA-FIRST'
  ) then
    raise exception 'Changes-requested resubmission did not supersede the previous record.';
  end if;
end $$;

select public.withdraw_my_agilecert_identity_assurance('Candidate is replacing the submission later.');

do $$
begin
  if not exists (
    select 1 from public.agilecert_identity_verification_audits
    where candidate_id = auth.uid()
      and action = 'identity_assurance_withdrawn'
      and metadata->>'previousStatus' = 'submitted'
  ) then
    raise exception 'Withdrawal audit did not retain the previous status.';
  end if;
end $$;
reset role;

-- Phase 4 Achievement regression remains independent of identity assurance.
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
select public.create_agilecert_certificate_order(
  (select id from public.agilecert_certificate_eligibility_records where attempt_id = '50000000-0000-4000-8000-000000000004'),
  'achievement',
  'USD'
);
reset role;

set role service_role;
select public.fulfil_paid_agilecert_certificate_order(
  (select id from public.agilecert_certificate_orders where candidate_id = '44444444-4444-4444-8444-444444444444' and product_code = 'achievement' and status = 'pending'),
  'PAYSTACK-ACH-DIEGO-004',
  '{"status":"success","reference":"achievement-regression"}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.agilecert_paid_credentials
    where candidate_id = '44444444-4444-4444-8444-444444444444'
      and product_code = 'achievement'
      and transcript_code is null
  ) then
    raise exception 'Phase 4 Achievement fulfilment regressed.';
  end if;
end $$;
reset role;

-- Public verification remains privacy bounded.
set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  v_result jsonb;
begin
  v_result := public.verify_agilecert_certificate(
    (select credential_code from public.agilecert_paid_credentials where candidate_id = '11111111-1111-4111-8111-111111111111')
  );
  if not (v_result->>'found')::boolean or not (v_result->>'valid')::boolean then
    raise exception 'Professional credential public verification failed: %', v_result;
  end if;
  if v_result::text ~* '(evidenceObjectPath|evidenceFilename|reviewNote|phoneSnapshot|candidateEmail|identityReviewerId|providerPayload)' then
    raise exception 'Public verification exposed private identity or commerce data: %', v_result;
  end if;
end $$;
reset role;

select 'phase-5-identity-assurance-behaviour-passed' as result;
