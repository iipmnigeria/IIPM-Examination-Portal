begin;

-- Original Roadmap Phase 4 completion: credential wallet, standards-aligned
-- badge assertions, consolidated transcripts, CPD, expiry/renewal, candidate-
-- controlled sharing and privacy-bounded employer verification.
-- Certificate commerce, Paystack, identity, examination and AI functions remain intact.

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
    'validFrom', to_char(coalesce(v_credential.valid_from, v_credential.issued_at), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'validUntil', case
      when v_credential.expires_at is null then null
      else to_char(v_credential.expires_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    end,
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
  v_programme_id uuid;
  v_policy public.agilecert_credential_policies%rowtype;
begin
  select examination.programme_id into v_programme_id
  from public.agilecert_issued_certificates certificate
  join public.examinations examination on examination.id = certificate.examination_id
  where certificate.id = new.certificate_id;

  select * into v_policy
  from public.agilecert_credential_policies
  where programme_id = v_programme_id
    and product_code = new.product_code
    and active = true;

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
set search_path = public
as $$
begin
  insert into public.agilecert_candidate_transcripts (
    candidate_id,
    transcript_code,
    metadata
  )
  values (
    new.candidate_id,
    'ATR-' || upper(encode(extensions.gen_random_bytes(8), 'hex')),
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
  after insert
  on public.agilecert_paid_credentials
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

-- Backfill lifecycle fields, transcript records and badge assertions without
-- imposing expiry where no administrator-configured policy exists.
update public.agilecert_paid_credentials credential
set valid_from = coalesce(credential.valid_from, credential.issued_at),
    expires_at = coalesce(
      credential.expires_at,
      case when policy.validity_months is null then null
        else coalesce(credential.valid_from, credential.issued_at) +
          make_interval(months => policy.validity_months)
      end
    ),
    renewal_due_at = coalesce(
      credential.renewal_due_at,
      case when policy.validity_months is null then null
        else coalesce(credential.valid_from, credential.issued_at) +
          make_interval(months => policy.validity_months) -
          make_interval(days => policy.renewal_window_days)
      end
    ),
    updated_at = now()
from public.agilecert_issued_certificates certificate
join public.examinations examination on examination.id = certificate.examination_id
left join public.agilecert_credential_policies policy
  on policy.programme_id = examination.programme_id
 and policy.product_code = credential.product_code
 and policy.active = true
where certificate.id = credential.certificate_id;

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

create or replace function public.agilecert_public_credential_payload(
  p_credential_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'credentialId', credential.id,
    'credentialCode', credential.credential_code,
    'badgeCode', credential.badge_code,
    'transcriptCode', credential.transcript_code,
    'productCode', credential.product_code,
    'productTitle', product.title,
    'holderName', certificate.holder_name,
    'certificateNumber', certificate.certificate_number,
    'certificateTitle', certificate.certificate_title,
    'examinationTitle', certificate.examination_title,
    'programmeCode', certificate.programme_code,
    'score', certificate.score,
    'passMark', certificate.pass_mark,
    'issueDate', certificate.issue_date,
    'issuedAt', credential.issued_at,
    'validFrom', coalesce(credential.valid_from, credential.issued_at),
    'expiresAt', credential.expires_at,
    'renewalDueAt', credential.renewal_due_at,
    'effectiveStatus', public.agilecert_credential_effective_status(credential.id),
    'valid', public.agilecert_credential_effective_status(credential.id) = 'active',
    'verificationUrl', credential.verification_url,
    'issuer', 'Integrated Institute of Professional Management (IIPM)',
    'poweredBy', 'AgileCert Global',
    'badgeAssertion', credential.badge_assertion
  ) into v_payload
  from public.agilecert_paid_credentials credential
  join public.agilecert_certificate_products product
    on product.code = credential.product_code
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where credential.id = p_credential_id;

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

create or replace function public.get_my_agilecert_credential_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_credentials jsonb;
  v_history jsonb;
  v_cpd jsonb;
  v_renewals jsonb;
  v_shares jsonb;
  v_transcript jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles
    where id = v_candidate_id
      and role = 'candidate'
      and is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select coalesce(jsonb_agg(
    public.agilecert_public_credential_payload(credential.id)
    || jsonb_build_object(
      'orderId', credential.order_id,
      'linkedinCredentialName', credential.linkedin_credential_name,
      'renewalCount', credential.renewal_count,
      'lastRenewedAt', credential.last_renewed_at,
      'renewalEligible', credential.expires_at is not null
        and credential.renewal_due_at is not null
        and now() >= credential.renewal_due_at
        and public.agilecert_credential_effective_status(credential.id) in ('active', 'expired'),
      'policy', jsonb_build_object(
        'validityMonths', policy.validity_months,
        'renewalWindowDays', coalesce(policy.renewal_window_days, 90),
        'cpdHoursRequired', coalesce(policy.cpd_hours_required, 0),
        'shareLinkDefaultDays', coalesce(policy.share_link_default_days, 30)
      )
    ) order by credential.issued_at desc
  ), '[]'::jsonb)
  into v_credentials
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  join public.examinations examination on examination.id = certificate.examination_id
  left join public.agilecert_credential_policies policy
    on policy.programme_id = examination.programme_id
   and policy.product_code = credential.product_code
   and policy.active = true
  where credential.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attemptId', attempt.id,
    'examinationId', attempt.examination_id,
    'examinationTitle', examination.title,
    'programmeCode', programme.code,
    'attemptStatus', attempt.status,
    'score', coalesce(eligibility.score, attempt.percentage, 0),
    'passMark', coalesce(eligibility.pass_mark, examination.pass_mark, 70),
    'result', case
      when coalesce(eligibility.score, attempt.percentage, 0) >=
           coalesce(eligibility.pass_mark, examination.pass_mark, 70)
        then 'pass'
      else 'not_passed'
    end,
    'integrityStatus', eligibility.integrity_status,
    'completedAt', coalesce(attempt.submitted_at, attempt.graded_at),
    'certificateNumber', certificate.certificate_number,
    'credentialCode', credential.credential_code,
    'credentialStatus', case when credential.id is null then null
      else public.agilecert_credential_effective_status(credential.id)
    end
  ) order by coalesce(attempt.submitted_at, attempt.graded_at, attempt.started_at) desc), '[]'::jsonb)
  into v_history
  from public.attempts attempt
  join public.examinations examination on examination.id = attempt.examination_id
  join public.programmes programme on programme.id = examination.programme_id
  left join public.agilecert_certificate_eligibility_records eligibility
    on eligibility.attempt_id = attempt.id
  left join public.agilecert_issued_certificates certificate
    on certificate.attempt_id = attempt.id
  left join public.agilecert_paid_credentials credential
    on credential.certificate_id = certificate.id
  where attempt.candidate_id = v_candidate_id
    and attempt.status in ('submitted', 'flagged', 'terminated');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cpd.id,
    'credentialId', cpd.credential_id,
    'title', cpd.title,
    'provider', cpd.provider,
    'activityType', cpd.activity_type,
    'completedOn', cpd.completed_on,
    'hours', cpd.hours,
    'evidenceReference', cpd.evidence_reference,
    'status', cpd.status,
    'submittedAt', cpd.submitted_at,
    'reviewedAt', cpd.reviewed_at,
    'reviewReason', cpd.review_reason,
    'createdAt', cpd.created_at,
    'updatedAt', cpd.updated_at
  ) order by cpd.completed_on desc, cpd.created_at desc), '[]'::jsonb)
  into v_cpd
  from public.agilecert_cpd_records cpd
  where cpd.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', renewal.id,
    'credentialId', renewal.credential_id,
    'status', renewal.status,
    'currentExpiresAt', renewal.current_expires_at,
    'proposedExpiresAt', renewal.proposed_expires_at,
    'requiredCpdHours', renewal.required_cpd_hours,
    'approvedCpdHours', renewal.approved_cpd_hours,
    'requestedAt', renewal.requested_at,
    'reviewedAt', renewal.reviewed_at,
    'reviewReason', renewal.review_reason,
    'completedAt', renewal.completed_at
  ) order by renewal.requested_at desc), '[]'::jsonb)
  into v_renewals
  from public.agilecert_credential_renewals renewal
  where renewal.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', share.id,
    'credentialId', share.credential_id,
    'scope', share.scope,
    'shareCode', share.share_code,
    'shareUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || share.share_code,
    'label', share.label,
    'expiresAt', share.expires_at,
    'revokedAt', share.revoked_at,
    'accessCount', share.access_count,
    'lastAccessedAt', share.last_accessed_at,
    'createdAt', share.created_at
  ) order by share.created_at desc), '[]'::jsonb)
  into v_shares
  from public.agilecert_credential_share_links share
  where share.candidate_id = v_candidate_id;

  select jsonb_build_object(
    'id', transcript.id,
    'transcriptCode', transcript.transcript_code,
    'publicEnabled', transcript.public_enabled,
    'issuedAt', transcript.issued_at,
    'updatedAt', transcript.updated_at,
    'verificationUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || transcript.transcript_code
  ) into v_transcript
  from public.agilecert_candidate_transcripts transcript
  where transcript.candidate_id = v_candidate_id;

  return jsonb_build_object(
    'credentials', v_credentials,
    'examinationHistory', v_history,
    'cpdRecords', v_cpd,
    'renewals', v_renewals,
    'shareLinks', v_shares,
    'transcript', coalesce(v_transcript, '{}'::jsonb),
    'counts', jsonb_build_object(
      'credentials', jsonb_array_length(v_credentials),
      'activeCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where credential.candidate_id = v_candidate_id
          and public.agilecert_credential_effective_status(credential.id) = 'active'
      ),
      'examinations', jsonb_array_length(v_history),
      'approvedCpdHours', coalesce((
        select sum(hours) from public.agilecert_cpd_records
        where candidate_id = v_candidate_id and status = 'approved'
      ), 0),
      'pendingRenewals', (
        select count(*) from public.agilecert_credential_renewals
        where candidate_id = v_candidate_id
          and status in ('pending', 'changes_requested')
      ),
      'activeShareLinks', (
        select count(*) from public.agilecert_credential_share_links
        where candidate_id = v_candidate_id
          and revoked_at is null
          and expires_at > now()
      )
    )
  );
