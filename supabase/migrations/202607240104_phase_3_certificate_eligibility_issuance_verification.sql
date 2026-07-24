begin;

-- Phase 3: server-owned certificate eligibility, controlled issuance and
-- public verification. Certificate pricing, payment, identity verification,
-- badges, transcripts and automated communications remain excluded.

create sequence if not exists public.agilecert_certificate_serial_seq;

create or replace function public.agilecert_is_certificate_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('exam_admin', 'super_admin')
      and p.is_active = true
  );
$$;

create or replace function public.agilecert_require_certificate_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.agilecert_is_certificate_admin() then
    raise exception 'Active examination-administrator access is required.';
  end if;
  return v_user_id;
end;
$$;

create table if not exists public.agilecert_certificate_policies (
  examination_id uuid primary key references public.examinations(id) on delete cascade,
  certificate_title text not null default 'Certificate of Achievement'
    check (length(trim(certificate_title)) between 3 and 180),
  issuer_name text not null default 'Integrated Institute of Professional Management (IIPM)'
    check (length(trim(issuer_name)) between 3 and 220),
  pass_mark_override numeric(5,2)
    check (pass_mark_override is null or pass_mark_override between 0 and 100),
  max_suspicious_score numeric(5,2) not null default 49.99
    check (max_suspicious_score between 0 and 100),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_certificate_eligibility_records (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  pass_mark numeric(5,2) not null check (pass_mark between 0 and 100),
  suspicious_score numeric(5,2) not null default 0 check (suspicious_score between 0 and 100),
  attempt_status text not null,
  integrity_status text not null
    check (integrity_status in ('pending', 'cleared', 'flagged', 'rejected')),
  eligibility_status text not null
    check (eligibility_status in ('eligible', 'requested', 'issued', 'blocked', 'revoked')),
  reason_code text not null,
  requested_at timestamptz,
  issued_at timestamptz,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, examination_id, attempt_id)
);

create table if not exists public.agilecert_issued_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  verification_code text not null unique,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  eligibility_id uuid not null unique references public.agilecert_certificate_eligibility_records(id) on delete restrict,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  attempt_id uuid not null unique references public.attempts(id) on delete restrict,
  holder_name text not null check (length(trim(holder_name)) between 3 and 180),
  certificate_title text not null check (length(trim(certificate_title)) between 3 and 180),
  examination_title text not null check (length(trim(examination_title)) between 3 and 240),
  programme_code text,
  score numeric(5,2) not null check (score between 0 and 100),
  pass_mark numeric(5,2) not null check (pass_mark between 0 and 100),
  issue_date date not null default current_date,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references public.profiles(id) on delete set null,
  revocation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_certificate_eligibility_candidate_idx
  on public.agilecert_certificate_eligibility_records(candidate_id, evaluated_at desc);
create index if not exists agilecert_certificate_eligibility_status_idx
  on public.agilecert_certificate_eligibility_records(eligibility_status, evaluated_at desc);
create index if not exists agilecert_issued_certificates_candidate_idx
  on public.agilecert_issued_certificates(candidate_id, issued_at desc);
create index if not exists agilecert_issued_certificates_verification_idx
  on public.agilecert_issued_certificates(verification_code, status);

insert into public.agilecert_certificate_policies (examination_id)
select e.id
from public.examinations e
on conflict (examination_id) do nothing;

