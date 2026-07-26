begin;

-- Original Roadmap Phase 4, unit 1 of 4:
-- credential lifecycle fields, policies, record tables, badge assertions and backfill.

alter table public.agilecert_paid_credentials
  add column if not exists valid_from timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists renewal_due_at timestamptz,
  add column if not exists last_renewed_at timestamptz,
  add column if not exists renewal_count integer not null default 0,
  add column if not exists badge_assertion jsonb not null default '{}'::jsonb,
  add column if not exists lifecycle_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agilecert_paid_credentials'::regclass
      and conname = 'agilecert_paid_credentials_renewal_count_check'
  ) then
    alter table public.agilecert_paid_credentials
      add constraint agilecert_paid_credentials_renewal_count_check
      check (renewal_count >= 0);
  end if;
end;
$$;

create table if not exists public.agilecert_credential_policies (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  product_code text not null
    references public.agilecert_certificate_products(code) on delete cascade,
  validity_months integer check (validity_months is null or validity_months between 1 and 120),
  renewal_window_days integer not null default 90
    check (renewal_window_days between 1 and 730),
  cpd_hours_required numeric(7,2) not null default 0
    check (cpd_hours_required between 0 and 10000),
  share_link_default_days integer not null default 30
    check (share_link_default_days between 1 and 365),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programme_id, product_code)
);

insert into public.agilecert_credential_policies (
  programme_id,
  product_code,
  validity_months,
  renewal_window_days,
  cpd_hours_required,
  share_link_default_days,
  active
)
select
  programme.id,
  product.code,
  null,
  90,
  0,
  30,
  true
from public.programmes programme
cross join public.agilecert_certificate_products product
on conflict (programme_id, product_code) do nothing;

create table if not exists public.agilecert_candidate_transcripts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  transcript_code text not null unique,
  public_enabled boolean not null default false,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.agilecert_cpd_records (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  credential_id uuid references public.agilecert_paid_credentials(id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 240),
  provider text not null check (length(trim(provider)) between 2 and 240),
  activity_type text not null check (activity_type in (
    'course', 'workshop', 'conference', 'webinar', 'professional_practice',
    'research', 'publication', 'mentoring', 'volunteering', 'other'
  )),
  completed_on date not null,
  hours numeric(7,2) not null check (hours > 0 and hours <= 1000),
  evidence_reference text,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'approved', 'changes_requested', 'rejected'
  )),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_credential_renewals (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.agilecert_paid_credentials(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'changes_requested', 'rejected', 'completed', 'cancelled'
  )),
  current_expires_at timestamptz not null,
  proposed_expires_at timestamptz not null,
  required_cpd_hours numeric(7,2) not null default 0,
  approved_cpd_hours numeric(7,2) not null default 0,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agilecert_credential_renewals_open_unique_idx
  on public.agilecert_credential_renewals(credential_id)
  where status in ('pending', 'changes_requested');

create table if not exists public.agilecert_credential_share_links (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  credential_id uuid references public.agilecert_paid_credentials(id) on delete cascade,
  scope text not null check (scope in ('credential', 'transcript')),
  share_code text not null unique,
  label text not null default 'Professional verification link'
    check (length(trim(label)) between 3 and 160),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  access_count bigint not null default 0 check (access_count >= 0),
  last_accessed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (scope = 'credential' and credential_id is not null)
    or (scope = 'transcript' and credential_id is null)
  )
);