end;
$$;

create or replace function public.save_my_agilecert_cpd_record(
  p_title text,
  p_provider text,
  p_activity_type text,
  p_completed_on date,
  p_hours numeric,
  p_credential_id uuid default null,
  p_evidence_reference text default null,
  p_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_record public.agilecert_cpd_records%rowtype;
  v_activity_type text := lower(trim(coalesce(p_activity_type, '')));
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if length(trim(coalesce(p_title, ''))) < 3
     or length(trim(coalesce(p_provider, ''))) < 2 then
    raise exception 'Enter a valid CPD title and provider.';
  end if;

  if v_activity_type not in (
    'course', 'workshop', 'conference', 'webinar', 'professional_practice',
    'research', 'publication', 'mentoring', 'volunteering', 'other'
  ) then
    raise exception 'Select a valid CPD activity type.';
  end if;

  if p_completed_on is null or p_completed_on > current_date then
    raise exception 'The CPD completion date must be today or earlier.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 1000 then
    raise exception 'CPD hours must be greater than zero and no more than 1000.';
  end if;

  if p_credential_id is not null and not exists (
    select 1 from public.agilecert_paid_credentials
    where id = p_credential_id and candidate_id = v_candidate_id
  ) then
    raise exception 'The selected credential does not belong to the candidate.';
  end if;

  if p_record_id is null then
    insert into public.agilecert_cpd_records (
      candidate_id, credential_id, title, provider, activity_type,
      completed_on, hours, evidence_reference, status
    ) values (
      v_candidate_id, p_credential_id, trim(p_title), trim(p_provider),
      v_activity_type, p_completed_on, p_hours,
      nullif(trim(coalesce(p_evidence_reference, '')), ''), 'draft'
    ) returning * into v_record;
  else
    select * into v_record
    from public.agilecert_cpd_records
    where id = p_record_id and candidate_id = v_candidate_id
    for update;

    if not found then
      raise exception 'The CPD record was not found.';
    end if;

    if v_record.status not in ('draft', 'changes_requested') then
      raise exception 'Only draft or changes-requested CPD records can be edited.';
    end if;

    update public.agilecert_cpd_records
    set credential_id = p_credential_id,
        title = trim(p_title),
        provider = trim(p_provider),
        activity_type = v_activity_type,
        completed_on = p_completed_on,
        hours = p_hours,
        evidence_reference = nullif(trim(coalesce(p_evidence_reference, '')), ''),
        status = 'draft',
        review_reason = null,
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
    where id = v_record.id
    returning * into v_record;
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_candidate_id, v_candidate_id,
    'cpd_record_saved', jsonb_build_object('cpdRecordId', v_record.id)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD record was saved as a draft.'
  );
