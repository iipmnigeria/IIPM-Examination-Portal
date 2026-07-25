begin;

-- Original Roadmap Phase 3 completion: approval decisions, programme templates,
-- correction/reissuance history, QR render payloads and certificate audit.
-- Existing certificate commerce, Paystack, identity, exam and AI functions remain intact.

alter table public.agilecert_certificate_policies
  add column if not exists approval_mode text not null default 'automatic',
  add column if not exists require_candidate_request boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agilecert_certificate_policies'::regclass
      and conname = 'agilecert_certificate_policies_approval_mode_check'
  ) then
    alter table public.agilecert_certificate_policies
      add constraint agilecert_certificate_policies_approval_mode_check
      check (approval_mode in ('automatic', 'manual'));
  end if;
end;
$$;

alter table public.agilecert_certificate_eligibility_records
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists approval_reason text,
  add column if not exists approval_decided_at timestamptz,
  add column if not exists approval_decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists approval_updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agilecert_certificate_eligibility_records'::regclass
      and conname = 'agilecert_certificate_eligibility_approval_status_check'
  ) then
    alter table public.agilecert_certificate_eligibility_records
      add constraint agilecert_certificate_eligibility_approval_status_check
      check (approval_status in (
        'not_required', 'pending', 'approved', 'changes_requested', 'rejected'
      ));
  end if;
end;
$$;

create table if not exists public.agilecert_certificate_templates (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  product_code text not null default 'achievement'
    references public.agilecert_certificate_products(code) on delete restrict,
  template_name text not null
    check (length(trim(template_name)) between 3 and 120),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  certificate_title text not null
    check (length(trim(certificate_title)) between 3 and 180),
  issuer_name text not null default 'Integrated Institute of Professional Management (IIPM)'
    check (length(trim(issuer_name)) between 3 and 220),
  subtitle text not null default 'AgileCert Global · Server-issued and publicly verifiable'
    check (length(trim(subtitle)) between 3 and 240),
  left_signatory_name text not null default 'Certificate Authority'
    check (length(trim(left_signatory_name)) between 2 and 160),
  left_signatory_title text not null default 'Integrated Institute of Professional Management'
    check (length(trim(left_signatory_title)) between 2 and 180),
  right_signatory_name text not null default 'Registrar'
    check (length(trim(right_signatory_name)) between 2 and 160),
  right_signatory_title text not null default 'AgileCert Global by IIPM'
    check (length(trim(right_signatory_title)) between 2 and 180),
  primary_colour text not null default '#0f2a4a'
    check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  accent_colour text not null default '#d97706'
    check (accent_colour ~ '^#[0-9A-Fa-f]{6}$'),
  layout_config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programme_id, product_code, version)
);

create unique index if not exists agilecert_certificate_templates_one_active_idx
  on public.agilecert_certificate_templates(programme_id, product_code)
  where active = true;

insert into public.agilecert_certificate_templates (
  programme_id,
  product_code,
  template_name,
  version,
  active,
  certificate_title
)
select
  p.id,
  product.code,
  p.code || ' ' || product.title || ' Template',
  1,
  true,
  product.title
from public.programmes p
cross join public.agilecert_certificate_products product
where product.code in ('achievement', 'professional')
on conflict (programme_id, product_code, version) do nothing;

alter table public.agilecert_issued_certificates
  add column if not exists template_id uuid references public.agilecert_certificate_templates(id) on delete set null,
  add column if not exists template_version integer,
  add column if not exists revision_number integer not null default 1,
  add column if not exists corrected_at timestamptz,
  add column if not exists corrected_by uuid references public.profiles(id) on delete set null,
  add column if not exists correction_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agilecert_issued_certificates'::regclass
      and conname = 'agilecert_issued_certificates_revision_number_check'
  ) then
    alter table public.agilecert_issued_certificates
      add constraint agilecert_issued_certificates_revision_number_check
      check (revision_number > 0);
  end if;
end;
$$;

create table if not exists public.agilecert_certificate_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  eligibility_id uuid not null
    references public.agilecert_certificate_eligibility_records(id) on delete cascade,
  decision text not null
    check (decision in ('approved', 'changes_requested', 'rejected')),
  reason text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists agilecert_certificate_approval_decisions_eligibility_idx
  on public.agilecert_certificate_approval_decisions(eligibility_id, decided_at desc);