create or replace function public.evaluate_agilecert_certificate_eligibility(
  p_attempt_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_exam public.examinations%rowtype;
  v_policy public.agilecert_certificate_policies%rowtype;
  v_candidate public.profiles%rowtype;
  v_pass_mark numeric(5,2);
  v_score numeric(5,2);
  v_suspicious numeric(5,2);
  v_integrity text;
  v_eligibility text;
  v_reason text;
  v_record_id uuid;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'The examination attempt was not found.';
  end if;

  select * into v_exam
  from public.examinations
  where id = v_attempt.examination_id;

  if not found then
    raise exception 'The examination linked to the attempt was not found.';
  end if;

  insert into public.agilecert_certificate_policies (examination_id)
  values (v_exam.id)
  on conflict (examination_id) do nothing;

  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = v_exam.id;

  select * into v_candidate
  from public.profiles
  where id = v_attempt.candidate_id;

  v_score := greatest(0, least(100, coalesce(v_attempt.percentage, 0)))::numeric(5,2);
  v_suspicious := greatest(0, least(100, coalesce(v_attempt.suspicious_score, 0)))::numeric(5,2);
  v_pass_mark := coalesce(v_policy.pass_mark_override, v_exam.pass_mark, 70)::numeric(5,2);

  v_integrity := case
    when v_attempt.status = 'terminated' then 'rejected'
    when v_attempt.status = 'flagged' or v_suspicious > v_policy.max_suspicious_score then 'flagged'
    when v_attempt.status = 'submitted' then 'cleared'
    else 'pending'
  end;

  if v_candidate.id is null or v_candidate.role <> 'candidate' or not coalesce(v_candidate.is_active, false) then
    v_eligibility := 'blocked';
    v_reason := 'candidate_inactive';
  elsif not v_policy.active then
    v_eligibility := 'revoked';
    v_reason := 'policy_inactive';
  elsif v_attempt.status not in ('submitted', 'flagged', 'terminated') then
    v_eligibility := 'blocked';
    v_reason := 'attempt_incomplete';
  elsif v_score < v_pass_mark then
    v_eligibility := 'blocked';
    v_reason := 'score_below_pass_mark';
  elsif v_integrity = 'rejected' then
    v_eligibility := 'blocked';
    v_reason := 'integrity_rejected';
  elsif v_integrity = 'flagged' then
    v_eligibility := 'blocked';
    v_reason := 'integrity_flagged';
  else
    v_eligibility := 'eligible';
    v_reason := 'eligible';
  end if;

  insert into public.agilecert_certificate_eligibility_records (
    candidate_id,
    examination_id,
    attempt_id,
    score,
    pass_mark,
    suspicious_score,
    attempt_status,
    integrity_status,
    eligibility_status,
    reason_code,
    evaluated_at,
    metadata
  ) values (
    v_attempt.candidate_id,
    v_attempt.examination_id,
    v_attempt.id,
    v_score,
    v_pass_mark,
    v_suspicious,
    v_attempt.status,
    v_integrity,
    v_eligibility,
    v_reason,
    now(),
    jsonb_build_object(
      'source', 'authoritative_attempt',
      'policyMaxSuspiciousScore', v_policy.max_suspicious_score,
      'evaluatedAt', now()
    )
  )
  on conflict (attempt_id) do update
  set candidate_id = excluded.candidate_id,
      examination_id = excluded.examination_id,
      score = excluded.score,
      pass_mark = excluded.pass_mark,
      suspicious_score = excluded.suspicious_score,
      attempt_status = excluded.attempt_status,
      integrity_status = excluded.integrity_status,
      eligibility_status = case
        when excluded.eligibility_status = 'eligible'
          and public.agilecert_certificate_eligibility_records.eligibility_status in ('requested', 'issued')
          then public.agilecert_certificate_eligibility_records.eligibility_status
        else excluded.eligibility_status
      end,
      reason_code = excluded.reason_code,
      evaluated_at = excluded.evaluated_at,
      metadata = excluded.metadata,
      updated_at = now()
  returning id into v_record_id;

  if v_eligibility in ('blocked', 'revoked') then
    update public.agilecert_issued_certificates
    set status = 'suspended',
        status_changed_at = now(),
        status_changed_by = null,
        revocation_reason = 'Automatically suspended because the authoritative eligibility record changed.',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'automaticSuspensionReason', v_reason,
          'automaticSuspensionAt', now()
        ),
        updated_at = now()
    where attempt_id = v_attempt.id
      and status = 'active';
  end if;

  return v_record_id;
end;
$$;

create or replace function public.agilecert_sync_certificate_eligibility_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_agilecert_certificate_eligibility(new.id);
  return new;
end;
$$;

drop trigger if exists agilecert_certificate_eligibility_attempt_trigger on public.attempts;
create trigger agilecert_certificate_eligibility_attempt_trigger
  after insert or update of percentage, status, suspicious_score, submitted_at
  on public.attempts
  for each row
  execute function public.agilecert_sync_certificate_eligibility_from_attempt();