end;
$$;

create or replace function public.submit_my_agilecert_cpd_record(
  p_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_record public.agilecert_cpd_records%rowtype;
begin
  select * into v_record
  from public.agilecert_cpd_records
  where id = p_record_id and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The CPD record was not found.';
  end if;

  if v_record.status not in ('draft', 'changes_requested') then
    raise exception 'This CPD record cannot be submitted from its current status.';
  end if;

  update public.agilecert_cpd_records
  set status = 'submitted',
      submitted_at = now(),
      review_reason = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_candidate_id, v_candidate_id,
    'cpd_record_submitted',
    jsonb_build_object('cpdRecordId', v_record.id, 'hours', v_record.hours)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD record was submitted for review.'
  );
end;
$$;

create or replace function public.review_agilecert_cpd_record(
  p_record_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_record public.agilecert_cpd_records%rowtype;
begin
  if v_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Select approved, changes requested or rejected.';
  end if;

  if v_decision <> 'approved' and (v_reason is null or length(v_reason) < 5) then
    raise exception 'A clear review reason is required.';
  end if;

  select * into v_record
  from public.agilecert_cpd_records
  where id = p_record_id
  for update;

  if not found or v_record.status <> 'submitted' then
    raise exception 'Only submitted CPD records can be reviewed.';
  end if;

  update public.agilecert_cpd_records
  set status = v_decision,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      review_reason = v_reason,
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_record.candidate_id, v_admin_id,
    'cpd_record_' || v_decision,
    jsonb_build_object('cpdRecordId', v_record.id, 'reason', v_reason)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD review decision was recorded.'
  );
end;
$$;