create table if not exists public.agilecert_certificate_revisions (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null
    references public.agilecert_issued_certificates(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  certificate_number text not null unique,
  verification_code text not null unique,
  holder_name text not null,
  certificate_title text not null,
  examination_title text not null,
  programme_code text,
  score numeric(5,2) not null,
  pass_mark numeric(5,2) not null,
  issue_date date not null,
  issued_at timestamptz not null,
  status text not null,
  template_id uuid references public.agilecert_certificate_templates(id) on delete set null,
  template_version integer,
  metadata jsonb not null default '{}'::jsonb,
  superseded_reason text not null,
  superseded_by uuid not null references public.profiles(id) on delete restrict,
  superseded_at timestamptz not null default now(),
  unique (certificate_id, revision_number)
);

create index if not exists agilecert_certificate_revisions_certificate_idx
  on public.agilecert_certificate_revisions(certificate_id, revision_number desc);

create table if not exists public.agilecert_certificate_audit_events (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid references public.agilecert_issued_certificates(id) on delete set null,
  eligibility_id uuid references public.agilecert_certificate_eligibility_records(id) on delete set null,
  candidate_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  lookup_code_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_certificate_audit_events_created_idx
  on public.agilecert_certificate_audit_events(created_at desc);
create index if not exists agilecert_certificate_audit_events_certificate_idx
  on public.agilecert_certificate_audit_events(certificate_id, created_at desc);

create or replace function public.agilecert_sync_certificate_request_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  if new.eligibility_status = 'requested'
     and old.eligibility_status is distinct from 'requested' then
    select coalesce(cp.approval_mode, 'automatic') into v_mode
    from public.agilecert_certificate_policies cp
    where cp.examination_id = new.examination_id;

    if coalesce(v_mode, 'automatic') = 'manual' then
      new.approval_status := 'pending';
    else
      new.approval_status := 'not_required';
    end if;
    new.approval_reason := null;
    new.approval_decided_at := null;
    new.approval_decided_by := null;
    new.approval_updated_at := now();
  elsif new.eligibility_status = 'issued' then
    if new.approval_status = 'pending' then
      new.approval_status := 'approved';
      new.approval_decided_at := coalesce(new.approval_decided_at, now());
    end if;
    new.approval_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists agilecert_certificate_request_approval_trigger
  on public.agilecert_certificate_eligibility_records;
create trigger agilecert_certificate_request_approval_trigger
  before update of eligibility_status
  on public.agilecert_certificate_eligibility_records
  for each row
  execute function public.agilecert_sync_certificate_request_approval();

create or replace function public.agilecert_prepare_certificate_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_certificate_policies%rowtype;
  v_eligibility public.agilecert_certificate_eligibility_records%rowtype;
  v_programme_id uuid;
  v_product_code text;
  v_template public.agilecert_certificate_templates%rowtype;
begin
  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = new.examination_id;

  select * into v_eligibility
  from public.agilecert_certificate_eligibility_records
  where id = new.eligibility_id;

  if coalesce(v_policy.approval_mode, 'automatic') = 'manual'
     and coalesce(v_eligibility.approval_status, 'not_required') <> 'approved' then
    raise exception 'This certificate policy requires administrator approval before issuance.';
  end if;

  if coalesce(v_policy.require_candidate_request, false)
     and v_eligibility.eligibility_status not in ('requested', 'issued') then
    raise exception 'The candidate must submit a certificate request before issuance.';
  end if;

  select e.programme_id into v_programme_id
  from public.examinations e
  where e.id = new.examination_id;

  v_product_code := lower(coalesce(nullif(new.metadata->>'productCode', ''), 'achievement'));
  if v_product_code not in ('achievement', 'professional') then
    v_product_code := 'achievement';
  end if;

  select * into v_template
  from public.agilecert_certificate_templates t
  where t.programme_id = v_programme_id
    and t.product_code = v_product_code
    and t.active = true
  order by t.version desc
  limit 1;

  if found then
    new.template_id := v_template.id;
    new.template_version := v_template.version;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'templateId', v_template.id,
      'templateVersion', v_template.version,
      'issuerName', v_template.issuer_name
    );
  end if;

  new.revision_number := greatest(coalesce(new.revision_number, 1), 1);
  return new;
end;
$$;

drop trigger if exists agilecert_prepare_certificate_insert_trigger
  on public.agilecert_issued_certificates;
create trigger agilecert_prepare_certificate_insert_trigger
  before insert on public.agilecert_issued_certificates
  for each row
  execute function public.agilecert_prepare_certificate_insert();

create or replace function public.agilecert_audit_certificate_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_event text;
begin
  if tg_op = 'INSERT' then
    v_actor := coalesce(new.issued_by, auth.uid());
    insert into public.agilecert_certificate_audit_events (
      certificate_id, eligibility_id, candidate_id, actor_id, event_type, metadata
    ) values (
      new.id, new.eligibility_id, new.candidate_id, v_actor, 'issued',
      jsonb_build_object(
        'certificateNumber', new.certificate_number,
        'revisionNumber', new.revision_number,
        'templateId', new.template_id,
        'templateVersion', new.template_version
      )
    );
    return new;
  end if;

  v_actor := coalesce(new.corrected_by, new.status_changed_by, auth.uid());

  if old.status is distinct from new.status then
    v_event := case new.status
      when 'active' then 'activated'
      when 'suspended' then 'suspended'
      when 'revoked' then 'revoked'
      else 'status_changed'
    end;
    insert into public.agilecert_certificate_audit_events (
      certificate_id, eligibility_id, candidate_id, actor_id, event_type, metadata
    ) values (
      new.id, new.eligibility_id, new.candidate_id, v_actor, v_event,
      jsonb_build_object(
        'previousStatus', old.status,
        'status', new.status,
        'reason', new.revocation_reason
      )
    );
  end if;

  if old.certificate_number is distinct from new.certificate_number
     or old.verification_code is distinct from new.verification_code then
    insert into public.agilecert_certificate_audit_events (
      certificate_id, eligibility_id, candidate_id, actor_id, event_type, metadata
    ) values (
      new.id, new.eligibility_id, new.candidate_id, v_actor, 'reissued',
      jsonb_build_object(
        'previousCertificateNumber', old.certificate_number,
        'certificateNumber', new.certificate_number,
        'revisionNumber', new.revision_number,
        'reason', new.correction_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_certificate_change_audit_trigger
  on public.agilecert_issued_certificates;
create trigger agilecert_certificate_change_audit_trigger
  after insert or update of status, certificate_number, verification_code
  on public.agilecert_issued_certificates
  for each row
  execute function public.agilecert_audit_certificate_change();

create or replace function public.set_agilecert_certificate_approval_policy(
  p_examination_id uuid,
  p_approval_mode text,
  p_require_candidate_request boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_mode text := lower(trim(coalesce(p_approval_mode, 'automatic')));
  v_policy public.agilecert_certificate_policies%rowtype;
begin
  if v_mode not in ('automatic', 'manual') then
    raise exception 'Approval mode must be automatic or manual.';
  end if;

  update public.agilecert_certificate_policies
  set approval_mode = v_mode,
      require_candidate_request = coalesce(p_require_candidate_request, false),
      updated_by = v_admin_id,
      updated_at = now()
  where examination_id = p_examination_id
  returning * into v_policy;

  if not found then
    raise exception 'The certificate policy was not found.';
  end if;

  if v_mode = 'manual' then
    update public.agilecert_certificate_eligibility_records
    set approval_status = case
          when eligibility_status = 'issued' then 'approved'
          when eligibility_status = 'requested' then 'pending'
          else approval_status
        end,
        approval_updated_at = now()
    where examination_id = p_examination_id;
  else
    update public.agilecert_certificate_eligibility_records
    set approval_status = case
          when eligibility_status = 'issued' then 'approved'
          else 'not_required'
        end,
        approval_reason = null,
        approval_decided_at = null,
        approval_decided_by = null,
        approval_updated_at = now()
    where examination_id = p_examination_id
      and eligibility_status <> 'issued';
  end if;

  insert into public.agilecert_certificate_audit_events (
    actor_id, event_type, metadata
  ) values (
    v_admin_id,
    'approval_policy_updated',
    jsonb_build_object(
      'examinationId', p_examination_id,
      'approvalMode', v_mode,
      'requireCandidateRequest', coalesce(p_require_candidate_request, false)
    )
  );

  return jsonb_build_object(
    'examinationId', v_policy.examination_id,
    'approvalMode', v_policy.approval_mode,
    'requireCandidateRequest', v_policy.require_candidate_request,
    'updatedAt', v_policy.updated_at
  );
end;
$$;

create or replace function public.decide_agilecert_certificate_request(
  p_eligibility_id uuid,
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
  v_record public.agilecert_certificate_eligibility_records%rowtype;
begin
  if v_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Decision must be approved, changes_requested or rejected.';
  end if;
  if v_decision <> 'approved' and (v_reason is null or length(v_reason) < 5) then
    raise exception 'A clear reason is required for rejection or requested changes.';
  end if;

  select * into v_record
  from public.agilecert_certificate_eligibility_records
  where id = p_eligibility_id
  for update;

  if not found then
    raise exception 'The certificate eligibility record was not found.';
  end if;
  if v_record.eligibility_status = 'issued' then
    raise exception 'This certificate has already been issued.';
  end if;

  update public.agilecert_certificate_eligibility_records
  set approval_status = v_decision,
      approval_reason = case when v_decision = 'approved' then null else left(v_reason, 1000) end,
      approval_decided_at = now(),
      approval_decided_by = v_admin_id,
      approval_updated_at = now(),
      updated_at = now()
  where id = p_eligibility_id
  returning * into v_record;

  insert into public.agilecert_certificate_approval_decisions (
    eligibility_id, decision, reason, decided_by, metadata
  ) values (
    p_eligibility_id,
    v_decision,
    case when v_decision = 'approved' then null else left(v_reason, 1000) end,
    v_admin_id,
    jsonb_build_object(
      'eligibilityStatus', v_record.eligibility_status,
      'examinationId', v_record.examination_id
    )
  );

  insert into public.agilecert_certificate_audit_events (
    eligibility_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.id,
    v_record.candidate_id,
    v_admin_id,
    'request_' || v_decision,
    jsonb_build_object('reason', v_record.approval_reason)
  );

  return jsonb_build_object(
    'eligibilityId', v_record.id,
    'approvalStatus', v_record.approval_status,
    'approvalReason', v_record.approval_reason,
    'approvalDecidedAt', v_record.approval_decided_at
  );
end;
$$;

create or replace function public.upsert_agilecert_certificate_template(
  p_template_id uuid,
  p_programme_id uuid,
  p_product_code text,
  p_template_name text,
  p_certificate_title text,
  p_issuer_name text,
  p_subtitle text,
  p_left_signatory_name text,
  p_left_signatory_title text,
  p_right_signatory_name text,
  p_right_signatory_title text,
  p_primary_colour text,
  p_accent_colour text,
  p_layout_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_product text := lower(trim(coalesce(p_product_code, 'achievement')));
  v_template public.agilecert_certificate_templates%rowtype;
  v_next_version integer;
begin
  if v_product not in ('achievement', 'professional') then
    raise exception 'Certificate product must be achievement or professional.';
  end if;
  if not exists (select 1 from public.programmes where id = p_programme_id) then
    raise exception 'The programme was not found.';
  end if;
  if coalesce(p_primary_colour, '') !~ '^#[0-9A-Fa-f]{6}$'
     or coalesce(p_accent_colour, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Template colours must be six-digit hexadecimal values.';
  end if;

  if p_template_id is not null then
    select * into v_template
    from public.agilecert_certificate_templates
    where id = p_template_id;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.agilecert_certificate_templates
  where programme_id = p_programme_id
    and product_code = v_product;

  update public.agilecert_certificate_templates
  set active = false,
      updated_by = v_admin_id,
      updated_at = now()
  where programme_id = p_programme_id
    and product_code = v_product
    and active = true;

  insert into public.agilecert_certificate_templates (
    programme_id, product_code, template_name, version, active,
    certificate_title, issuer_name, subtitle,
    left_signatory_name, left_signatory_title,
    right_signatory_name, right_signatory_title,
    primary_colour, accent_colour, layout_config,
    created_by, updated_by
  ) values (
    p_programme_id,
    v_product,
    trim(p_template_name),
    v_next_version,
    true,
    trim(p_certificate_title),
    trim(p_issuer_name),
    trim(p_subtitle),
    trim(p_left_signatory_name),
    trim(p_left_signatory_title),
    trim(p_right_signatory_name),
    trim(p_right_signatory_title),
    lower(p_primary_colour),
    lower(p_accent_colour),
    coalesce(p_layout_config, '{}'::jsonb),
    v_admin_id,
    v_admin_id
  ) returning * into v_template;

  insert into public.agilecert_certificate_audit_events (
    actor_id, event_type, metadata
  ) values (
    v_admin_id,
    'template_version_created',
    jsonb_build_object(
      'templateId', v_template.id,
      'programmeId', v_template.programme_id,
      'productCode', v_template.product_code,
      'version', v_template.version
    )
  );

  return jsonb_build_object(
    'id', v_template.id,
    'programmeId', v_template.programme_id,
    'productCode', v_template.product_code,
    'templateName', v_template.template_name,
    'version', v_template.version,
    'active', v_template.active,
    'certificateTitle', v_template.certificate_title,
    'issuerName', v_template.issuer_name,
    'subtitle', v_template.subtitle,
    'leftSignatoryName', v_template.left_signatory_name,
    'leftSignatoryTitle', v_template.left_signatory_title,
    'rightSignatoryName', v_template.right_signatory_name,
    'rightSignatoryTitle', v_template.right_signatory_title,
    'primaryColour', v_template.primary_colour,
    'accentColour', v_template.accent_colour,
    'layoutConfig', v_template.layout_config,
    'updatedAt', v_template.updated_at
  );
end;
$$;

create or replace function public.correct_and_reissue_agilecert_certificate(
  p_certificate_id uuid,
  p_holder_name text,
  p_certificate_title text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_safe_programme_code text;
  v_serial bigint;
  v_new_number text;
  v_new_code text;
  v_new_holder text;
  v_new_title text;
begin
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'A clear correction or reissuance reason is required.';
  end if;

  select * into v_certificate
  from public.agilecert_issued_certificates
  where id = p_certificate_id
  for update;

  if not found then
    raise exception 'The issued certificate was not found.';
  end if;
  if v_certificate.status = 'revoked' then
    raise exception 'A revoked certificate cannot be corrected and reissued.';
  end if;

  v_new_holder := coalesce(nullif(trim(p_holder_name), ''), v_certificate.holder_name);
  v_new_title := coalesce(nullif(trim(p_certificate_title), ''), v_certificate.certificate_title);
  if length(v_new_holder) < 3 or length(v_new_title) < 3 then
    raise exception 'Holder name and certificate title must contain at least three characters.';
  end if;

  insert into public.agilecert_certificate_revisions (
    certificate_id, revision_number, certificate_number, verification_code,
    holder_name, certificate_title, examination_title, programme_code,
    score, pass_mark, issue_date, issued_at, status,
    template_id, template_version, metadata,
    superseded_reason, superseded_by
  ) values (
    v_certificate.id,
    v_certificate.revision_number,
    v_certificate.certificate_number,
    v_certificate.verification_code,
    v_certificate.holder_name,
    v_certificate.certificate_title,
    v_certificate.examination_title,
    v_certificate.programme_code,
    v_certificate.score,
    v_certificate.pass_mark,
    v_certificate.issue_date,
    v_certificate.issued_at,
    v_certificate.status,
    v_certificate.template_id,
    v_certificate.template_version,
    v_certificate.metadata,
    left(v_reason, 1000),
    v_admin_id
  );

  v_safe_programme_code := regexp_replace(
    upper(coalesce(v_certificate.programme_code, 'CERT')),
    '[^A-Z0-9]+', '', 'g'
  );
  if v_safe_programme_code = '' then
    v_safe_programme_code := 'CERT';
  end if;

  v_serial := nextval('public.agilecert_certificate_serial_seq');
  v_new_number := format(
    'IIPM/%s/%s/%s',
    v_safe_programme_code,
    to_char(now(), 'YYYY'),
    lpad(v_serial::text, 6, '0')
  );
  v_new_code := upper(encode(gen_random_bytes(9), 'hex'));

  update public.agilecert_issued_certificates
  set certificate_number = v_new_number,
      verification_code = v_new_code,
      holder_name = v_new_holder,
      certificate_title = v_new_title,
      issue_date = current_date,
      issued_at = now(),
      status = 'active',
      status_changed_at = now(),
      status_changed_by = v_admin_id,
      revocation_reason = null,
      revision_number = revision_number + 1,
      corrected_at = now(),
      corrected_by = v_admin_id,
      correction_reason = left(v_reason, 1000),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'reissuedAt', now(),
        'reissuedBy', v_admin_id,
        'reissueReason', left(v_reason, 1000),
        'previousCertificateNumber', v_certificate.certificate_number,
        'previousVerificationCodeHash', encode(digest(lower(v_certificate.verification_code), 'sha256'), 'hex')
      ),
      updated_at = now()
  where id = p_certificate_id
  returning * into v_certificate;

  update public.agilecert_paid_credentials
  set verification_url =
        'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || v_certificate.verification_code,
      status = v_certificate.status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'certificateNumber', v_certificate.certificate_number,
        'verificationCode', v_certificate.verification_code,
        'certificateRevision', v_certificate.revision_number,
        'reissuedAt', now()
      ),
      updated_at = now()
  where certificate_id = v_certificate.id;

  return jsonb_build_object(
    'id', v_certificate.id,
    'certificateNumber', v_certificate.certificate_number,
    'verificationCode', v_certificate.verification_code,
    'holderName', v_certificate.holder_name,
    'certificateTitle', v_certificate.certificate_title,
    'revisionNumber', v_certificate.revision_number,
    'issueDate', v_certificate.issue_date,
    'issuedAt', v_certificate.issued_at,
    'status', v_certificate.status
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
  v_policy public.agilecert_certificate_policies%rowtype;
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
  if v_record.approval_status = 'rejected' then
    raise exception 'This certificate request was rejected. Contact IIPM support for further review.';
  end if;

  select * into v_policy
  from public.agilecert_certificate_policies
  where examination_id = v_record.examination_id;

  update public.agilecert_certificate_eligibility_records
  set eligibility_status = 'requested',
      requested_at = now(),
      approval_status = case
        when coalesce(v_policy.approval_mode, 'automatic') = 'manual' then 'pending'
        else 'not_required'
      end,
      approval_reason = null,
      approval_decided_at = null,
      approval_decided_by = null,
      approval_updated_at = now(),
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_certificate_audit_events (
    eligibility_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.id,
    v_record.candidate_id,
    v_candidate_id,
    case when v_record.approval_status = 'pending'
      then 'request_submitted_for_approval'
      else 'request_submitted'
    end,
    jsonb_build_object('approvalStatus', v_record.approval_status)
  );

  return jsonb_build_object(
    'eligibilityId', v_record.id,
    'status', 'requested',
    'approvalStatus', v_record.approval_status,
    'message', case when v_record.approval_status = 'pending'
      then 'Your certificate request has been submitted for administrator approval.'
      else 'Your certificate request has been recorded.'
    end
  );
end;
$$;

create or replace function public.get_my_agilecert_certificate_workspace_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_items jsonb;
begin
  v_base := public.get_my_agilecert_certificate_workspace();

  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'approvalStatus', er.approval_status,
      'approvalReason', er.approval_reason,
      'approvalDecidedAt', er.approval_decided_at,
      'approvalMode', coalesce(cp.approval_mode, 'automatic'),
      'requireCandidateRequest', coalesce(cp.require_candidate_request, false)
    )
  ), '[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_base->'items', '[]'::jsonb)) item
  join public.agilecert_certificate_eligibility_records er
    on er.id = (item->>'eligibilityId')::uuid
  left join public.agilecert_certificate_policies cp
    on cp.examination_id = er.examination_id;

  return jsonb_set(v_base, '{items}', v_items, true);
end;
$$;

create or replace function public.get_my_agilecert_certificate_render_payload(
  p_certificate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_template public.agilecert_certificate_templates%rowtype;
  v_is_admin boolean := false;
  v_product_code text;
begin
  if v_user_id is null then
    raise exception 'Sign in to download an issued certificate.';
  end if;

  v_is_admin := public.agilecert_is_certificate_admin();
  select * into v_certificate
  from public.agilecert_issued_certificates
  where id = p_certificate_id
    and (candidate_id = v_user_id or v_is_admin);

  if not found then
    raise exception 'The issued certificate was not found or is not available to this account.';
  end if;
  if v_certificate.status <> 'active' then
    raise exception 'Only an active certificate can be rendered as an active credential.';
  end if;

  select * into v_template
  from public.agilecert_certificate_templates
  where id = v_certificate.template_id;

  if not found then
    select t.* into v_template
    from public.agilecert_certificate_templates t
    join public.examinations e on e.programme_id = t.programme_id
    where e.id = v_certificate.examination_id
      and t.product_code = lower(coalesce(nullif(v_certificate.metadata->>'productCode', ''), 'achievement'))
      and t.active = true
    order by t.version desc
    limit 1;
  end if;

  v_product_code := lower(coalesce(nullif(v_certificate.metadata->>'productCode', ''), 'achievement'));

  insert into public.agilecert_certificate_audit_events (
    certificate_id, eligibility_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_certificate.id,
    v_certificate.eligibility_id,
    v_certificate.candidate_id,
    v_user_id,
    'pdf_render_requested',
    jsonb_build_object(
      'revisionNumber', v_certificate.revision_number,
      'templateId', v_template.id,
      'templateVersion', v_template.version
    )
  );

  return jsonb_build_object(
    'certificate', jsonb_build_object(
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
      'status', v_certificate.status,
      'revisionNumber', v_certificate.revision_number,
      'productCode', v_product_code
    ),
    'template', case when v_template.id is null then null else jsonb_build_object(
      'id', v_template.id,
      'programmeId', v_template.programme_id,
      'productCode', v_template.product_code,
      'templateName', v_template.template_name,
      'version', v_template.version,
      'certificateTitle', v_template.certificate_title,
      'issuerName', v_template.issuer_name,
      'subtitle', v_template.subtitle,
      'leftSignatoryName', v_template.left_signatory_name,
      'leftSignatoryTitle', v_template.left_signatory_title,
      'rightSignatoryName', v_template.right_signatory_name,
      'rightSignatoryTitle', v_template.right_signatory_title,
      'primaryColour', v_template.primary_colour,
      'accentColour', v_template.accent_colour,
      'layoutConfig', v_template.layout_config
    ) end,
    'verificationUrl',
      'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || v_certificate.verification_code
  );
end;
$$;

create or replace function public.get_agilecert_certificate_completion_console(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
  v_queue jsonb;
  v_templates jsonb;
  v_decisions jsonb;
  v_revisions jsonb;
  v_audits jsonb;
  v_policies jsonb;
begin
  perform public.agilecert_require_certificate_admin();


  select coalesce(jsonb_agg(payload order by approval_updated_at desc), '[]'::jsonb)
  into v_queue
  from (
    select er.approval_updated_at,
      jsonb_build_object(
        'eligibilityId', er.id,
        'candidateName', candidate.full_name,
        'candidateEmail', candidate.email,
        'examinationId', er.examination_id,
        'examinationTitle', e.title,
        'programmeCode', p.code,
        'score', er.score,
        'passMark', er.pass_mark,
        'integrityStatus', er.integrity_status,
        'eligibilityStatus', er.eligibility_status,
        'approvalStatus', er.approval_status,
        'approvalReason', er.approval_reason,
        'requestedAt', er.requested_at,
        'approvalUpdatedAt', er.approval_updated_at
      ) payload
    from public.agilecert_certificate_eligibility_records er
    join public.profiles candidate on candidate.id = er.candidate_id
    join public.examinations e on e.id = er.examination_id
    join public.programmes p on p.id = e.programme_id
    join public.agilecert_certificate_policies cp on cp.examination_id = er.examination_id
    where cp.approval_mode = 'manual'
      and er.eligibility_status <> 'issued'
      and er.approval_status in ('pending', 'changes_requested', 'rejected')
    order by er.approval_updated_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'programmeId', t.programme_id,
    'programmeCode', p.code,
    'programmeName', p.name,
    'productCode', t.product_code,
    'templateName', t.template_name,
    'version', t.version,
    'active', t.active,
    'certificateTitle', t.certificate_title,
    'issuerName', t.issuer_name,
    'subtitle', t.subtitle,
    'leftSignatoryName', t.left_signatory_name,
    'leftSignatoryTitle', t.left_signatory_title,
    'rightSignatoryName', t.right_signatory_name,
    'rightSignatoryTitle', t.right_signatory_title,
    'primaryColour', t.primary_colour,
    'accentColour', t.accent_colour,
    'layoutConfig', t.layout_config,
    'updatedAt', t.updated_at
  ) order by p.name, t.product_code, t.version desc), '[]'::jsonb)
  into v_templates
  from public.agilecert_certificate_templates t
  join public.programmes p on p.id = t.programme_id;

  select coalesce(jsonb_agg(payload order by decided_at desc), '[]'::jsonb)
  into v_decisions
  from (
    select d.decided_at,
      jsonb_build_object(
        'id', d.id,
        'eligibilityId', d.eligibility_id,
        'candidateName', candidate.full_name,
        'examinationTitle', e.title,
        'decision', d.decision,
        'reason', d.reason,
        'decidedBy', admin.full_name,
        'decidedAt', d.decided_at
      ) payload
    from public.agilecert_certificate_approval_decisions d
    join public.agilecert_certificate_eligibility_records er on er.id = d.eligibility_id
    join public.profiles candidate on candidate.id = er.candidate_id
    join public.examinations e on e.id = er.examination_id
    left join public.profiles admin on admin.id = d.decided_by
    order by d.decided_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by superseded_at desc), '[]'::jsonb)
  into v_revisions
  from (
    select r.superseded_at,
      jsonb_build_object(
        'id', r.id,
        'certificateId', r.certificate_id,
        'revisionNumber', r.revision_number,
        'certificateNumber', r.certificate_number,
        'verificationCode', r.verification_code,
        'holderName', r.holder_name,
        'certificateTitle', r.certificate_title,
        'examinationTitle', r.examination_title,
        'status', 'superseded',
        'supersededReason', r.superseded_reason,
        'supersededBy', admin.full_name,
        'supersededAt', r.superseded_at
      ) payload
    from public.agilecert_certificate_revisions r
    left join public.profiles admin on admin.id = r.superseded_by
    order by r.superseded_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
  into v_audits
  from (
    select a.created_at,
      jsonb_build_object(
        'id', a.id,
        'certificateId', a.certificate_id,
        'eligibilityId', a.eligibility_id,
        'eventType', a.event_type,
        'actorName', actor.full_name,
        'metadata', a.metadata,
        'createdAt', a.created_at
      ) payload
    from public.agilecert_certificate_audit_events a
    left join public.profiles actor on actor.id = a.actor_id
    order by a.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(jsonb_build_object(
    'examinationId', cp.examination_id,
    'examinationTitle', e.title,
    'programmeCode', p.code,
    'approvalMode', cp.approval_mode,
    'requireCandidateRequest', cp.require_candidate_request,
    'active', cp.active,
    'updatedAt', cp.updated_at
  ) order by e.title), '[]'::jsonb)
  into v_policies
  from public.agilecert_certificate_policies cp
  join public.examinations e on e.id = cp.examination_id
  join public.programmes p on p.id = e.programme_id;

  return jsonb_build_object(
    'templates', v_templates,
    'approvalQueue', v_queue,
    'decisions', v_decisions,
    'revisions', v_revisions,
    'auditEvents', v_audits,
    'approvalPolicies', v_policies
  );
end;
$$;

create or replace function public.verify_agilecert_certificate(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_hash text;
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_revision public.agilecert_certificate_revisions%rowtype;
  v_issuer text;
begin
  v_hash := encode(digest(lower(v_code), 'sha256'), 'hex');

  if length(v_code) < 6 then
    insert into public.agilecert_certificate_audit_events (
      event_type, lookup_code_hash, metadata
    ) values (
      'verification_invalid_input', v_hash, jsonb_build_object('inputLength', length(v_code))
    );
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

  if found then
    select coalesce(t.issuer_name, cp.issuer_name) into v_issuer
    from public.agilecert_certificate_policies cp
    left join public.agilecert_certificate_templates t on t.id = v_certificate.template_id
    where cp.examination_id = v_certificate.examination_id;

    insert into public.agilecert_certificate_audit_events (
      certificate_id, eligibility_id, candidate_id, event_type, lookup_code_hash, metadata
    ) values (
      v_certificate.id,
      v_certificate.eligibility_id,
      v_certificate.candidate_id,
      case when v_certificate.status = 'active' then 'verification_success' else 'verification_restricted' end,
      v_hash,
      jsonb_build_object('status', v_certificate.status, 'revisionNumber', v_certificate.revision_number)
    );

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
      'revisionNumber', v_certificate.revision_number,
      'issuer', coalesce(v_issuer, 'Integrated Institute of Professional Management (IIPM)'),
      'poweredBy', 'AgileCert Global',
      'message', case
        when v_certificate.status = 'active' then 'This certificate is active and verifiable.'
        when v_certificate.status = 'suspended' then 'This certificate is currently suspended.'
        else 'This certificate has been revoked.'
      end
    );
  end if;

  select * into v_revision
  from public.agilecert_certificate_revisions r
  where lower(r.certificate_number) = lower(v_code)
     or lower(r.verification_code) = lower(v_code)
  limit 1;

  if found then
    insert into public.agilecert_certificate_audit_events (
      certificate_id, event_type, lookup_code_hash, metadata
    ) values (
      v_revision.certificate_id,
      'verification_superseded',
      v_hash,
      jsonb_build_object('revisionNumber', v_revision.revision_number)
    );

    return jsonb_build_object(
      'found', true,
      'valid', false,
      'status', 'superseded',
      'certificateNumber', v_revision.certificate_number,
      'verificationCode', v_revision.verification_code,
      'holderName', v_revision.holder_name,
      'certificateTitle', v_revision.certificate_title,
      'examinationTitle', v_revision.examination_title,
      'programmeCode', v_revision.programme_code,
      'score', v_revision.score,
      'passMark', v_revision.pass_mark,
      'issueDate', v_revision.issue_date,
      'issuedAt', v_revision.issued_at,
      'revisionNumber', v_revision.revision_number,
      'issuer', 'Integrated Institute of Professional Management (IIPM)',
      'poweredBy', 'AgileCert Global',
      'message', 'This certificate number has been superseded by a corrected or reissued certificate.'
    );
  end if;

  insert into public.agilecert_certificate_audit_events (
    event_type, lookup_code_hash, metadata
  ) values (
    'verification_not_found', v_hash, '{}'::jsonb
  );

  return jsonb_build_object(
    'found', false,
    'valid', false,
    'message', 'No AgileCert certificate matches the supplied code.'
  );
end;
$$;

update public.agilecert_certificate_eligibility_records er
set approval_status = case
      when er.eligibility_status = 'issued' then 'approved'
      when er.eligibility_status = 'requested'
       and coalesce(cp.approval_mode, 'automatic') = 'manual' then 'pending'
      else 'not_required'
    end,
    approval_updated_at = now()
from public.agilecert_certificate_policies cp
where cp.examination_id = er.examination_id;

update public.agilecert_issued_certificates c
set template_id = t.id,
    template_version = t.version,
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'templateId', t.id,
      'templateVersion', t.version,
      'issuerName', t.issuer_name
    ),
    updated_at = now()
from public.examinations e
join public.agilecert_certificate_templates t
  on t.programme_id = e.programme_id
 and t.product_code = case
   when lower(coalesce(nullif(c.metadata->>'productCode', ''), 'achievement')) = 'professional'
     then 'professional'
   else 'achievement'
 end
 and t.active = true
where e.id = c.examination_id
  and c.template_id is null;

alter table public.agilecert_certificate_templates enable row level security;
alter table public.agilecert_certificate_approval_decisions enable row level security;
alter table public.agilecert_certificate_revisions enable row level security;
alter table public.agilecert_certificate_audit_events enable row level security;

drop policy if exists agilecert_certificate_templates_admin_select
  on public.agilecert_certificate_templates;
create policy agilecert_certificate_templates_admin_select
  on public.agilecert_certificate_templates
  for select to authenticated
  using (public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_approval_decisions_admin_select
  on public.agilecert_certificate_approval_decisions;
create policy agilecert_certificate_approval_decisions_admin_select
  on public.agilecert_certificate_approval_decisions
  for select to authenticated
  using (public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_revisions_admin_select
  on public.agilecert_certificate_revisions;
create policy agilecert_certificate_revisions_admin_select
  on public.agilecert_certificate_revisions
  for select to authenticated
  using (public.agilecert_is_certificate_admin());

drop policy if exists agilecert_certificate_audit_events_admin_select
  on public.agilecert_certificate_audit_events;
create policy agilecert_certificate_audit_events_admin_select
  on public.agilecert_certificate_audit_events
  for select to authenticated
  using (public.agilecert_is_certificate_admin());

revoke all on public.agilecert_certificate_templates from public, anon, authenticated;
revoke all on public.agilecert_certificate_approval_decisions from public, anon, authenticated;
revoke all on public.agilecert_certificate_revisions from public, anon, authenticated;
revoke all on public.agilecert_certificate_audit_events from public, anon, authenticated;
grant select on public.agilecert_certificate_templates to authenticated;
grant select on public.agilecert_certificate_approval_decisions to authenticated;
grant select on public.agilecert_certificate_revisions to authenticated;
grant select on public.agilecert_certificate_audit_events to authenticated;

revoke all on function public.agilecert_sync_certificate_request_approval() from public, anon, authenticated;
revoke all on function public.agilecert_prepare_certificate_insert() from public, anon, authenticated;
revoke all on function public.agilecert_audit_certificate_change() from public, anon, authenticated;

revoke all on function public.set_agilecert_certificate_approval_policy(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_agilecert_certificate_approval_policy(uuid, text, boolean)
  to authenticated;

revoke all on function public.decide_agilecert_certificate_request(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.decide_agilecert_certificate_request(uuid, text, text)
  to authenticated;

revoke all on function public.upsert_agilecert_certificate_template(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.upsert_agilecert_certificate_template(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

revoke all on function public.correct_and_reissue_agilecert_certificate(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.correct_and_reissue_agilecert_certificate(uuid, text, text, text)
  to authenticated;

revoke all on function public.get_my_agilecert_certificate_workspace_v2()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_workspace_v2()
  to authenticated;

revoke all on function public.get_my_agilecert_certificate_render_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_render_payload(uuid)
  to authenticated;

revoke all on function public.get_agilecert_certificate_completion_console(integer)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_certificate_completion_console(integer)
  to authenticated;

revoke all on function public.verify_agilecert_certificate(text)
  from public, anon, authenticated;
grant execute on function public.verify_agilecert_certificate(text)
  to anon, authenticated;

comment on table public.agilecert_certificate_templates is
  'Versioned programme and certificate-product templates used for QR-coded certificate rendering.';
comment on table public.agilecert_certificate_revisions is
  'Immutable snapshots of superseded certificate numbers and verification codes.';
comment on table public.agilecert_certificate_audit_events is
  'Privacy-bounded issuance, lifecycle, rendering and public-verification audit events.';
comment on function public.correct_and_reissue_agilecert_certificate(uuid, text, text, text) is
  'Archives the current certificate snapshot and reissues the same credential with a new number and verification code.';

notify pgrst, 'reload schema';

commit;