create table if not exists public.agilecert_credential_audit_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid references public.agilecert_paid_credentials(id) on delete set null,
  candidate_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  share_link_id uuid references public.agilecert_credential_share_links(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_cpd_candidate_idx
  on public.agilecert_cpd_records(candidate_id, completed_on desc);
create index if not exists agilecert_cpd_review_idx
  on public.agilecert_cpd_records(status, submitted_at desc);
create index if not exists agilecert_renewal_candidate_idx
  on public.agilecert_credential_renewals(candidate_id, requested_at desc);
create index if not exists agilecert_share_candidate_idx
  on public.agilecert_credential_share_links(candidate_id, created_at desc);
create index if not exists agilecert_share_code_idx
  on public.agilecert_credential_share_links(share_code, expires_at);
create index if not exists agilecert_credential_audit_created_idx
  on public.agilecert_credential_audit_events(created_at desc);
create index if not exists agilecert_credential_audit_candidate_idx
  on public.agilecert_credential_audit_events(candidate_id, created_at desc);

create or replace function public.agilecert_credential_effective_status(
  p_credential_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when certificate.status = 'revoked' or credential.status = 'revoked' then 'revoked'
    when certificate.status = 'suspended' or credential.status = 'suspended' then 'suspended'
    when credential.expires_at is not null and credential.expires_at <= now() then 'expired'
    else 'active'
  end
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where credential.id = p_credential_id;
$$;

create or replace function public.agilecert_build_badge_assertion(
  p_credential_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_credential public.agilecert_paid_credentials%rowtype;
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_product public.agilecert_certificate_products%rowtype;
  v_status text;
begin
  select * into v_credential
  from public.agilecert_paid_credentials
  where id = p_credential_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select * into v_certificate
  from public.agilecert_issued_certificates
  where id = v_credential.certificate_id;

  select * into v_product
  from public.agilecert_certificate_products
  where code = v_credential.product_code;

  v_status := public.agilecert_credential_effective_status(v_credential.id);

  return jsonb_build_object(
    '@context', jsonb_build_array(
      'https://www.w3.org/2018/credentials/v1',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
    ),
    'type', jsonb_build_array('VerifiableCredential', 'OpenBadgeCredential'),
    'id', v_credential.verification_url,
    'name', v_credential.linkedin_credential_name,
    'issuer', jsonb_build_object(
      'type', jsonb_build_array('Profile'),
      'id', 'https://iipmi.org',
      'name', 'Integrated Institute of Professional Management (IIPM)'
    ),
    'validFrom', coalesce(v_credential.valid_from, v_credential.issued_at),
    'validUntil', v_credential.expires_at,
    'credentialSubject', jsonb_build_object(
      'type', jsonb_build_array('AchievementSubject'),
      'identifier', v_credential.credential_code,
      'name', v_certificate.holder_name,
      'achievement', jsonb_build_object(
        'type', jsonb_build_array('Achievement'),
        'id', 'urn:agilecert:badge:' || v_credential.badge_code,
        'name', v_certificate.certificate_title,
        'description', coalesce(v_product.description, v_certificate.examination_title),
        'achievementType', case
          when v_credential.product_code = 'professional' then 'Certification'
          else 'Assessment'
        end,
        'criteria', jsonb_build_object(
          'narrative', format(
            'Passed %s with a score of %s%% against a required pass mark of %s%%.',
            v_certificate.examination_title,
            trim(to_char(v_certificate.score, 'FM999990.00')),
            trim(to_char(v_certificate.pass_mark, 'FM999990.00'))
          )
        )
      )
    ),
    'credentialStatus', jsonb_build_object(
      'id', v_credential.verification_url,
      'type', 'AgileCertCredentialStatus',
      'status', v_status
    ),
    'evidence', jsonb_build_array(jsonb_build_object(
      'id', v_credential.verification_url,
      'type', jsonb_build_array('Evidence'),
      'name', v_certificate.examination_title
    )),
    'agileCert', jsonb_build_object(
      'credentialCode', v_credential.credential_code,
      'badgeCode', v_credential.badge_code,
      'certificateNumber', v_certificate.certificate_number,
      'programmeCode', v_certificate.programme_code,
      'productCode', v_credential.product_code,
      'effectiveStatus', v_status
    )
  );
end;
$$;

create or replace function public.agilecert_prepare_paid_credential_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_credential_policies%rowtype;
begin
  select policy.* into v_policy
  from public.agilecert_issued_certificates certificate
  join public.examinations examination on examination.id = certificate.examination_id
  join public.agilecert_credential_policies policy
    on policy.programme_id = examination.programme_id
   and policy.product_code = new.product_code
   and policy.active = true
  where certificate.id = new.certificate_id;

  new.valid_from := coalesce(new.valid_from, new.issued_at, now());

  if found and v_policy.validity_months is not null then
    new.expires_at := coalesce(
      new.expires_at,
      new.valid_from + make_interval(months => v_policy.validity_months)
    );
    new.renewal_due_at := coalesce(
      new.renewal_due_at,
      new.expires_at - make_interval(days => v_policy.renewal_window_days)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_prepare_paid_credential_lifecycle_trigger
  on public.agilecert_paid_credentials;
create trigger agilecert_prepare_paid_credential_lifecycle_trigger
  before insert or update of product_code, certificate_id, valid_from, expires_at
  on public.agilecert_paid_credentials
  for each row
  execute function public.agilecert_prepare_paid_credential_lifecycle();

create or replace function public.agilecert_finalize_paid_credential_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.agilecert_candidate_transcripts (
    candidate_id,
    transcript_code,
    metadata
  ) values (
    new.candidate_id,
    'ATR-' || upper(encode(gen_random_bytes(8), 'hex')),
    jsonb_build_object('createdFromCredentialId', new.id)
  )
  on conflict (candidate_id) do nothing;

  update public.agilecert_paid_credentials
  set badge_assertion = public.agilecert_build_badge_assertion(new.id),
      updated_at = now()
  where id = new.id;

  insert into public.agilecert_credential_audit_events (
    credential_id,
    candidate_id,
    actor_id,
    event_type,
    metadata
  ) values (
    new.id,
    new.candidate_id,
    auth.uid(),
    'credential_wallet_activated',
    jsonb_build_object(
      'productCode', new.product_code,
      'validFrom', new.valid_from,
      'expiresAt', new.expires_at
    )
  );

  return new;
end;
$$;

drop trigger if exists agilecert_finalize_paid_credential_lifecycle_trigger
  on public.agilecert_paid_credentials;
create trigger agilecert_finalize_paid_credential_lifecycle_trigger
  after insert on public.agilecert_paid_credentials
  for each row
  execute function public.agilecert_finalize_paid_credential_lifecycle();

create or replace function public.agilecert_refresh_badge_after_certificate_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agilecert_paid_credentials credential
  set badge_assertion = public.agilecert_build_badge_assertion(credential.id),
      updated_at = now()
  where credential.certificate_id = new.id;
  return new;
end;
$$;

drop trigger if exists agilecert_refresh_badge_after_certificate_change_trigger
  on public.agilecert_issued_certificates;
create trigger agilecert_refresh_badge_after_certificate_change_trigger
  after update of holder_name, certificate_title, examination_title, programme_code,
    score, pass_mark, issue_date, status
  on public.agilecert_issued_certificates
  for each row
  execute function public.agilecert_refresh_badge_after_certificate_change();

-- Existing credentials remain non-expiring until an administrator deliberately
-- configures a validity policy. Only valid_from, transcripts and badge assertions
-- are backfilled here.
update public.agilecert_paid_credentials
set valid_from = coalesce(valid_from, issued_at),
    updated_at = now()
where valid_from is null;

insert into public.agilecert_candidate_transcripts (
  candidate_id,
  transcript_code,
  metadata
)
select distinct
  credential.candidate_id,
  'ATR-' || upper(encode(extensions.gen_random_bytes(8), 'hex')),
  jsonb_build_object('backfilledAt', now())
from public.agilecert_paid_credentials credential
on conflict (candidate_id) do nothing;

update public.agilecert_paid_credentials credential
set badge_assertion = public.agilecert_build_badge_assertion(credential.id),
    updated_at = now();

alter table public.agilecert_credential_policies enable row level security;
alter table public.agilecert_candidate_transcripts enable row level security;
alter table public.agilecert_cpd_records enable row level security;
alter table public.agilecert_credential_renewals enable row level security;
alter table public.agilecert_credential_share_links enable row level security;
alter table public.agilecert_credential_audit_events enable row level security;

revoke all on table public.agilecert_credential_policies from anon, authenticated;
revoke all on table public.agilecert_candidate_transcripts from anon, authenticated;
revoke all on table public.agilecert_cpd_records from anon, authenticated;
revoke all on table public.agilecert_credential_renewals from anon, authenticated;
revoke all on table public.agilecert_credential_share_links from anon, authenticated;
revoke all on table public.agilecert_credential_audit_events from anon, authenticated;

revoke all on function public.agilecert_credential_effective_status(uuid) from public;
revoke all on function public.agilecert_build_badge_assertion(uuid) from public;

grant execute on function public.agilecert_credential_effective_status(uuid) to authenticated;
grant execute on function public.agilecert_build_badge_assertion(uuid) to authenticated;

commit;