create or replace function public.create_my_agilecert_credential_share_link(
  p_scope text,
  p_credential_id uuid default null,
  p_label text default null,
  p_valid_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_scope text := lower(trim(coalesce(p_scope, '')));
  v_days integer;
  v_default_days integer := 30;
  v_share public.agilecert_credential_share_links%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_scope not in ('credential', 'transcript') then
    raise exception 'Share scope must be credential or transcript.';
  end if;

  if v_scope = 'credential' then
    if p_credential_id is null or not exists (
      select 1 from public.agilecert_paid_credentials
      where id = p_credential_id and candidate_id = v_candidate_id
    ) then
      raise exception 'Select a credential owned by the candidate.';
    end if;

    select coalesce(policy.share_link_default_days, 30) into v_default_days
    from public.agilecert_paid_credentials credential
    join public.agilecert_issued_certificates certificate
      on certificate.id = credential.certificate_id
    join public.examinations examination on examination.id = certificate.examination_id
    left join public.agilecert_credential_policies policy
      on policy.programme_id = examination.programme_id
     and policy.product_code = credential.product_code
     and policy.active = true
    where credential.id = p_credential_id;
  else
    if not exists (
      select 1 from public.agilecert_candidate_transcripts
      where candidate_id = v_candidate_id
    ) then
      raise exception 'A candidate transcript is not available yet.';
    end if;
  end if;

  v_days := greatest(1, least(coalesce(p_valid_days, v_default_days, 30), 365));

  insert into public.agilecert_credential_share_links (
    candidate_id,
    credential_id,
    scope,
    share_code,
    label,
    expires_at,
    metadata
  ) values (
    v_candidate_id,
    case when v_scope = 'credential' then p_credential_id else null end,
    v_scope,
    'SHARE-' || upper(encode(extensions.gen_random_bytes(12), 'hex')),
    coalesce(nullif(trim(coalesce(p_label, '')), ''),
      case when v_scope = 'credential' then 'Credential verification link'
           else 'Professional transcript link' end),
    now() + make_interval(days => v_days),
    jsonb_build_object('validDays', v_days)
  ) returning * into v_share;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, share_link_id, event_type, metadata
  ) values (
    v_share.credential_id, v_candidate_id, v_candidate_id, v_share.id,
    'share_link_created',
    jsonb_build_object('scope', v_scope, 'expiresAt', v_share.expires_at)
  );

  return jsonb_build_object(
    'id', v_share.id,
    'scope', v_share.scope,
    'shareCode', v_share.share_code,
    'shareUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || v_share.share_code,
    'expiresAt', v_share.expires_at,
    'message', 'The verification link was created.'
  );
end;
$$;

create or replace function public.revoke_my_agilecert_credential_share_link(
  p_share_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_share public.agilecert_credential_share_links%rowtype;
begin
  update public.agilecert_credential_share_links
  set revoked_at = coalesce(revoked_at, now())
  where id = p_share_link_id
    and candidate_id = v_candidate_id
  returning * into v_share;

  if not found then
    raise exception 'The share link was not found.';
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, share_link_id, event_type
  ) values (
    v_share.credential_id, v_candidate_id, v_candidate_id, v_share.id,
    'share_link_revoked'
  );

  return jsonb_build_object(
    'id', v_share.id,
    'revokedAt', v_share.revoked_at,
    'message', 'The verification link was revoked.'
  );
end;
$$;

