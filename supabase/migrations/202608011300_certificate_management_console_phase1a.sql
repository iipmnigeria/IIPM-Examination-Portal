begin;

-- ---------------------------------------------------------------------------
-- Phase 1A — Certificate Management Console Foundation
--
-- Multi-institution, multi-category master-template administration for all
-- certificates issued through the portal. This migration does not alter
-- certificate eligibility, payment, examination, issuance, verification codes
-- or previously issued certificate records.
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_certificate_permission_definitions (
  permission_key text primary key,
  name text not null,
  description text not null,
  category text not null,
  risk_level text not null default 'standard'
    check (risk_level in ('standard', 'sensitive', 'restricted')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_certificate_role_permissions (
  role text not null,
  permission_key text not null references public.agilecert_certificate_permission_definitions(permission_key) on delete cascade,
  is_granted boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (role, permission_key),
  check (role in ('exam_admin'))
);

insert into public.agilecert_certificate_permission_definitions (
  permission_key, name, description, category, risk_level
) values
  ('certificate.console.view', 'View Certificate Management Console', 'View issuing institutions, categories, master templates, versions, assets, assignments and audit history.', 'console', 'standard'),
  ('certificate.institutions.manage', 'Manage Issuing Institutions', 'Create and update awarding institutions and their official identity details.', 'institutions', 'restricted'),
  ('certificate.categories.manage', 'Manage Certificate Categories', 'Create and maintain completion, achievement, professional and future certificate categories.', 'categories', 'sensitive'),
  ('certificate.templates.manage', 'Manage Master Templates', 'Create template records, upload immutable master files and submit versions for review.', 'templates', 'sensitive'),
  ('certificate.templates.review', 'Review Master Templates', 'Record print-quality review results and request corrections before approval.', 'templates', 'sensitive'),
  ('certificate.templates.approve', 'Approve Master Templates', 'Approve reviewed certificate master versions for controlled publication.', 'templates', 'restricted'),
  ('certificate.templates.publish', 'Publish Master Templates', 'Publish, supersede or retire approved certificate master versions.', 'templates', 'restricted'),
  ('certificate.assets.manage', 'Manage Certificate Assets', 'Upload and version institutional logos, seals, watermarks and signatures.', 'assets', 'sensitive'),
  ('certificate.assets.approve', 'Approve Certificate Assets', 'Approve or retire institutional certificate assets after quality review.', 'assets', 'restricted'),
  ('certificate.assignments.manage', 'Manage Template Assignments', 'Assign published template versions globally or to programmes and examinations.', 'assignments', 'restricted'),
  ('certificate.permissions.manage', 'Manage Certificate Permissions', 'Grant or revoke Certificate Management Console permissions for Examination Administrators.', 'permissions', 'restricted')
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

insert into public.agilecert_certificate_role_permissions(role, permission_key, is_granted)
values
  ('exam_admin', 'certificate.console.view', true),
  ('exam_admin', 'certificate.institutions.manage', false),
  ('exam_admin', 'certificate.categories.manage', false),
  ('exam_admin', 'certificate.templates.manage', true),
  ('exam_admin', 'certificate.templates.review', true),
  ('exam_admin', 'certificate.templates.approve', false),
  ('exam_admin', 'certificate.templates.publish', false),
  ('exam_admin', 'certificate.assets.manage', true),
  ('exam_admin', 'certificate.assets.approve', false),
  ('exam_admin', 'certificate.assignments.manage', false),
  ('exam_admin', 'certificate.permissions.manage', false)
on conflict (role, permission_key) do nothing;

create table if not exists public.agilecert_certificate_institutions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  short_name text,
  legal_name text,
  registration_details text,
  country_code text not null default 'NG' check (country_code ~ '^[A-Z]{2}$'),
  website text,
  contact_email text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[A-Z0-9_-]{2,30}$')
);

create unique index if not exists agilecert_certificate_institutions_code_uidx
  on public.agilecert_certificate_institutions(upper(code));

create table if not exists public.agilecert_certificate_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text not null default '',
  requires_identity_verification boolean not null default false,
  requires_score boolean not null default false,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[a-z0-9_-]{2,40}$')
);

create unique index if not exists agilecert_certificate_categories_code_uidx
  on public.agilecert_certificate_categories(lower(code));

insert into public.agilecert_certificate_institutions (
  code, name, short_name, legal_name, country_code, website, is_active
) values
  ('IIPM', 'Integrated Institute of Professional Management', 'IIPM', 'Integrated Institute of Professional Management', 'NG', 'https://iipmi.org', true),
  ('CIPMN', 'Chartered Institute of Project Managers of Nigeria', 'CIPMN', 'Chartered Institute of Project Managers of Nigeria', 'NG', null, true)
on conflict do nothing;

insert into public.agilecert_certificate_categories (
  code, name, description, requires_identity_verification, requires_score, sort_order, is_active
) values
  ('completion', 'Certificate of Completion', 'Confirms successful completion of an approved course, module or learning programme.', false, false, 10, true),
  ('achievement', 'Certificate of Achievement', 'Recognises achievement against an approved assessment or performance standard.', false, true, 20, true),
  ('professional', 'Professional Certificate', 'Professional credential requiring the approved programme, identity and issuance controls.', true, true, 30, true)
on conflict do nothing;

create table if not exists public.agilecert_certificate_assets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.agilecert_certificate_institutions(id) on delete restrict,
  asset_type text not null
    check (asset_type in ('logo', 'seal', 'signature', 'watermark', 'background', 'emblem', 'other')),
  name text not null,
  version_number integer not null default 1 check (version_number > 0),
  storage_bucket text not null default 'certificate-assets',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  pixel_width integer,
  pixel_height integer,
  sha256 text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'retired', 'rejected')),
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  retired_by uuid references public.profiles(id),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);

create unique index if not exists agilecert_certificate_assets_version_uidx
  on public.agilecert_certificate_assets(institution_id, asset_type, lower(name), version_number);
create index if not exists agilecert_certificate_assets_institution_idx
  on public.agilecert_certificate_assets(institution_id, status, asset_type);