create or replace function public.get_my_agilecert_certificate_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_attempt record;
  v_items jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  for v_attempt in
    select a.id
    from public.attempts a
    where a.candidate_id = v_candidate_id
      and a.status <> 'ongoing'
  loop
    perform public.evaluate_agilecert_certificate_eligibility(v_attempt.id);
  end loop;

  select coalesce(jsonb_agg(payload order by completed_at desc), '[]'::jsonb)
  into v_items
  from (
    select
      coalesce(a.submitted_at, a.graded_at, now()) as completed_at,
      jsonb_build_object(
        'eligibilityId', er.id,
        'attemptId', er.attempt_id,
        'examinationId', er.examination_id,
        'examinationTitle', e.title,
        'programmeCode', p.code,
        'score', er.score,
        'passMark', er.pass_mark,
        'suspiciousScore', er.suspicious_score,
        'attemptStatus', er.attempt_status,
        'integrityStatus', er.integrity_status,
        'eligibilityStatus', er.eligibility_status,
        'reasonCode', er.reason_code,
        'completedAt', coalesce(a.submitted_at, a.graded_at),
        'requestedAt', er.requested_at,
        'issuedAt', er.issued_at,
        'certificate', case
          when c.id is null then null
          else jsonb_build_object(
            'id', c.id,
            'certificateNumber', c.certificate_number,
            'verificationCode', c.verification_code,
            'holderName', c.holder_name,
            'certificateTitle', c.certificate_title,
            'examinationTitle', c.examination_title,
            'programmeCode', c.programme_code,
            'score', c.score,
            'passMark', c.pass_mark,
            'issueDate', c.issue_date,
            'issuedAt', c.issued_at,
            'status', c.status,
            'statusChangedAt', c.status_changed_at,
            'revocationReason', case when c.status = 'active' then null else c.revocation_reason end
          )
        end
      ) as payload
    from public.agilecert_certificate_eligibility_records er
    join public.attempts a on a.id = er.attempt_id
    join public.examinations e on e.id = er.examination_id
    join public.programmes p on p.id = e.programme_id
    left join public.agilecert_issued_certificates c on c.eligibility_id = er.id
    where er.candidate_id = v_candidate_id
  ) records;

  return jsonb_build_object(
    'items', v_items,
    'counts', jsonb_build_object(
      'eligible', (select count(*) from public.agilecert_certificate_eligibility_records where candidate_id = v_candidate_id and eligibility_status = 'eligible'),
      'requested', (select count(*) from public.agilecert_certificate_eligibility_records where candidate_id = v_candidate_id and eligibility_status = 'requested'),
      'issued', (select count(*) from public.agilecert_certificate_eligibility_records where candidate_id = v_candidate_id and eligibility_status = 'issued'),
      'blocked', (select count(*) from public.agilecert_certificate_eligibility_records where candidate_id = v_candidate_id and eligibility_status in ('blocked', 'revoked'))
    )
  );
end;
$$;