create or replace function public.set_my_agilecert_transcript_public(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_transcript public.agilecert_candidate_transcripts%rowtype;
begin
  update public.agilecert_candidate_transcripts
  set public_enabled = coalesce(p_enabled, false),
      updated_at = now()
  where candidate_id = v_candidate_id
  returning * into v_transcript;

  if not found then
    raise exception 'A candidate transcript is not available yet.';
  end if;

  insert into public.agilecert_credential_audit_events (
    candidate_id, actor_id, event_type, metadata
  ) values (
    v_candidate_id, v_candidate_id, 'transcript_visibility_changed',
    jsonb_build_object('publicEnabled', v_transcript.public_enabled)
  );

  return jsonb_build_object(
    'transcriptCode', v_transcript.transcript_code,
    'publicEnabled', v_transcript.public_enabled,
    'message', case when v_transcript.public_enabled
      then 'Permanent transcript-code verification is enabled.'
      else 'Permanent transcript-code verification is disabled.' end
  );
end;
$$;

create or replace function public.request_my_agilecert_credential_renewal(
  p_credential_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_credential public.agilecert_paid_credentials%rowtype;
  v_programme_id uuid;
  v_policy public.agilecert_credential_policies%rowtype;
  v_approved_hours numeric(7,2);
  v_renewal public.agilecert_credential_renewals%rowtype;
  v_period_start timestamptz;
begin
  select credential.* into v_credential
  from public.agilecert_paid_credentials credential
  where credential.id = p_credential_id
    and credential.candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The credential was not found.';
  end if;

  select examination.programme_id into v_programme_id
  from public.agilecert_issued_certificates certificate
  join public.examinations examination on examination.id = certificate.examination_id
  where certificate.id = v_credential.certificate_id;

  select * into v_policy
  from public.agilecert_credential_policies
  where programme_id = v_programme_id
    and product_code = v_credential.product_code
    and active = true;

  if not found or v_policy.validity_months is null or v_credential.expires_at is null then
    raise exception 'This credential does not currently require renewal.';
  end if;

  if v_credential.renewal_due_at is not null and now() < v_credential.renewal_due_at then
    raise exception 'The renewal window has not opened yet.';
  end if;

  if exists (
    select 1 from public.agilecert_credential_renewals
    where credential_id = v_credential.id
      and status in ('pending', 'changes_requested')
  ) then
    raise exception 'A renewal request is already open for this credential.';
  end if;

  v_period_start := coalesce(v_credential.last_renewed_at, v_credential.valid_from, v_credential.issued_at);

  select coalesce(sum(cpd.hours), 0)::numeric(7,2)
  into v_approved_hours
  from public.agilecert_cpd_records cpd
  where cpd.candidate_id = v_candidate_id
    and cpd.status = 'approved'
    and cpd.completed_on >= v_period_start::date
    and (cpd.credential_id is null or cpd.credential_id = v_credential.id);

  if v_approved_hours < v_policy.cpd_hours_required then
    raise exception 'Approved CPD hours are insufficient for renewal. Required: %, approved: %.',
      v_policy.cpd_hours_required, v_approved_hours;
  end if;

  insert into public.agilecert_credential_renewals (
    credential_id,
    candidate_id,
    current_expires_at,
    proposed_expires_at,
    required_cpd_hours,
    approved_cpd_hours,
    metadata
  ) values (
    v_credential.id,
    v_candidate_id,
    v_credential.expires_at,
    greatest(v_credential.expires_at, now()) + make_interval(months => v_policy.validity_months),
    v_policy.cpd_hours_required,
    v_approved_hours,
    jsonb_build_object('policyId', v_policy.id, 'periodStart', v_period_start)
  ) returning * into v_renewal;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_credential.id, v_candidate_id, v_candidate_id,
    'renewal_requested',
    jsonb_build_object(
      'renewalId', v_renewal.id,
      'approvedCpdHours', v_approved_hours,
      'proposedExpiresAt', v_renewal.proposed_expires_at
    )
  );

  return jsonb_build_object(
    'id', v_renewal.id,
    'status', v_renewal.status,
    'proposedExpiresAt', v_renewal.proposed_expires_at,
    'approvedCpdHours', v_renewal.approved_cpd_hours,
    'message', 'The credential renewal request was submitted.'
  );
end;
$$;

create or replace function public.decide_agilecert_credential_renewal(
  p_renewal_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_renewal public.agilecert_credential_renewals%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_programme_id uuid;
  v_policy public.agilecert_credential_policies%rowtype;
begin
  if v_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Select approved, changes requested or rejected.';
  end if;

  if v_decision <> 'approved' and (v_reason is null or length(v_reason) < 5) then
    raise exception 'A clear renewal decision reason is required.';
  end if;

  select * into v_renewal
  from public.agilecert_credential_renewals
  where id = p_renewal_id
  for update;

  if not found or v_renewal.status not in ('pending', 'changes_requested') then
    raise exception 'The renewal request is unavailable for this decision.';
  end if;

  select * into v_credential
  from public.agilecert_paid_credentials
  where id = v_renewal.credential_id
  for update;

  if v_decision = 'approved' then
    select examination.programme_id into v_programme_id
    from public.agilecert_issued_certificates certificate
    join public.examinations examination on examination.id = certificate.examination_id
    where certificate.id = v_credential.certificate_id;

    select * into v_policy
    from public.agilecert_credential_policies
    where programme_id = v_programme_id
      and product_code = v_credential.product_code
      and active = true;

    if not found or v_policy.validity_months is null then
      raise exception 'An active expiring credential policy is required to approve renewal.';
    end if;

    update public.agilecert_paid_credentials
    set expires_at = v_renewal.proposed_expires_at,
        renewal_due_at = v_renewal.proposed_expires_at -
          make_interval(days => v_policy.renewal_window_days),
        last_renewed_at = now(),
        renewal_count = renewal_count + 1,
        lifecycle_metadata = coalesce(lifecycle_metadata, '{}'::jsonb) ||
          jsonb_build_object('lastRenewalId', v_renewal.id, 'lastRenewedBy', v_admin_id),
        updated_at = now()
    where id = v_credential.id
    returning * into v_credential;

    update public.agilecert_paid_credentials
    set badge_assertion = public.agilecert_build_badge_assertion(v_credential.id),
        updated_at = now()
    where id = v_credential.id;

    update public.agilecert_credential_renewals
    set status = 'completed',
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        review_reason = v_reason,
        completed_at = now(),
        updated_at = now()
    where id = v_renewal.id
    returning * into v_renewal;
  else
    update public.agilecert_credential_renewals
    set status = v_decision,
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        review_reason = v_reason,
        updated_at = now()
    where id = v_renewal.id
    returning * into v_renewal;
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_renewal.credential_id, v_renewal.candidate_id, v_admin_id,
    'renewal_' || v_renewal.status,
    jsonb_build_object(
      'renewalId', v_renewal.id,
      'reason', v_reason,
      'proposedExpiresAt', v_renewal.proposed_expires_at
    )
  );

  return jsonb_build_object(
    'id', v_renewal.id,
    'status', v_renewal.status,
    'expiresAt', case when v_renewal.status = 'completed'
      then v_renewal.proposed_expires_at else v_renewal.current_expires_at end,
    'message', 'The credential renewal decision was recorded.'
  );
end;
$$;

create or replace function public.upsert_agilecert_credential_policy(
  p_programme_id uuid,
  p_product_code text,
  p_validity_months integer default null,
  p_renewal_window_days integer default 90,
  p_cpd_hours_required numeric default 0,
  p_share_link_default_days integer default 30,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_policy public.agilecert_credential_policies%rowtype;
begin
  if not exists (select 1 from public.programmes where id = p_programme_id) then
    raise exception 'The programme was not found.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select achievement or professional.';
  end if;

  if p_validity_months is not null and (p_validity_months < 1 or p_validity_months > 120) then
    raise exception 'Validity months must be between 1 and 120, or left blank for no expiry.';
  end if;

  insert into public.agilecert_credential_policies (
    programme_id, product_code, validity_months, renewal_window_days,
    cpd_hours_required, share_link_default_days, active, created_by, updated_by
  ) values (
    p_programme_id, v_product_code, p_validity_months,
    greatest(1, least(coalesce(p_renewal_window_days, 90), 730)),
    greatest(0, least(coalesce(p_cpd_hours_required, 0), 10000)),
    greatest(1, least(coalesce(p_share_link_default_days, 30), 365)),
    coalesce(p_active, true), v_admin_id, v_admin_id
  )
  on conflict (programme_id, product_code) do update
  set validity_months = excluded.validity_months,
      renewal_window_days = excluded.renewal_window_days,
      cpd_hours_required = excluded.cpd_hours_required,
      share_link_default_days = excluded.share_link_default_days,
      active = excluded.active,
      updated_by = v_admin_id,
      updated_at = now()
  returning * into v_policy;

  insert into public.agilecert_credential_audit_events (
    actor_id, event_type, metadata
  ) values (
    v_admin_id, 'credential_policy_updated',
    jsonb_build_object(
      'policyId', v_policy.id,
      'programmeId', v_policy.programme_id,
      'productCode', v_policy.product_code,
      'validityMonths', v_policy.validity_months,
      'renewalWindowDays', v_policy.renewal_window_days,
      'cpdHoursRequired', v_policy.cpd_hours_required,
      'active', v_policy.active
    )
  );

  return jsonb_build_object(
    'id', v_policy.id,
    'programmeId', v_policy.programme_id,
    'productCode', v_policy.product_code,
    'validityMonths', v_policy.validity_months,
    'renewalWindowDays', v_policy.renewal_window_days,
    'cpdHoursRequired', v_policy.cpd_hours_required,
    'shareLinkDefaultDays', v_policy.share_link_default_days,
    'active', v_policy.active,
    'updatedAt', v_policy.updated_at
  );
end;
$$;

create or replace function public.verify_agilecert_professional_record(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_share public.agilecert_credential_share_links%rowtype;
  v_transcript public.agilecert_candidate_transcripts%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_candidate_id uuid;
  v_holder_name text;
  v_credentials jsonb;
  v_base jsonb;
begin
  if length(v_code) < 6 then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'Enter a valid certificate, credential, badge, transcript or share code.'
    );
  end if;

  select * into v_share
  from public.agilecert_credential_share_links
  where lower(share_code) = lower(v_code)
  limit 1;

  if found then
    if v_share.revoked_at is not null or v_share.expires_at <= now() then
      return jsonb_build_object(
        'found', true,
        'valid', false,
        'recordType', v_share.scope || '_share',
        'status', case when v_share.revoked_at is not null then 'revoked' else 'expired' end,
        'message', 'This candidate-controlled verification link is no longer active.'
      );
    end if;

    update public.agilecert_credential_share_links
    set access_count = access_count + 1,
        last_accessed_at = now()
    where id = v_share.id;

    if v_share.scope = 'credential' then
      v_credentials := jsonb_build_array(public.agilecert_public_credential_payload(v_share.credential_id));
      v_candidate_id := v_share.candidate_id;
    else
      v_candidate_id := v_share.candidate_id;
      select coalesce(jsonb_agg(
        public.agilecert_public_credential_payload(credential.id)
        order by credential.issued_at desc
      ), '[]'::jsonb)
      into v_credentials
      from public.agilecert_paid_credentials credential
      where credential.candidate_id = v_candidate_id;
    end if;

    select coalesce(nullif(trim(candidate_profile.legal_name), ''), profile.full_name)
    into v_holder_name
    from public.profiles profile
    left join public.agilecert_candidate_profiles candidate_profile
      on candidate_profile.user_id = profile.id
    where profile.id = v_candidate_id;

    insert into public.agilecert_credential_audit_events (
      credential_id, candidate_id, share_link_id, event_type, metadata
    ) values (
      v_share.credential_id, v_share.candidate_id, v_share.id,
      'share_link_verified',
      jsonb_build_object('scope', v_share.scope, 'accessedAt', now())
    );

    return jsonb_build_object(
      'found', true,
      'valid', true,
      'recordType', v_share.scope || '_share',
      'status', 'active',
      'holderName', v_holder_name,
      'credentials', v_credentials,
      'expiresAt', v_share.expires_at,
      'message', 'This candidate-controlled professional record is active and verifiable.'
    );
  end if;

  select * into v_transcript
  from public.agilecert_candidate_transcripts
  where lower(transcript_code) = lower(v_code)
  limit 1;

  if found then
    if not v_transcript.public_enabled then
      return jsonb_build_object(
        'found', true,
        'valid', false,
        'recordType', 'transcript',
        'status', 'private',
        'message', 'The candidate has not enabled permanent public transcript verification.'
      );
    end if;

    select coalesce(nullif(trim(candidate_profile.legal_name), ''), profile.full_name)
    into v_holder_name
    from public.profiles profile
    left join public.agilecert_candidate_profiles candidate_profile
      on candidate_profile.user_id = profile.id
    where profile.id = v_transcript.candidate_id;

    select coalesce(jsonb_agg(
      public.agilecert_public_credential_payload(credential.id)
      order by credential.issued_at desc
    ), '[]'::jsonb)
    into v_credentials
    from public.agilecert_paid_credentials credential
    where credential.candidate_id = v_transcript.candidate_id;

    insert into public.agilecert_credential_audit_events (
      candidate_id, event_type, metadata
    ) values (
      v_transcript.candidate_id, 'public_transcript_verified',
      jsonb_build_object('transcriptId', v_transcript.id)
    );

    return jsonb_build_object(
      'found', true,
      'valid', true,
      'recordType', 'transcript',
      'status', 'active',
      'holderName', v_holder_name,
      'transcriptCode', v_transcript.transcript_code,
      'credentials', v_credentials,
      'message', 'This candidate transcript is publicly enabled and verifiable.'
    );
  end if;

  select credential.* into v_credential
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where lower(credential.credential_code) = lower(v_code)
     or lower(credential.badge_code) = lower(v_code)
     or lower(coalesce(credential.transcript_code, '')) = lower(v_code)
     or lower(certificate.certificate_number) = lower(v_code)
     or lower(certificate.verification_code) = lower(v_code)
  limit 1;

  if found then
    insert into public.agilecert_credential_audit_events (
      credential_id, candidate_id, event_type, metadata
    ) values (
      v_credential.id, v_credential.candidate_id,
      'public_credential_verified',
      jsonb_build_object('lookupType', case
        when lower(v_credential.credential_code) = lower(v_code) then 'credential_code'
        when lower(v_credential.badge_code) = lower(v_code) then 'badge_code'
        when lower(coalesce(v_credential.transcript_code, '')) = lower(v_code) then 'credential_transcript_code'
        else 'certificate_code'
      end)
    );

    return jsonb_build_object(
      'found', true,
      'valid', public.agilecert_credential_effective_status(v_credential.id) = 'active',
      'recordType', 'credential',
      'status', public.agilecert_credential_effective_status(v_credential.id),
      'holderName', (public.agilecert_public_credential_payload(v_credential.id)->>'holderName'),
      'credentials', jsonb_build_array(public.agilecert_public_credential_payload(v_credential.id)),
      'message', case public.agilecert_credential_effective_status(v_credential.id)
        when 'active' then 'This professional credential is active and publicly verifiable.'
        when 'expired' then 'This professional credential has expired and requires renewal.'
        when 'suspended' then 'This professional credential is currently suspended.'
        else 'This professional credential has been revoked.'
      end
    );
  end if;

  v_base := public.verify_agilecert_certificate(v_code);
  return v_base || jsonb_build_object(
    'recordType', case when coalesce((v_base->>'found')::boolean, false)
      then 'certificate' else 'not_found' end
  );
end;
$$;

create or replace function public.get_agilecert_credential_admin_console(
  p_limit integer default 150
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 150), 500));
  v_policies jsonb;
  v_cpd jsonb;
  v_renewals jsonb;
  v_credentials jsonb;
  v_audits jsonb;