create table if not exists public.agilecert_certificate_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.agilecert_certificate_institutions(id) on delete restrict,
  category_id uuid not null references public.agilecert_certificate_categories(id) on delete restrict,
  code text not null,
  name text not null,
  description text not null default '',
  orientation text not null default 'landscape' check (orientation in ('portrait', 'landscape')),
  page_size text not null default 'A4' check (page_size in ('A4', 'Letter', 'Legal', 'Custom')),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published', 'retired')),
  current_version_id uuid,
  required_fields jsonb not null default '["holderName","certificateTitle","programmeTitle","issueDate","certificateNumber","verificationCode","qrCode"]'::jsonb,
  quality_standard jsonb not null default jsonb_build_object(
    'minimumPrintDpi', 300,
    'masterFormats', jsonb_build_array('pdf', 'svg', 'png', 'jpeg'),
    'singlePageRequired', true,
    'physicalPrintReviewRequired', true,
    'longNameTestRequired', true,
    'qrScanTestRequired', true
  ),
  effective_from timestamptz,
  effective_to timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[A-Z0-9_-]{2,50}$'),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create unique index if not exists agilecert_certificate_templates_code_uidx
  on public.agilecert_certificate_templates(institution_id, upper(code));
create index if not exists agilecert_certificate_templates_category_idx
  on public.agilecert_certificate_templates(category_id, status, institution_id);

create table if not exists public.agilecert_certificate_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agilecert_certificate_templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  source_format text not null check (source_format in ('pdf', 'svg', 'png', 'jpeg')),
  storage_bucket text not null default 'certificate-masters',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256 text,
  page_width_points numeric(10,3),
  page_height_points numeric(10,3),
  pixel_width integer,
  pixel_height integer,
  overlay_schema jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'approved', 'published', 'superseded', 'rejected', 'retired')),
  quality_status text not null default 'pending'
    check (quality_status in ('pending', 'passed', 'failed', 'waived')),
  quality_report jsonb not null default '{}'::jsonb,
  notes text,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version_number),
  unique (storage_bucket, storage_path),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);

alter table public.agilecert_certificate_templates
  drop constraint if exists agilecert_certificate_templates_current_version_fk;
alter table public.agilecert_certificate_templates
  add constraint agilecert_certificate_templates_current_version_fk
  foreign key (current_version_id)
  references public.agilecert_certificate_template_versions(id)
  on delete set null;

create index if not exists agilecert_certificate_template_versions_template_idx
  on public.agilecert_certificate_template_versions(template_id, version_number desc);
create index if not exists agilecert_certificate_template_versions_status_idx
  on public.agilecert_certificate_template_versions(status, quality_status, created_at desc);

create table if not exists public.agilecert_certificate_template_assignments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.agilecert_certificate_categories(id) on delete restrict,
  template_id uuid not null references public.agilecert_certificate_templates(id) on delete restrict,
  template_version_id uuid not null references public.agilecert_certificate_template_versions(id) on delete restrict,
  scope_type text not null check (scope_type in ('global', 'programme', 'examination')),
  programme_id uuid references public.programmes(id) on delete restrict,
  examination_id uuid references public.examinations(id) on delete restrict,
  priority integer not null default 100 check (priority between 1 and 1000),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  check (
    (scope_type = 'global' and programme_id is null and examination_id is null)
    or (scope_type = 'programme' and programme_id is not null and examination_id is null)
    or (scope_type = 'examination' and examination_id is not null)
  )
);

create index if not exists agilecert_certificate_assignments_resolution_idx
  on public.agilecert_certificate_template_assignments(category_id, scope_type, is_active, priority, effective_from desc);
create unique index if not exists agilecert_certificate_assignments_global_active_uidx
  on public.agilecert_certificate_template_assignments(category_id)
  where scope_type = 'global' and is_active;
create unique index if not exists agilecert_certificate_assignments_programme_active_uidx
  on public.agilecert_certificate_template_assignments(category_id, programme_id)
  where scope_type = 'programme' and is_active;
create unique index if not exists agilecert_certificate_assignments_exam_active_uidx
  on public.agilecert_certificate_template_assignments(category_id, examination_id)
  where scope_type = 'examination' and is_active;

create table if not exists public.agilecert_certificate_template_audit (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id text,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agilecert_certificate_template_audit_entity_idx
  on public.agilecert_certificate_template_audit(entity_type, entity_id, created_at desc);
create index if not exists agilecert_certificate_template_audit_actor_idx
  on public.agilecert_certificate_template_audit(actor_id, created_at desc);

-- Standard timestamp maintenance.
drop trigger if exists agilecert_certificate_permission_definitions_updated_at on public.agilecert_certificate_permission_definitions;
create trigger agilecert_certificate_permission_definitions_updated_at
  before update on public.agilecert_certificate_permission_definitions
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_institutions_updated_at on public.agilecert_certificate_institutions;
create trigger agilecert_certificate_institutions_updated_at
  before update on public.agilecert_certificate_institutions
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_categories_updated_at on public.agilecert_certificate_categories;
create trigger agilecert_certificate_categories_updated_at
  before update on public.agilecert_certificate_categories
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_assets_updated_at on public.agilecert_certificate_assets;
create trigger agilecert_certificate_assets_updated_at
  before update on public.agilecert_certificate_assets
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_templates_updated_at on public.agilecert_certificate_templates;
create trigger agilecert_certificate_templates_updated_at
  before update on public.agilecert_certificate_templates
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_template_versions_updated_at on public.agilecert_certificate_template_versions;
create trigger agilecert_certificate_template_versions_updated_at
  before update on public.agilecert_certificate_template_versions
  for each row execute function public.set_updated_at();
drop trigger if exists agilecert_certificate_template_assignments_updated_at on public.agilecert_certificate_template_assignments;
create trigger agilecert_certificate_template_assignments_updated_at
  before update on public.agilecert_certificate_template_assignments
  for each row execute function public.set_updated_at();

alter table public.agilecert_certificate_permission_definitions enable row level security;
alter table public.agilecert_certificate_role_permissions enable row level security;
alter table public.agilecert_certificate_institutions enable row level security;
alter table public.agilecert_certificate_categories enable row level security;
alter table public.agilecert_certificate_assets enable row level security;
alter table public.agilecert_certificate_templates enable row level security;
alter table public.agilecert_certificate_template_versions enable row level security;
alter table public.agilecert_certificate_template_assignments enable row level security;
alter table public.agilecert_certificate_template_audit enable row level security;

revoke all on table public.agilecert_certificate_permission_definitions from public, anon, authenticated;
revoke all on table public.agilecert_certificate_role_permissions from public, anon, authenticated;
revoke all on table public.agilecert_certificate_institutions from public, anon, authenticated;
revoke all on table public.agilecert_certificate_categories from public, anon, authenticated;
revoke all on table public.agilecert_certificate_assets from public, anon, authenticated;
revoke all on table public.agilecert_certificate_templates from public, anon, authenticated;
revoke all on table public.agilecert_certificate_template_versions from public, anon, authenticated;
revoke all on table public.agilecert_certificate_template_assignments from public, anon, authenticated;
revoke all on table public.agilecert_certificate_template_audit from public, anon, authenticated;
revoke all on sequence public.agilecert_certificate_template_audit_id_seq from public, anon, authenticated;

create or replace function public.agilecert_certificate_has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when profile.role = 'super_admin' then true
      when profile.role = 'exam_admin' then coalesce(permission.is_granted, false)
      else false
    end
    from public.profiles profile
    left join public.agilecert_certificate_role_permissions permission
      on permission.role = profile.role
     and permission.permission_key = p_permission_key
    where profile.id = auth.uid()
      and profile.is_active = true
  ), false);