create or replace function public.request_my_agilecert_certificate(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_eligibility_id uuid;
  v_record public.agilecert_certificate_eligibility_records%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  v_eligibility_id := public.evaluate_agilecert_certificate_eligibility(p_attempt_id);

  select * into v_record
  from public.agilecert_certificate_eligibility_records
  where id = v_eligibility_id
    and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record is unavailable.';
  end if;

  if v_record.eligibility_status in ('blocked', 'revoked') then
    raise exception 'Certificate issuance is unavailable: %.', replace(v_record.reason_code, '_', ' ');
  end if;

  if v_record.eligibility_status = 'issued' then
    return jsonb_build_object(
      'eligibilityId', v_record.id,
      'status', 'issued',
      'message', 'This certificate has already been issued.'
    );
  end if;

  update public.agilecert_certificate_eligibility_records
  set eligibility_status = 'requested',
      requested_at = coalesce(requested_at, now()),
      updated_at = now()
  where id = v_record.id;

  return jsonb_build_object(
    'eligibilityId', v_record.id,
    'status', 'requested',
    'message', 'Your certificate issuance request has been submitted for administrator review.'
  );
end;
$$;

create or replace function public.issue_agilecert_certificate(
  p_eligibility_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_record public.agilecert_certificate_eligibility_records%rowtype;
  v_policy public.agilecert_certificate_policies%rowtype;
  v_exam public.examinations%rowtype;
  v_candidate public.profiles%rowtype;
  v_legal_name text;
  v_programme_code text;
  v_safe_programme_code text;
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_serial bigint;
  v_certificate_number text;
  v_verification_code text;
begin
  select * into v_record
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;

  perform public.evaluate_agilecert_certificate_eligibility(v_record.attempt_id);

  select * into v_record
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
  for update;

  if v_record.eligibility_status not in ('eligible', 'requested', 'issued') then
    raise exception 'This result is not eligible for certificate issuance: %.', replace(v_record.reason_code, '_', ' ');
  end if;

  select * into v_certificate
  from public.agilecert_issued_certificates
  where eligibility_id = v_record.id;

  if found then
    return jsonb_build_object(
      'id', v_certificate.id,
      'certificateNumber', v_certificate.certificate_number,
      'verificationCode', v_certificate.verification_code,
      'status', v_certificate.status,
      'message', 'The certificate already exists.'
    );
  end if;

  select * into v_candidate
  from public.profiles
  where id = v_record.candidate_id
    and role = 'candidate'
    and is_active = true;

  if not found then
    raise exception 'The candidate account is inactive or unavailable.';
  end if;

  select coalesce(nullif(trim(cp.legal_name), ''), nullif(trim(v_candidate.full_name), ''))
  into v_legal_name
  from public.agilecert_candidate_profiles cp
  where cp.user_id = v_record.candidate_id;

  v_legal_name := coalesce(v_legal_name, nullif(trim(v_candidate.full_name), ''));
  if v_legal_name is null or length(v_legal_name) < 3 then
    raise exception 'The candidate must complete a legal name before certificate issuance.';
  end if;

  select * into v_exam
  from public.examinations
  where id = v_record.examination_id;

  select p.code into v_programme_code
  from public.programmes p
  where p.id = v_exam.programme_id;

  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = v_record.examination_id;

  v_safe_programme_code := regexp_replace(upper(coalesce(v_programme_code, 'CERT')), '[^A-Z0-9]+', '', 'g');
  if v_safe_programme_code = '' then v_safe_programme_code := 'CERT'; end if;

  v_serial := nextval('public.agilecert_certificate_serial_seq');
  v_certificate_number := format(
    'IIPM/%s/%s/%s',
    v_safe_programme_code,
    to_char(now(), 'YYYY'),
    lpad(v_serial::text, 6, '0')
  );
  v_verification_code := upper(encode(gen_random_bytes(9), 'hex'));

  insert into public.agilecert_issued_certificates (
    certificate_number,
    verification_code,
    candidate_id,
    eligibility_id,
    examination_id,
    attempt_id,
    holder_name,
    certificate_title,
    examination_title,
    programme_code,
    score,
    pass_mark,
    issued_by,
    status_changed_by,
    metadata
  ) values (
    v_certificate_number,
    v_verification_code,
    v_record.candidate_id,
    v_record.id,
    v_record.examination_id,
    v_record.attempt_id,
    v_legal_name,
    coalesce(v_policy.certificate_title, 'Certificate of Achievement'),
    v_exam.title,
    v_programme_code,
    v_record.score,
    v_record.pass_mark,
    v_admin_id,
    v_admin_id,
    jsonb_build_object(
      'issuerName', coalesce(v_policy.issuer_name, 'Integrated Institute of Professional Management (IIPM)'),
      'authority', 'Phase 3 server-controlled issuance',
      'issuedFromEligibility', v_record.id
    )
  ) returning * into v_certificate;

  update public.agilecert_certificate_eligibility_records
  set eligibility_status = 'issued',
      issued_at = v_certificate.issued_at,
      updated_at = now()
  where id = v_record.id;

  return jsonb_build_object(
    'id', v_certificate.id,
    'certificateNumber', v_certificate.certificate_number,
    'verificationCode', v_certificate.verification_code,
    'holderName', v_certificate.holder_name,
    'certificateTitle', v_certificate.certificate_title,
    'examinationTitle', v_certificate.examination_title,
    'programmeCode', v_certificate.programme_code,
    'score', v_certificate.score,
    'passMark', v_certificate.pass_mark,
    'issueDate', v_certificate.issue_date,
    'issuedAt', v_certificate.issued_at,
    'status', v_certificate.status
  );
end;
$$;

create or replace function public.set_agilecert_certificate_status(
  p_certificate_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_certificate public.agilecert_issued_certificates%rowtype;
begin
  if v_status not in ('active', 'suspended', 'revoked') then
    raise exception 'Certificate status must be active, suspended or revoked.';
  end if;

  if v_status <> 'active' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required when suspending or revoking a certificate.';
  end if;

  update public.agilecert_issued_certificates
  set status = v_status,
      status_changed_at = now(),
      status_changed_by = v_admin_id,
      revocation_reason = case
        when v_status = 'active' then null
        else left(trim(p_reason), 500)
      end,
      updated_at = now()
  where id = p_certificate_id
  returning * into v_certificate;

  if not found then
    raise exception 'The issued certificate was not found.';
  end if;

  return jsonb_build_object(
    'id', v_certificate.id,
    'certificateNumber', v_certificate.certificate_number,
    'status', v_certificate.status,
    'statusChangedAt', v_certificate.status_changed_at,
    'reason', v_certificate.revocation_reason
  );
end;
$$;

create or replace function public.upsert_agilecert_certificate_policy(
  p_examination_id uuid,
  p_certificate_title text default 'Certificate of Achievement',
  p_pass_mark_override numeric default null,
  p_max_suspicious_score numeric default 49.99,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_policy public.agilecert_certificate_policies%rowtype;
begin
  if not exists (select 1 from public.examinations where id = p_examination_id) then
    raise exception 'The examination was not found.';
  end if;

  insert into public.agilecert_certificate_policies (
    examination_id,
    certificate_title,
    pass_mark_override,
    max_suspicious_score,
    active,
    created_by,
    updated_by
  ) values (
    p_examination_id,
    coalesce(nullif(trim(p_certificate_title), ''), 'Certificate of Achievement'),
    p_pass_mark_override,
    p_max_suspicious_score,
    coalesce(p_active, true),
    v_admin_id,
    v_admin_id
  )
  on conflict (examination_id) do update
  set certificate_title = excluded.certificate_title,
      pass_mark_override = excluded.pass_mark_override,
      max_suspicious_score = excluded.max_suspicious_score,
      active = excluded.active,
      updated_by = v_admin_id,
      updated_at = now()
  returning * into v_policy;

  return jsonb_build_object(
    'examinationId', v_policy.examination_id,
    'certificateTitle', v_policy.certificate_title,
    'passMarkOverride', v_policy.pass_mark_override,
    'maxSuspiciousScore', v_policy.max_suspicious_score,
    'active', v_policy.active,
    'updatedAt', v_policy.updated_at
  );
end;
$$;

create or replace function public.reconcile_agilecert_certificate_eligibilities(
  p_examination_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_attempt record;
  v_count integer := 0;
begin
  for v_attempt in
    select a.id
    from public.attempts a
    where a.status <> 'ongoing'
      and (p_examination_id is null or a.examination_id = p_examination_id)
  loop
    perform public.evaluate_agilecert_certificate_eligibility(v_attempt.id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'evaluatedAttempts', v_count,
    'examinationId', p_examination_id,
    'reconciledBy', v_admin_id,
    'reconciledAt', now()
  );
end;
$$;

create or replace function public.get_agilecert_certificate_admin_console(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
  v_eligibilities jsonb;
  v_certificates jsonb;
  v_policies jsonb;
begin
  perform public.agilecert_require_certificate_admin();

  select coalesce(jsonb_agg(payload order by evaluated_at desc), '[]'::jsonb)
  into v_eligibilities
  from (
    select er.evaluated_at,
      jsonb_build_object(
        'id', er.id,
        'candidateId', er.candidate_id,
        'candidateName', p.full_name,
        'candidateEmail', p.email,
        'examinationId', er.examination_id,
        'examinationTitle', e.title,
        'programmeCode', pr.code,
        'attemptId', er.attempt_id,
        'score', er.score,
        'passMark', er.pass_mark,
        'suspiciousScore', er.suspicious_score,
        'integrityStatus', er.integrity_status,
        'eligibilityStatus', er.eligibility_status,
        'reasonCode', er.reason_code,
        'requestedAt', er.requested_at,
        'issuedAt', er.issued_at,
        'evaluatedAt', er.evaluated_at
      ) as payload
    from public.agilecert_certificate_eligibility_records er
    join public.profiles p on p.id = er.candidate_id
    join public.examinations e on e.id = er.examination_id
    join public.programmes pr on pr.id = e.programme_id
    order by er.evaluated_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by issued_at desc), '[]'::jsonb)
  into v_certificates
  from (
    select c.issued_at,
      jsonb_build_object(
        'id', c.id,
        'certificateNumber', c.certificate_number,
        'verificationCode', c.verification_code,
        'candidateId', c.candidate_id,
        'holderName', c.holder_name,
        'candidateEmail', p.email,
        'certificateTitle', c.certificate_title,
        'examinationTitle', c.examination_title,
        'programmeCode', c.programme_code,
        'score', c.score,
        'passMark', c.pass_mark,
        'issueDate', c.issue_date,
        'issuedAt', c.issued_at,
        'status', c.status,
        'statusChangedAt', c.status_changed_at,
        'revocationReason', c.revocation_reason
      ) as payload
    from public.agilecert_issued_certificates c
    join public.profiles p on p.id = c.candidate_id
    order by c.issued_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'examinationId', cp.examination_id,
    'examinationTitle', e.title,
    'certificateTitle', cp.certificate_title,
    'passMarkOverride', cp.pass_mark_override,
    'examPassMark', e.pass_mark,
    'maxSuspiciousScore', cp.max_suspicious_score,
    'active', cp.active,
    'updatedAt', cp.updated_at
  ) order by e.title), '[]'::jsonb)
  into v_policies
  from public.agilecert_certificate_policies cp
  join public.examinations e on e.id = cp.examination_id;

  return jsonb_build_object(
    'eligibilities', v_eligibilities,
    'certificates', v_certificates,
    'policies', v_policies,
    'counts', jsonb_build_object(
      'eligible', (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status = 'eligible'),
      'requested', (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status = 'requested'),
      'issued', (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status = 'issued'),
      'blocked', (select count(*) from public.agilecert_certificate_eligibility_records where eligibility_status in ('blocked', 'revoked')),
      'activeCertificates', (select count(*) from public.agilecert_issued_certificates where status = 'active'),
      'restrictedCertificates', (select count(*) from public.agilecert_issued_certificates where status in ('suspended', 'revoked'))
    )
  );
end;
$$;

create or replace function public.verify_agilecert_certificate(
  p_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_issuer text;
begin
  if length(v_code) < 6 then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'Enter a valid certificate number or verification code.'
    );
  end if;

  select * into v_certificate
  from public.agilecert_issued_certificates c
  where lower(c.certificate_number) = lower(v_code)
     or lower(c.verification_code) = lower(v_code)
  limit 1;

  if not found then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'message', 'No AgileCert certificate matches the supplied code.'
    );
  end if;

  select cp.issuer_name into v_issuer
  from public.agilecert_certificate_policies cp
  where cp.examination_id = v_certificate.examination_id;

  return jsonb_build_object(
    'found', true,
    'valid', v_certificate.status = 'active',
    'status', v_certificate.status,
    'certificateNumber', v_certificate.certificate_number,
    'verificationCode', v_certificate.verification_code,
    'holderName', v_certificate.holder_name,
    'certificateTitle', v_certificate.certificate_title,
    'examinationTitle', v_certificate.examination_title,
    'programmeCode', v_certificate.programme_code,
    'score', v_certificate.score,
    'passMark', v_certificate.pass_mark,
    'issueDate', v_certificate.issue_date,
    'issuedAt', v_certificate.issued_at,
    'issuer', coalesce(v_issuer, 'Integrated Institute of Professional Management (IIPM)'),
    'poweredBy', 'AgileCert Global',
    'message', case
      when v_certificate.status = 'active' then 'This certificate is active and verifiable.'
      when v_certificate.status = 'suspended' then 'This certificate is currently suspended.'
      else 'This certificate has been revoked.'
    end
  );
end;
$$;

alter table public.agilecert_certificate_policies enable row level security;
alter table public.agilecert_certificate_eligibility_records enable row level security;
alter table public.agilecert_issued_certificates enable row level security;

drop policy if exists agilecert_certificate_policies_admin_select on public.agilecert_certificate_policies;
create policy agilecert_certificate_policies_admin_select
  on public.agilecert_certificate_policies
  for select to authenticated
  using (public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_eligibility_select on public.agilecert_certificate_eligibility_records;
create policy agilecert_certificate_eligibility_select
  on public.agilecert_certificate_eligibility_records
  for select to authenticated
  using (candidate_id = auth.uid() or public.agilecert_is_certificate_admin());

drop policy if exists agilecert_issued_certificates_select on public.agilecert_issued_certificates;
create policy agilecert_issued_certificates_select
  on public.agilecert_issued_certificates
  for select to authenticated
  using (candidate_id = auth.uid() or public.agilecert_is_certificate_admin());

revoke all on public.agilecert_certificate_policies from public, anon, authenticated;
revoke all on public.agilecert_certificate_eligibility_records from public, anon, authenticated;
revoke all on public.agilecert_issued_certificates from public, anon, authenticated;
grant select on public.agilecert_certificate_policies to authenticated;
grant select on public.agilecert_certificate_eligibility_records to authenticated;
grant select on public.agilecert_issued_certificates to authenticated;

revoke all on function public.agilecert_is_certificate_admin() from public, anon, authenticated;
grant execute on function public.agilecert_is_certificate_admin() to authenticated;
revoke all on function public.agilecert_require_certificate_admin() from public, anon, authenticated;
revoke all on function public.evaluate_agilecert_certificate_eligibility(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_sync_certificate_eligibility_from_attempt() from public, anon, authenticated;

revoke all on function public.get_my_agilecert_certificate_workspace() from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_workspace() to authenticated;
revoke all on function public.request_my_agilecert_certificate(uuid) from public, anon, authenticated;
grant execute on function public.request_my_agilecert_certificate(uuid) to authenticated;
revoke all on function public.issue_agilecert_certificate(uuid) from public, anon, authenticated;
grant execute on function public.issue_agilecert_certificate(uuid) to authenticated;
revoke all on function public.set_agilecert_certificate_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_agilecert_certificate_status(uuid, text, text) to authenticated;
revoke all on function public.upsert_agilecert_certificate_policy(uuid, text, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.upsert_agilecert_certificate_policy(uuid, text, numeric, numeric, boolean) to authenticated;
revoke all on function public.reconcile_agilecert_certificate_eligibilities(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_agilecert_certificate_eligibilities(uuid) to authenticated;
revoke all on function public.get_agilecert_certificate_admin_console(integer) from public, anon, authenticated;
grant execute on function public.get_agilecert_certificate_admin_console(integer) to authenticated;
revoke all on function public.verify_agilecert_certificate(text) from public, anon, authenticated;
grant execute on function public.verify_agilecert_certificate(text) to anon, authenticated;

do $$
declare
  v_attempt record;
begin
  for v_attempt in
    select a.id
    from public.attempts a
    where a.status <> 'ongoing'
  loop
    perform public.evaluate_agilecert_certificate_eligibility(v_attempt.id);
  end loop;
end;
$$;

comment on table public.agilecert_certificate_eligibility_records is
  'Authoritative Phase 3 certificate eligibility derived from examination attempts.';
comment on table public.agilecert_issued_certificates is
  'Server-issued IIPM certificates with controlled lifecycle and public verification codes.';
comment on function public.verify_agilecert_certificate(text) is
  'Publicly verifies a certificate number or verification code without exposing private candidate identifiers.';

notify pgrst, 'reload schema';

commit;