begin
  perform public.agilecert_require_certificate_admin();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', policy.id,
    'programmeId', policy.programme_id,
    'programmeCode', programme.code,
    'programmeTitle', programme.title,
    'productCode', policy.product_code,
    'validityMonths', policy.validity_months,
    'renewalWindowDays', policy.renewal_window_days,
    'cpdHoursRequired', policy.cpd_hours_required,
    'shareLinkDefaultDays', policy.share_link_default_days,
    'active', policy.active,
    'updatedAt', policy.updated_at
  ) order by programme.code, policy.product_code), '[]'::jsonb)
  into v_policies
  from public.agilecert_credential_policies policy
  join public.programmes programme on programme.id = policy.programme_id;

  select coalesce(jsonb_agg(payload order by submitted_at desc nulls last), '[]'::jsonb)
  into v_cpd
  from (
    select cpd.submitted_at,
      jsonb_build_object(
        'id', cpd.id,
        'candidateId', cpd.candidate_id,
        'candidateName', profile.full_name,
        'candidateEmail', profile.email,
        'credentialId', cpd.credential_id,
        'title', cpd.title,
        'provider', cpd.provider,
        'activityType', cpd.activity_type,
        'completedOn', cpd.completed_on,
        'hours', cpd.hours,
        'evidenceReference', cpd.evidence_reference,
        'status', cpd.status,
        'submittedAt', cpd.submitted_at,
        'reviewedAt', cpd.reviewed_at,
        'reviewReason', cpd.review_reason
      ) payload
    from public.agilecert_cpd_records cpd
    join public.profiles profile on profile.id = cpd.candidate_id
    order by cpd.submitted_at desc nulls last, cpd.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by requested_at desc), '[]'::jsonb)
  into v_renewals
  from (
    select renewal.requested_at,
      jsonb_build_object(
        'id', renewal.id,
        'credentialId', renewal.credential_id,
        'candidateId', renewal.candidate_id,
        'candidateName', profile.full_name,
        'candidateEmail', profile.email,
        'credentialCode', credential.credential_code,
        'status', renewal.status,
        'currentExpiresAt', renewal.current_expires_at,
        'proposedExpiresAt', renewal.proposed_expires_at,
        'requiredCpdHours', renewal.required_cpd_hours,
        'approvedCpdHours', renewal.approved_cpd_hours,
        'requestedAt', renewal.requested_at,
        'reviewedAt', renewal.reviewed_at,
        'reviewReason', renewal.review_reason
      ) payload
    from public.agilecert_credential_renewals renewal
    join public.profiles profile on profile.id = renewal.candidate_id
    join public.agilecert_paid_credentials credential on credential.id = renewal.credential_id
    order by renewal.requested_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(
    public.agilecert_public_credential_payload(credential.id)
    || jsonb_build_object(
      'candidateId', credential.candidate_id,
      'candidateName', profile.full_name,
      'candidateEmail', profile.email,
      'renewalCount', credential.renewal_count,
      'lastRenewedAt', credential.last_renewed_at
    ) order by credential.issued_at desc
  ), '[]'::jsonb)
  into v_credentials
  from public.agilecert_paid_credentials credential
  join public.profiles profile on profile.id = credential.candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', audit.id,
    'credentialId', audit.credential_id,
    'candidateId', audit.candidate_id,
    'actorId', audit.actor_id,
    'shareLinkId', audit.share_link_id,
    'eventType', audit.event_type,
    'metadata', audit.metadata,
    'createdAt', audit.created_at
  ) order by audit.created_at desc), '[]'::jsonb)
  into v_audits
  from (
    select * from public.agilecert_credential_audit_events
    order by created_at desc
    limit v_limit
  ) audit;

  return jsonb_build_object(
    'policies', v_policies,
    'cpdQueue', v_cpd,
    'renewals', v_renewals,
    'credentials', v_credentials,
    'auditEvents', v_audits,
    'counts', jsonb_build_object(
      'credentials', (select count(*) from public.agilecert_paid_credentials),
      'activeCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where public.agilecert_credential_effective_status(credential.id) = 'active'
      ),
      'expiredCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where public.agilecert_credential_effective_status(credential.id) = 'expired'
      ),
      'submittedCpd', (
        select count(*) from public.agilecert_cpd_records where status = 'submitted'
      ),
      'pendingRenewals', (
        select count(*) from public.agilecert_credential_renewals
        where status in ('pending', 'changes_requested')
      ),
      'activeShareLinks', (
        select count(*) from public.agilecert_credential_share_links
        where revoked_at is null and expires_at > now()
      )
    )
  );