$$;

revoke all on function public.agilecert_certificate_has_permission(text) from public, anon, authenticated;
grant execute on function public.agilecert_certificate_has_permission(text) to authenticated;

create or replace function public.agilecert_certificate_require_permission(p_permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if not public.agilecert_certificate_has_permission(p_permission_key) then
    raise exception 'Certificate administration permission denied: %', p_permission_key;
  end if;
end;
$$;

revoke all on function public.agilecert_certificate_require_permission(text) from public, anon, authenticated;

create or replace function public.agilecert_certificate_write_audit(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agilecert_certificate_template_audit(
    actor_id, entity_type, entity_id, action, before_state, after_state, metadata
  ) values (
    auth.uid(), p_entity_type, p_entity_id, p_action,
    p_before_state, p_after_state, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.agilecert_certificate_write_audit(text,text,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;

create or replace function public.prevent_agilecert_certificate_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Certificate template audit records are immutable.';
end;
$$;

drop trigger if exists agilecert_certificate_template_audit_immutable on public.agilecert_certificate_template_audit;
create trigger agilecert_certificate_template_audit_immutable
  before update or delete on public.agilecert_certificate_template_audit
  for each row execute function public.prevent_agilecert_certificate_audit_mutation();

revoke all on function public.prevent_agilecert_certificate_audit_mutation() from public, anon, authenticated;

create or replace function public.get_my_certificate_management_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_permissions jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor and is_active = true;

  if v_role is null then
    raise exception 'An active portal account is required.';
  end if;

  select coalesce(jsonb_agg(definition.permission_key order by definition.permission_key), '[]'::jsonb)
  into v_permissions
  from public.agilecert_certificate_permission_definitions definition
  where definition.is_active
    and public.agilecert_certificate_has_permission(definition.permission_key);

  return jsonb_build_object(
    'actorId', v_actor,
    'role', v_role,
    'permissions', v_permissions,
    'canViewConsole', public.agilecert_certificate_has_permission('certificate.console.view'),
    'canManageInstitutions', public.agilecert_certificate_has_permission('certificate.institutions.manage'),
    'canManageCategories', public.agilecert_certificate_has_permission('certificate.categories.manage'),
    'canManageTemplates', public.agilecert_certificate_has_permission('certificate.templates.manage'),
    'canReviewTemplates', public.agilecert_certificate_has_permission('certificate.templates.review'),
    'canApproveTemplates', public.agilecert_certificate_has_permission('certificate.templates.approve'),
    'canPublishTemplates', public.agilecert_certificate_has_permission('certificate.templates.publish'),
    'canManageAssets', public.agilecert_certificate_has_permission('certificate.assets.manage'),
    'canApproveAssets', public.agilecert_certificate_has_permission('certificate.assets.approve'),
    'canManageAssignments', public.agilecert_certificate_has_permission('certificate.assignments.manage'),
    'canManagePermissions', public.agilecert_certificate_has_permission('certificate.permissions.manage')
  );
end;
$$;

revoke all on function public.get_my_certificate_management_access() from public, anon, authenticated;
grant execute on function public.get_my_certificate_management_access() to authenticated;

create or replace function public.get_certificate_management_console_snapshot(p_limit integer default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 300), 1000));
  v_access jsonb;
begin
  perform public.agilecert_certificate_require_permission('certificate.console.view');
  v_access := public.get_my_certificate_management_access();

  return jsonb_build_object(
    'access', v_access,
    'summary', jsonb_build_object(
      'institutions', (select count(*) from public.agilecert_certificate_institutions where is_active),
      'categories', (select count(*) from public.agilecert_certificate_categories where is_active),
      'templates', (select count(*) from public.agilecert_certificate_templates),
      'publishedTemplates', (select count(*) from public.agilecert_certificate_templates where status = 'published'),
      'versionsAwaitingReview', (select count(*) from public.agilecert_certificate_template_versions where status = 'in_review'),
      'approvedAssets', (select count(*) from public.agilecert_certificate_assets where status = 'approved'),
      'activeAssignments', (select count(*) from public.agilecert_certificate_template_assignments where is_active)
    ),
    'institutions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."name")
      from (
        select
          institution.id,
          institution.code,
          institution.name,
          institution.short_name as "shortName",
          institution.legal_name as "legalName",
          institution.registration_details as "registrationDetails",
          institution.country_code as "countryCode",
          institution.website,
          institution.contact_email as "contactEmail",
          institution.is_active as "isActive",
          institution.created_at as "createdAt",
          institution.updated_at as "updatedAt"
        from public.agilecert_certificate_institutions institution
        order by institution.name
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."sortOrder", item."name")
      from (
        select
          category.id,
          category.code,
          category.name,
          category.description,
          category.requires_identity_verification as "requiresIdentityVerification",
          category.requires_score as "requiresScore",
          category.sort_order as "sortOrder",
          category.is_active as "isActive",
          category.created_at as "createdAt",
          category.updated_at as "updatedAt"
        from public.agilecert_certificate_categories category
        order by category.sort_order, category.name
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."updatedAt" desc)
      from (
        select
          template.id,
          template.institution_id as "institutionId",
          institution.code as "institutionCode",
          institution.name as "institutionName",
          template.category_id as "categoryId",
          category.code as "categoryCode",
          category.name as "categoryName",
          template.code,
          template.name,
          template.description,
          template.orientation,
          template.page_size as "pageSize",
          template.status,
          template.current_version_id as "currentVersionId",
          current_version.version_number as "currentVersionNumber",
          template.required_fields as "requiredFields",
          template.quality_standard as "qualityStandard",
          template.effective_from as "effectiveFrom",
          template.effective_to as "effectiveTo",
          template.notes,
          template.created_at as "createdAt",
          template.updated_at as "updatedAt"
        from public.agilecert_certificate_templates template
        join public.agilecert_certificate_institutions institution on institution.id = template.institution_id
        join public.agilecert_certificate_categories category on category.id = template.category_id
        left join public.agilecert_certificate_template_versions current_version on current_version.id = template.current_version_id
        order by template.updated_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'versions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."createdAt" desc)
      from (
        select
          version.id,
          version.template_id as "templateId",
          template.name as "templateName",
          template.code as "templateCode",
          institution.code as "institutionCode",
          category.name as "categoryName",
          version.version_number as "versionNumber",
          version.source_format as "sourceFormat",
          version.storage_bucket as "storageBucket",
          version.storage_path as "storagePath",
          version.original_filename as "originalFilename",
          version.mime_type as "mimeType",
          version.file_size_bytes as "fileSizeBytes",
          version.sha256,
          version.page_width_points as "pageWidthPoints",
          version.page_height_points as "pageHeightPoints",
          version.pixel_width as "pixelWidth",
          version.pixel_height as "pixelHeight",
          version.overlay_schema as "overlaySchema",
          version.status,
          version.quality_status as "qualityStatus",
          version.quality_report as "qualityReport",
          version.notes,
          version.submitted_at as "submittedAt",
          version.reviewed_at as "reviewedAt",
          version.approved_at as "approvedAt",
          version.published_at as "publishedAt",
          version.created_at as "createdAt",
          version.updated_at as "updatedAt"
        from public.agilecert_certificate_template_versions version
        join public.agilecert_certificate_templates template on template.id = version.template_id
        join public.agilecert_certificate_institutions institution on institution.id = template.institution_id
        join public.agilecert_certificate_categories category on category.id = template.category_id
        order by version.created_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'assets', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."createdAt" desc)
      from (
        select
          asset.id,
          asset.institution_id as "institutionId",
          institution.code as "institutionCode",
          institution.name as "institutionName",
          asset.asset_type as "assetType",
          asset.name,
          asset.version_number as "versionNumber",
          asset.storage_bucket as "storageBucket",
          asset.storage_path as "storagePath",
          asset.original_filename as "originalFilename",
          asset.mime_type as "mimeType",
          asset.file_size_bytes as "fileSizeBytes",
          asset.pixel_width as "pixelWidth",
          asset.pixel_height as "pixelHeight",
          asset.sha256,
          asset.status,
          asset.review_notes as "reviewNotes",
          asset.approved_at as "approvedAt",
          asset.created_at as "createdAt",
          asset.updated_at as "updatedAt"
        from public.agilecert_certificate_assets asset
        join public.agilecert_certificate_institutions institution on institution.id = asset.institution_id
        order by asset.created_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."priority", item."createdAt" desc)
      from (
        select
          assignment.id,
          assignment.category_id as "categoryId",
          category.code as "categoryCode",
          category.name as "categoryName",
          assignment.template_id as "templateId",
          template.name as "templateName",
          template.code as "templateCode",
          institution.code as "institutionCode",
          assignment.template_version_id as "templateVersionId",
          version.version_number as "versionNumber",
          assignment.scope_type as "scopeType",
          assignment.programme_id as "programmeId",
          programme.code as "programmeCode",
          programme.name as "programmeName",
          assignment.examination_id as "examinationId",
          examination.title as "examinationTitle",
          assignment.priority,
          assignment.effective_from as "effectiveFrom",
          assignment.effective_to as "effectiveTo",
          assignment.is_active as "isActive",
          assignment.created_at as "createdAt",
          assignment.updated_at as "updatedAt"
        from public.agilecert_certificate_template_assignments assignment
        join public.agilecert_certificate_categories category on category.id = assignment.category_id
        join public.agilecert_certificate_templates template on template.id = assignment.template_id
        join public.agilecert_certificate_institutions institution on institution.id = template.institution_id
        join public.agilecert_certificate_template_versions version on version.id = assignment.template_version_id
        left join public.programmes programme on programme.id = assignment.programme_id
        left join public.examinations examination on examination.id = assignment.examination_id
        order by assignment.priority, assignment.created_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb),
    'programmes', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."name")
      from (
        select programme.id, programme.code, programme.name
        from public.programmes programme
        order by programme.name
      ) item
    ), '[]'::jsonb),
    'examinations', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."title")
      from (
        select
          examination.id,
          examination.programme_id as "programmeId",
          programme.code as "programmeCode",
          examination.code,
          examination.title
        from public.examinations examination
        left join public.programmes programme on programme.id = examination.programme_id
        order by examination.title
      ) item
    ), '[]'::jsonb),
    'permissionMatrix', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."category", item."name")
      from (
        select
          definition.permission_key as "permissionKey",
          definition.name,
          definition.description,
          definition.category,
          definition.risk_level as "riskLevel",
          coalesce(grant_record.is_granted, false) as "isGranted",
          grant_record.updated_at as "updatedAt"
        from public.agilecert_certificate_permission_definitions definition
        left join public.agilecert_certificate_role_permissions grant_record
          on grant_record.role = 'exam_admin'
         and grant_record.permission_key = definition.permission_key
        where definition.is_active
        order by definition.category, definition.name
      ) item
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(item) order by item."createdAt" desc)
      from (
        select
          audit.id,
          audit.actor_id as "actorId",
          actor.full_name as "actorName",
          audit.entity_type as "entityType",
          audit.entity_id as "entityId",
          audit.action,
          audit.metadata,
          audit.created_at as "createdAt"
        from public.agilecert_certificate_template_audit audit
        left join public.profiles actor on actor.id = audit.actor_id
        order by audit.created_at desc
        limit v_limit
      ) item
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_certificate_management_console_snapshot(integer) from public, anon, authenticated;
grant execute on function public.get_certificate_management_console_snapshot(integer) to authenticated;