end;
$$;

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
revoke all on function public.agilecert_public_credential_payload(uuid) from public;
revoke all on function public.get_my_agilecert_credential_wallet() from public;
revoke all on function public.save_my_agilecert_cpd_record(text, text, text, date, numeric, uuid, text, uuid) from public;
revoke all on function public.submit_my_agilecert_cpd_record(uuid) from public;
revoke all on function public.review_agilecert_cpd_record(uuid, text, text) from public;
revoke all on function public.create_my_agilecert_credential_share_link(text, uuid, text, integer) from public;
revoke all on function public.revoke_my_agilecert_credential_share_link(uuid) from public;
revoke all on function public.set_my_agilecert_transcript_public(boolean) from public;
revoke all on function public.request_my_agilecert_credential_renewal(uuid) from public;
revoke all on function public.decide_agilecert_credential_renewal(uuid, text, text) from public;
revoke all on function public.upsert_agilecert_credential_policy(uuid, text, integer, integer, numeric, integer, boolean) from public;
revoke all on function public.verify_agilecert_professional_record(text) from public;
revoke all on function public.get_agilecert_credential_admin_console(integer) from public;

grant execute on function public.get_my_agilecert_credential_wallet() to authenticated;
grant execute on function public.save_my_agilecert_cpd_record(text, text, text, date, numeric, uuid, text, uuid) to authenticated;
grant execute on function public.submit_my_agilecert_cpd_record(uuid) to authenticated;
grant execute on function public.create_my_agilecert_credential_share_link(text, uuid, text, integer) to authenticated;
grant execute on function public.revoke_my_agilecert_credential_share_link(uuid) to authenticated;
grant execute on function public.set_my_agilecert_transcript_public(boolean) to authenticated;
grant execute on function public.request_my_agilecert_credential_renewal(uuid) to authenticated;
grant execute on function public.review_agilecert_cpd_record(uuid, text, text) to authenticated;
grant execute on function public.decide_agilecert_credential_renewal(uuid, text, text) to authenticated;
grant execute on function public.upsert_agilecert_credential_policy(uuid, text, integer, integer, numeric, integer, boolean) to authenticated;
grant execute on function public.get_agilecert_credential_admin_console(integer) to authenticated;
grant execute on function public.verify_agilecert_professional_record(text) to anon, authenticated;

commit;