create or replace function public.certificate_admin_upsert_institution(
  p_id uuid,
  p_code text,
  p_name text,
  p_short_name text default null,
  p_legal_name text default null,
  p_registration_details text default null,
  p_country_code text default 'NG',
  p_website text default null,
  p_contact_email text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_institutions;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
begin
  perform public.agilecert_certificate_require_permission('certificate.institutions.manage');
  if v_code !~ '^[A-Z0-9_-]{2,30}$' then raise exception 'Enter a valid institution code.'; end if;
  if length(v_name) < 3 then raise exception 'Enter the institution name.'; end if;

  if p_id is not null then
    select to_jsonb(current_record) into v_before
    from public.agilecert_certificate_institutions current_record
    where current_record.id = p_id;

    update public.agilecert_certificate_institutions set
      code = v_code,
      name = v_name,
      short_name = nullif(trim(p_short_name), ''),
      legal_name = nullif(trim(p_legal_name), ''),
      registration_details = nullif(trim(p_registration_details), ''),
      country_code = upper(trim(coalesce(p_country_code, 'NG'))),
      website = nullif(trim(p_website), ''),
      contact_email = nullif(lower(trim(p_contact_email)), ''),
      is_active = coalesce(p_is_active, true),
      updated_by = auth.uid()
    where id = p_id
    returning * into v_record;

    if v_record.id is null then raise exception 'Issuing institution not found.'; end if;
  else
    insert into public.agilecert_certificate_institutions(
      code, name, short_name, legal_name, registration_details,
      country_code, website, contact_email, is_active, created_by, updated_by
    ) values (
      v_code, v_name, nullif(trim(p_short_name), ''), nullif(trim(p_legal_name), ''),
      nullif(trim(p_registration_details), ''), upper(trim(coalesce(p_country_code, 'NG'))),
      nullif(trim(p_website), ''), nullif(lower(trim(p_contact_email)), ''),
      coalesce(p_is_active, true), auth.uid(), auth.uid()
    ) returning * into v_record;
  end if;

  perform public.agilecert_certificate_write_audit(
    'institution', v_record.id::text,
    case when p_id is null then 'institution.created' else 'institution.updated' end,
    v_before, to_jsonb(v_record), '{}'::jsonb
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_upsert_category(
  p_id uuid,
  p_code text,
  p_name text,
  p_description text default '',
  p_requires_identity_verification boolean default false,
  p_requires_score boolean default false,
  p_sort_order integer default 100,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_categories;
  v_code text := lower(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
begin
  perform public.agilecert_certificate_require_permission('certificate.categories.manage');
  if v_code !~ '^[a-z0-9_-]{2,40}$' then raise exception 'Enter a valid category code.'; end if;
  if length(v_name) < 3 then raise exception 'Enter the category name.'; end if;

  if p_id is not null then
    select to_jsonb(current_record) into v_before
    from public.agilecert_certificate_categories current_record
    where current_record.id = p_id;

    update public.agilecert_certificate_categories set
      code = v_code,
      name = v_name,
      description = trim(coalesce(p_description, '')),
      requires_identity_verification = coalesce(p_requires_identity_verification, false),
      requires_score = coalesce(p_requires_score, false),
      sort_order = greatest(1, coalesce(p_sort_order, 100)),
      is_active = coalesce(p_is_active, true),
      updated_by = auth.uid()
    where id = p_id
    returning * into v_record;

    if v_record.id is null then raise exception 'Certificate category not found.'; end if;
  else
    insert into public.agilecert_certificate_categories(
      code, name, description, requires_identity_verification,
      requires_score, sort_order, is_active, created_by, updated_by
    ) values (
      v_code, v_name, trim(coalesce(p_description, '')),
      coalesce(p_requires_identity_verification, false), coalesce(p_requires_score, false),
      greatest(1, coalesce(p_sort_order, 100)), coalesce(p_is_active, true), auth.uid(), auth.uid()
    ) returning * into v_record;
  end if;

  perform public.agilecert_certificate_write_audit(
    'category', v_record.id::text,
    case when p_id is null then 'category.created' else 'category.updated' end,
    v_before, to_jsonb(v_record), '{}'::jsonb
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_create_template(
  p_institution_id uuid,
  p_category_id uuid,
  p_code text,
  p_name text,
  p_description text default '',
  p_orientation text default 'landscape',
  p_page_size text default 'A4',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.agilecert_certificate_templates;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
begin
  perform public.agilecert_certificate_require_permission('certificate.templates.manage');
  if v_code !~ '^[A-Z0-9_-]{2,50}$' then raise exception 'Enter a valid template code.'; end if;
  if length(v_name) < 3 then raise exception 'Enter the template name.'; end if;
  if not exists (select 1 from public.agilecert_certificate_institutions where id = p_institution_id and is_active) then
    raise exception 'Select an active issuing institution.';
  end if;
  if not exists (select 1 from public.agilecert_certificate_categories where id = p_category_id and is_active) then
    raise exception 'Select an active certificate category.';
  end if;

  insert into public.agilecert_certificate_templates(
    institution_id, category_id, code, name, description,
    orientation, page_size, notes, created_by, updated_by
  ) values (
    p_institution_id, p_category_id, v_code, v_name, trim(coalesce(p_description, '')),
    p_orientation, p_page_size, nullif(trim(p_notes), ''), auth.uid(), auth.uid()
  ) returning * into v_record;

  perform public.agilecert_certificate_write_audit(
    'template', v_record.id::text, 'template.created', null, to_jsonb(v_record), '{}'::jsonb
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_register_template_version(
  p_template_id uuid,
  p_source_format text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256 text default null,
  p_pixel_width integer default null,
  p_pixel_height integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
  v_record public.agilecert_certificate_template_versions;
begin
  perform public.agilecert_certificate_require_permission('certificate.templates.manage');
  if p_storage_bucket <> 'certificate-masters' then raise exception 'Invalid certificate master bucket.'; end if;
  if p_source_format not in ('pdf', 'svg', 'png', 'jpeg') then raise exception 'Unsupported master-template format.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 then raise exception 'The uploaded master file is empty.'; end if;
  if not exists (select 1 from public.agilecert_certificate_templates where id = p_template_id) then
    raise exception 'Certificate template not found.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.agilecert_certificate_template_versions
  where template_id = p_template_id;

  insert into public.agilecert_certificate_template_versions(
    template_id, version_number, source_format, storage_bucket, storage_path,
    original_filename, mime_type, file_size_bytes, sha256, pixel_width, pixel_height,
    notes, created_by
  ) values (
    p_template_id, v_version, p_source_format, p_storage_bucket, trim(p_storage_path),
    trim(p_original_filename), trim(p_mime_type), p_file_size_bytes,
    nullif(lower(trim(p_sha256)), ''), p_pixel_width, p_pixel_height,
    nullif(trim(p_notes), ''), auth.uid()
  ) returning * into v_record;

  update public.agilecert_certificate_templates
  set status = 'draft', updated_by = auth.uid()
  where id = p_template_id and status <> 'published';

  perform public.agilecert_certificate_write_audit(
    'template_version', v_record.id::text, 'template_version.registered', null,
    to_jsonb(v_record), jsonb_build_object('templateId', p_template_id)
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_register_asset(
  p_institution_id uuid,
  p_asset_type text,
  p_name text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256 text default null,
  p_pixel_width integer default null,
  p_pixel_height integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
  v_record public.agilecert_certificate_assets;
  v_name text := trim(coalesce(p_name, ''));
begin
  perform public.agilecert_certificate_require_permission('certificate.assets.manage');
  if p_storage_bucket <> 'certificate-assets' then raise exception 'Invalid certificate asset bucket.'; end if;
  if p_asset_type not in ('logo', 'seal', 'signature', 'watermark', 'background', 'emblem', 'other') then
    raise exception 'Unsupported certificate asset type.';
  end if;
  if length(v_name) < 2 then raise exception 'Enter an asset name.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 then raise exception 'The uploaded asset is empty.'; end if;
  if not exists (select 1 from public.agilecert_certificate_institutions where id = p_institution_id) then
    raise exception 'Issuing institution not found.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.agilecert_certificate_assets
  where institution_id = p_institution_id
    and asset_type = p_asset_type
    and lower(name) = lower(v_name);

  insert into public.agilecert_certificate_assets(
    institution_id, asset_type, name, version_number,
    storage_bucket, storage_path, original_filename, mime_type,
    file_size_bytes, pixel_width, pixel_height, sha256, uploaded_by
  ) values (
    p_institution_id, p_asset_type, v_name, v_version,
    p_storage_bucket, trim(p_storage_path), trim(p_original_filename), trim(p_mime_type),
    p_file_size_bytes, p_pixel_width, p_pixel_height,
    nullif(lower(trim(p_sha256)), ''), auth.uid()
  ) returning * into v_record;

  perform public.agilecert_certificate_write_audit(
    'asset', v_record.id::text, 'asset.registered', null, to_jsonb(v_record), '{}'::jsonb
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_record_quality_review(
  p_version_id uuid,
  p_quality_status text,
  p_report jsonb default '{}'::jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_template_versions;
begin
  if p_quality_status = 'waived' then
    perform public.agilecert_certificate_require_permission('certificate.templates.approve');
  else
    perform public.agilecert_certificate_require_permission('certificate.templates.review');
  end if;
  if p_quality_status not in ('passed', 'failed', 'waived') then
    raise exception 'Quality review must be passed, failed or waived.';
  end if;

  select to_jsonb(version) into v_before
  from public.agilecert_certificate_template_versions version
  where version.id = p_version_id;

  update public.agilecert_certificate_template_versions set
    quality_status = p_quality_status,
    quality_report = coalesce(p_report, '{}'::jsonb),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = p_version_id
  returning * into v_record;

  if v_record.id is null then raise exception 'Template version not found.'; end if;

  perform public.agilecert_certificate_write_audit(
    'template_version', v_record.id::text, 'template_version.quality_reviewed',
    v_before, to_jsonb(v_record), jsonb_build_object('qualityStatus', p_quality_status)
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_transition_template_version(
  p_version_id uuid,
  p_action text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_template_versions;
  v_template public.agilecert_certificate_templates;
begin
  select * into v_record
  from public.agilecert_certificate_template_versions
  where id = p_version_id
  for update;
  if v_record.id is null then raise exception 'Template version not found.'; end if;

  select * into v_template
  from public.agilecert_certificate_templates
  where id = v_record.template_id
  for update;

  v_before := to_jsonb(v_record);

  if p_action = 'submit_review' then
    perform public.agilecert_certificate_require_permission('certificate.templates.manage');
    if v_record.status not in ('draft', 'changes_requested', 'rejected') then
      raise exception 'Only draft or returned versions may be submitted for review.';
    end if;
    update public.agilecert_certificate_template_versions set
      status = 'in_review', submitted_by = auth.uid(), submitted_at = now(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    update public.agilecert_certificate_templates set status = 'in_review', updated_by = auth.uid()
    where id = v_template.id and status <> 'published';
  elsif p_action = 'request_changes' then
    perform public.agilecert_certificate_require_permission('certificate.templates.review');
    if v_record.status <> 'in_review' then raise exception 'Only versions in review may be returned.'; end if;
    update public.agilecert_certificate_template_versions set
      status = 'changes_requested', reviewed_by = auth.uid(), reviewed_at = now(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    update public.agilecert_certificate_templates set status = 'draft', updated_by = auth.uid()
    where id = v_template.id and status <> 'published';
  elsif p_action = 'reject' then
    perform public.agilecert_certificate_require_permission('certificate.templates.review');
    if v_record.status <> 'in_review' then raise exception 'Only versions in review may be rejected.'; end if;
    update public.agilecert_certificate_template_versions set
      status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    update public.agilecert_certificate_templates set status = 'draft', updated_by = auth.uid()
    where id = v_template.id and status <> 'published';
  elsif p_action = 'approve' then
    perform public.agilecert_certificate_require_permission('certificate.templates.approve');
    if v_record.status <> 'in_review' then raise exception 'Only versions in review may be approved.'; end if;
    if v_record.quality_status not in ('passed', 'waived') then
      raise exception 'The print-quality review must pass before approval.';
    end if;
    update public.agilecert_certificate_template_versions set
      status = 'approved', approved_by = auth.uid(), approved_at = now(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    update public.agilecert_certificate_templates set status = 'approved', updated_by = auth.uid()
    where id = v_template.id and status <> 'published';
  elsif p_action = 'publish' then
    perform public.agilecert_certificate_require_permission('certificate.templates.publish');
    if v_record.status <> 'approved' then raise exception 'Only approved versions may be published.'; end if;
    if not exists (
      select 1
      from public.agilecert_certificate_templates template
      join public.agilecert_certificate_institutions institution on institution.id = template.institution_id and institution.is_active
      join public.agilecert_certificate_categories category on category.id = template.category_id and category.is_active
      where template.id = v_template.id
    ) then raise exception 'The institution and certificate category must be active before publication.'; end if;

    update public.agilecert_certificate_template_versions set status = 'superseded'
    where template_id = v_template.id and status = 'published' and id <> p_version_id;
    update public.agilecert_certificate_template_versions set
      status = 'published', published_by = auth.uid(), published_at = now(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    update public.agilecert_certificate_templates set
      status = 'published', current_version_id = p_version_id,
      effective_from = coalesce(effective_from, now()), updated_by = auth.uid()
    where id = v_template.id;
  elsif p_action = 'retire' then
    perform public.agilecert_certificate_require_permission('certificate.templates.publish');
    if v_record.status not in ('approved', 'published') then
      raise exception 'Only approved or published versions may be retired.';
    end if;
    update public.agilecert_certificate_template_versions set
      status = 'retired', notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_version_id returning * into v_record;
    if v_template.current_version_id = p_version_id then
      update public.agilecert_certificate_templates set
        status = 'retired', current_version_id = null, effective_to = now(), updated_by = auth.uid()
      where id = v_template.id;
      update public.agilecert_certificate_template_assignments set
        is_active = false, effective_to = coalesce(effective_to, now()), updated_by = auth.uid()
      where template_version_id = p_version_id and is_active;
    end if;
  else
    raise exception 'Unsupported template workflow action: %', p_action;
  end if;

  perform public.agilecert_certificate_write_audit(
    'template_version', v_record.id::text, 'template_version.' || p_action,
    v_before, to_jsonb(v_record), jsonb_build_object('templateId', v_template.id)
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_set_asset_status(
  p_asset_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_assets;
begin
  perform public.agilecert_certificate_require_permission('certificate.assets.approve');
  if p_status not in ('approved', 'rejected', 'retired') then
    raise exception 'Asset status must be approved, rejected or retired.';
  end if;

  select to_jsonb(asset) into v_before
  from public.agilecert_certificate_assets asset
  where asset.id = p_asset_id;

  update public.agilecert_certificate_assets set
    status = p_status,
    review_notes = nullif(trim(p_notes), ''),
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    retired_by = case when p_status = 'retired' then auth.uid() else retired_by end,
    retired_at = case when p_status = 'retired' then now() else retired_at end
  where id = p_asset_id
  returning * into v_record;

  if v_record.id is null then raise exception 'Certificate asset not found.'; end if;

  perform public.agilecert_certificate_write_audit(
    'asset', v_record.id::text, 'asset.' || p_status,
    v_before, to_jsonb(v_record), '{}'::jsonb
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_assign_template(
  p_template_id uuid,
  p_template_version_id uuid,
  p_scope_type text,
  p_programme_id uuid default null,
  p_examination_id uuid default null,
  p_priority integer default 100,
  p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.agilecert_certificate_templates;
  v_version public.agilecert_certificate_template_versions;
  v_exam_programme uuid;
  v_record public.agilecert_certificate_template_assignments;
begin
  perform public.agilecert_certificate_require_permission('certificate.assignments.manage');
  select * into v_template from public.agilecert_certificate_templates where id = p_template_id;
  select * into v_version from public.agilecert_certificate_template_versions where id = p_template_version_id;
  if v_template.id is null or v_version.id is null or v_version.template_id <> v_template.id then
    raise exception 'The template and version do not match.';
  end if;
  if v_version.status <> 'published' then raise exception 'Only a published template version may be assigned.'; end if;
  if p_scope_type not in ('global', 'programme', 'examination') then raise exception 'Invalid assignment scope.'; end if;

  if p_scope_type = 'global' then
    p_programme_id := null; p_examination_id := null;
  elsif p_scope_type = 'programme' then
    if p_programme_id is null or not exists (select 1 from public.programmes where id = p_programme_id) then
      raise exception 'Select a valid programme.';
    end if;
    p_examination_id := null;
  else
    if p_examination_id is null then raise exception 'Select a valid examination.'; end if;
    select programme_id into v_exam_programme from public.examinations where id = p_examination_id;
    if v_exam_programme is null then raise exception 'Select a valid examination.'; end if;
    p_programme_id := v_exam_programme;
  end if;

  update public.agilecert_certificate_template_assignments set
    is_active = false, effective_to = coalesce(effective_to, now()), updated_by = auth.uid()
  where category_id = v_template.category_id
    and is_active
    and scope_type = p_scope_type
    and (p_scope_type <> 'programme' or programme_id = p_programme_id)
    and (p_scope_type <> 'examination' or examination_id = p_examination_id);

  insert into public.agilecert_certificate_template_assignments(
    category_id, template_id, template_version_id, scope_type,
    programme_id, examination_id, priority, effective_from, effective_to,
    is_active, created_by, updated_by
  ) values (
    v_template.category_id, v_template.id, v_version.id, p_scope_type,
    p_programme_id, p_examination_id, greatest(1, least(coalesce(p_priority, 100), 1000)),
    coalesce(p_effective_from, now()), p_effective_to, true, auth.uid(), auth.uid()
  ) returning * into v_record;

  perform public.agilecert_certificate_write_audit(
    'assignment', v_record.id::text, 'assignment.created', null, to_jsonb(v_record),
    jsonb_build_object('templateId', v_template.id, 'versionId', v_version.id)
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_set_assignment_active(
  p_assignment_id uuid,
  p_is_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_template_assignments;
begin
  perform public.agilecert_certificate_require_permission('certificate.assignments.manage');
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Enter an assignment change reason.'; end if;

  select to_jsonb(assignment) into v_before
  from public.agilecert_certificate_template_assignments assignment
  where assignment.id = p_assignment_id;

  update public.agilecert_certificate_template_assignments set
    is_active = coalesce(p_is_active, false),
    effective_to = case when coalesce(p_is_active, false) then effective_to else coalesce(effective_to, now()) end,
    updated_by = auth.uid()
  where id = p_assignment_id
  returning * into v_record;

  if v_record.id is null then raise exception 'Template assignment not found.'; end if;

  perform public.agilecert_certificate_write_audit(
    'assignment', v_record.id::text,
    case when v_record.is_active then 'assignment.activated' else 'assignment.deactivated' end,
    v_before, to_jsonb(v_record), jsonb_build_object('reason', trim(p_reason))
  );
  return to_jsonb(v_record);
end;
$$;

create or replace function public.certificate_admin_set_permission(
  p_permission_key text,
  p_is_granted boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_record public.agilecert_certificate_role_permissions;
begin
  perform public.agilecert_certificate_require_permission('certificate.permissions.manage');
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Enter a permission change reason.'; end if;
  if not exists (
    select 1 from public.agilecert_certificate_permission_definitions
    where permission_key = p_permission_key and is_active
  ) then raise exception 'Certificate permission not found.'; end if;
  if p_permission_key = 'certificate.permissions.manage' and coalesce(p_is_granted, false) then
    raise exception 'Examination Administrators cannot receive certificate permission-management authority.';
  end if;

  select to_jsonb(permission) into v_before
  from public.agilecert_certificate_role_permissions permission
  where permission.role = 'exam_admin' and permission.permission_key = p_permission_key;

  insert into public.agilecert_certificate_role_permissions(
    role, permission_key, is_granted, updated_by, updated_at
  ) values (
    'exam_admin', p_permission_key, coalesce(p_is_granted, false), auth.uid(), now()
  )
  on conflict (role, permission_key) do update set
    is_granted = excluded.is_granted,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_record;

  perform public.agilecert_certificate_write_audit(
    'permission', p_permission_key, 'permission.updated', v_before, to_jsonb(v_record),
    jsonb_build_object('reason', trim(p_reason), 'role', 'exam_admin')
  );
  return to_jsonb(v_record);
end;
$$;

-- Future server-side renderer resolver. No browser role receives direct execute
-- authority in Phase 1A; it is reserved for controlled backend integration.
create or replace function public.resolve_agilecert_certificate_master(
  p_examination_id uuid,
  p_category_code text,
  p_at timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with context as (
    select examination.id as examination_id, examination.programme_id
    from public.examinations examination
    where examination.id = p_examination_id
  ), ranked as (
    select
      assignment.*,
      case assignment.scope_type when 'examination' then 1 when 'programme' then 2 else 3 end as scope_rank
    from public.agilecert_certificate_template_assignments assignment
    join public.agilecert_certificate_categories category
      on category.id = assignment.category_id
     and lower(category.code) = lower(trim(p_category_code))
    join public.agilecert_certificate_template_versions version
      on version.id = assignment.template_version_id
     and version.status = 'published'
    join context on true
    where assignment.is_active
      and assignment.effective_from <= coalesce(p_at, now())
      and (assignment.effective_to is null or assignment.effective_to > coalesce(p_at, now()))
      and (
        assignment.scope_type = 'global'
        or (assignment.scope_type = 'programme' and assignment.programme_id = context.programme_id)
        or (assignment.scope_type = 'examination' and assignment.examination_id = context.examination_id)
      )
    order by scope_rank, assignment.priority, assignment.effective_from desc
    limit 1
  )
  select case when assignment.id is null then null else jsonb_build_object(
    'assignmentId', assignment.id,
    'templateId', template.id,
    'templateCode', template.code,
    'templateName', template.name,
    'categoryCode', category.code,
    'institutionId', institution.id,
    'institutionCode', institution.code,
    'institutionName', institution.name,
    'versionId', version.id,
    'versionNumber', version.version_number,
    'sourceFormat', version.source_format,
    'storageBucket', version.storage_bucket,
    'storagePath', version.storage_path,
    'sha256', version.sha256,
    'overlaySchema', version.overlay_schema,
    'requiredFields', template.required_fields,
    'qualityStandard', template.quality_standard
  ) end
  from ranked assignment
  join public.agilecert_certificate_templates template on template.id = assignment.template_id
  join public.agilecert_certificate_categories category on category.id = assignment.category_id
  join public.agilecert_certificate_institutions institution on institution.id = template.institution_id
  join public.agilecert_certificate_template_versions version on version.id = assignment.template_version_id;
$$;

revoke all on function public.resolve_agilecert_certificate_master(uuid,text,timestamptz)
  from public, anon, authenticated;

-- Private immutable storage buckets. Objects are uploaded once; versions are
-- superseded or retired in the database rather than overwritten in storage.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('certificate-masters', 'certificate-masters', false, 26214400,
    array['application/pdf','image/svg+xml','image/png','image/jpeg']::text[]),
  ('certificate-assets', 'certificate-assets', false, 10485760,
    array['image/svg+xml','image/png','image/jpeg']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agilecert_certificate_storage_read on storage.objects;
create policy agilecert_certificate_storage_read
on storage.objects for select
to authenticated
using (
  bucket_id in ('certificate-masters', 'certificate-assets')
  and public.agilecert_certificate_has_permission('certificate.console.view')
);

drop policy if exists agilecert_certificate_master_storage_insert on storage.objects;
create policy agilecert_certificate_master_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'certificate-masters'
  and public.agilecert_certificate_has_permission('certificate.templates.manage')
);

drop policy if exists agilecert_certificate_asset_storage_insert on storage.objects;
create policy agilecert_certificate_asset_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'certificate-assets'
  and public.agilecert_certificate_has_permission('certificate.assets.manage')
);

-- Browser access is through permission-checked RPCs only.
do $grant_functions$
declare
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.certificate_admin_upsert_institution(uuid,text,text,text,text,text,text,text,text,boolean)'::regprocedure,
    'public.certificate_admin_upsert_category(uuid,text,text,text,boolean,boolean,integer,boolean)'::regprocedure,
    'public.certificate_admin_create_template(uuid,uuid,text,text,text,text,text,text)'::regprocedure,
    'public.certificate_admin_register_template_version(uuid,text,text,text,text,text,bigint,text,integer,integer,text)'::regprocedure,
    'public.certificate_admin_register_asset(uuid,text,text,text,text,text,text,bigint,text,integer,integer)'::regprocedure,
    'public.certificate_admin_record_quality_review(uuid,text,jsonb,text)'::regprocedure,
    'public.certificate_admin_transition_template_version(uuid,text,text)'::regprocedure,
    'public.certificate_admin_set_asset_status(uuid,text,text)'::regprocedure,
    'public.certificate_admin_assign_template(uuid,uuid,text,uuid,uuid,integer,timestamptz,timestamptz)'::regprocedure,
    'public.certificate_admin_set_assignment_active(uuid,boolean,text)'::regprocedure,
    'public.certificate_admin_set_permission(text,boolean,text)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end;
$grant_functions$;

comment on table public.agilecert_certificate_templates is
  'Institution- and category-specific certificate master definitions. Existing issued certificates are not modified by this table.';
comment on table public.agilecert_certificate_template_versions is
  'Immutable uploaded certificate master versions with print-quality review and publication workflow.';
comment on table public.agilecert_certificate_template_assignments is
  'Published master-template assignments resolved by examination, programme or global certificate category scope.';
comment on function public.resolve_agilecert_certificate_master(uuid,text,timestamptz) is
  'Returns the highest-specificity published certificate master for future controlled server-side rendering.';

commit;
