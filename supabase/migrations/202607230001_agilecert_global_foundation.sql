begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- AgileCert Global platform identity
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_platform_settings (
  singleton boolean primary key default true check (singleton),
  brand_name text not null default 'AgileCert Global',
  endorsement_line text not null default 'Powered by IIPM',
  legal_entity_name text not null default 'Integrated Institute of Professional Management',
  checkout_trading_name text not null default 'AgileCert Global by IIPM',
  public_positioning text not null,
  independence_disclosure text not null,
  examination_fee_disclosure text not null,
  early_price_window_days integer not null default 7 check (early_price_window_days between 1 and 30),
  updated_at timestamptz not null default now()
);

insert into public.agilecert_platform_settings (
  singleton,
  public_positioning,
  independence_disclosure,
  examination_fee_disclosure
)
values (
  true,
  'Independent professional competency examinations, preparation resources and verifiable specialist credentials for candidates worldwide.',
  'AgileCert Global credentials are independently developed and issued by AgileCert Global, powered by IIPM. References to external standards, frameworks or certification organisations are for educational and competency-mapping purposes only and do not imply affiliation, authorisation, endorsement or equivalence.',
  'The examination fee covers examination access and downloadable preparation materials. Certificate issuance is optional and attracts a separate fee after the candidate meets the required pass mark.'
)
on conflict (singleton) do update
set
  brand_name = excluded.brand_name,
  endorsement_line = excluded.endorsement_line,
  legal_entity_name = excluded.legal_entity_name,
  checkout_trading_name = excluded.checkout_trading_name,
  public_positioning = excluded.public_positioning,
  independence_disclosure = excluded.independence_disclosure,
  examination_fee_disclosure = excluded.examination_fee_disclosure,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Candidate profile and settings extension
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text,
  phone text,
  profile_photo_path text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text,
  preferred_language text not null default 'en',
  professional_headline text,
  employer text,
  industry text,
  education_summary text,
  skills text[] not null default '{}',
  certification_interests text[] not null default '{}',
  public_profile_enabled boolean not null default false,
  show_score_publicly boolean not null default false,
  marketing_consent boolean not null default false,
  certificate_email_updates boolean not null default true,
  course_recommendation_emails boolean not null default true,
  identity_verification_status text not null default 'unverified'
    check (identity_verification_status in ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  pricing_country_code text check (pricing_country_code is null or pricing_country_code ~ '^[A-Z]{2}$'),
  pricing_currency text check (pricing_currency is null or pricing_currency in ('NGN', 'USD')),
  pricing_source text,
  pricing_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.upsert_my_agilecert_profile(
  p_legal_name text default null,
  p_phone text default null,
  p_profile_photo_path text default null,
  p_country_code text default null,
  p_timezone text default null,
  p_preferred_language text default 'en',
  p_professional_headline text default null,
  p_employer text default null,
  p_industry text default null,
  p_education_summary text default null,
  p_skills text[] default '{}',
  p_certification_interests text[] default '{}',
  p_public_profile_enabled boolean default false,
  p_show_score_publicly boolean default false,
  p_marketing_consent boolean default false,
  p_certificate_email_updates boolean default true,
  p_course_recommendation_emails boolean default true
)
returns public.agilecert_candidate_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.agilecert_candidate_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.agilecert_candidate_profiles (
    user_id,
    legal_name,
    phone,
    profile_photo_path,
    country_code,
    timezone,
    preferred_language,
    professional_headline,
    employer,
    industry,
    education_summary,
    skills,
    certification_interests,
    public_profile_enabled,
    show_score_publicly,
    marketing_consent,
    certificate_email_updates,
    course_recommendation_emails
  )
  values (
    v_user_id,
    nullif(trim(p_legal_name), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_profile_photo_path), ''),
    case when p_country_code is null then null else upper(trim(p_country_code)) end,
    nullif(trim(p_timezone), ''),
    coalesce(nullif(trim(p_preferred_language), ''), 'en'),
    nullif(trim(p_professional_headline), ''),
    nullif(trim(p_employer), ''),
    nullif(trim(p_industry), ''),
    nullif(trim(p_education_summary), ''),
    coalesce(p_skills, '{}'),
    coalesce(p_certification_interests, '{}'),
    coalesce(p_public_profile_enabled, false),
    coalesce(p_show_score_publicly, false),
    coalesce(p_marketing_consent, false),
    coalesce(p_certificate_email_updates, true),
    coalesce(p_course_recommendation_emails, true)
  )
  on conflict (user_id) do update
  set
    legal_name = excluded.legal_name,
    phone = excluded.phone,
    profile_photo_path = excluded.profile_photo_path,
    country_code = excluded.country_code,
    timezone = excluded.timezone,
    preferred_language = excluded.preferred_language,
    professional_headline = excluded.professional_headline,
    employer = excluded.employer,
    industry = excluded.industry,
    education_summary = excluded.education_summary,
    skills = excluded.skills,
    certification_interests = excluded.certification_interests,
    public_profile_enabled = excluded.public_profile_enabled,
    show_score_publicly = excluded.show_score_publicly,
    marketing_consent = excluded.marketing_consent,
    certificate_email_updates = excluded.certificate_email_updates,
    course_recommendation_emails = excluded.course_recommendation_emails,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Certificate products and server-owned prices
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_certificate_products (
  code text primary key check (code in ('achievement', 'professional')),
  title text not null,
  description text not null,
  display_order integer not null,
  requires_identity_verification boolean not null default false,
  requires_integrity_clearance boolean not null default true,
  includes_transcript boolean not null default false,
  includes_public_profile boolean not null default false,
  includes_digital_badge boolean not null default true,
  benefits jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_certificate_product_prices (
  id uuid primary key default gen_random_uuid(),
  product_code text not null references public.agilecert_certificate_products(code) on delete cascade,
  currency text not null check (currency in ('NGN', 'USD')),
  standard_amount_minor bigint not null check (standard_amount_minor >= 0),
  early_amount_minor bigint not null check (early_amount_minor >= 0),
  early_window_days integer not null default 7 check (early_window_days between 1 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_code, currency)
);

insert into public.agilecert_certificate_products (
  code,
  title,
  description,
  display_order,
  requires_identity_verification,
  requires_integrity_clearance,
  includes_transcript,
  includes_public_profile,
  benefits
)
values
  (
    'achievement',
    'Certificate of Achievement',
    'Verifies that the candidate met the pass mark in an AgileCert Global specialist competency examination.',
    1,
    false,
    true,
    false,
    false,
    '["Digital PDF certificate", "Unique credential number", "QR-linked verification", "Achievement digital badge", "Score and issue-date evidence"]'::jsonb
  ),
  (
    'professional',
    'Professional Certificate',
    'A higher-assurance specialist professional credential with identity, integrity and professional-profile evidence.',
    2,
    true,
    true,
    true,
    true,
    '["Government-issued identity verification status", "AI-proctor integrity clearance", "Enhanced professional digital badge", "Formal examination transcript", "Public professional credential profile", "LinkedIn-ready credential information", "Active/suspended/revoked lifecycle"]'::jsonb
  )
on conflict (code) do update
set
  title = excluded.title,
  description = excluded.description,
  display_order = excluded.display_order,
  requires_identity_verification = excluded.requires_identity_verification,
  requires_integrity_clearance = excluded.requires_integrity_clearance,
  includes_transcript = excluded.includes_transcript,
  includes_public_profile = excluded.includes_public_profile,
  includes_digital_badge = true,
  benefits = excluded.benefits,
  active = true,
  updated_at = now();

insert into public.agilecert_certificate_product_prices (
  product_code,
  currency,
  standard_amount_minor,
  early_amount_minor,
  early_window_days
)
values
  ('achievement', 'NGN', 2500000, 2000000, 7),
  ('achievement', 'USD', 5000, 3500, 7),
  ('professional', 'NGN', 7500000, 5000000, 7),
  ('professional', 'USD', 7500, 6000, 7)
on conflict (product_code, currency) do update
set
  standard_amount_minor = excluded.standard_amount_minor,
  early_amount_minor = excluded.early_amount_minor,
  early_window_days = excluded.early_window_days,
  active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Post-pass eligibility and certificate orders
-- Eligibility records are created only by trusted server-side examination logic.
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_certificate_eligibilities (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  examination_id uuid not null,
  attempt_id uuid not null unique,
  examination_title text not null,
  programme_code text,
  score numeric(5,2) not null check (score between 0 and 100),
  pass_mark numeric(5,2) not null check (pass_mark between 0 and 100),
  passed_at timestamptz not null,
  early_price_expires_at timestamptz not null,
  integrity_status text not null default 'pending'
    check (integrity_status in ('pending', 'cleared', 'flagged', 'rejected')),
  eligibility_status text not null default 'eligible'
    check (eligibility_status in ('eligible', 'blocked', 'revoked')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, examination_id, attempt_id),
  check (score >= pass_mark),
  check (early_price_expires_at >= passed_at)
);

create table if not exists public.agilecert_certificate_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  eligibility_id uuid not null references public.agilecert_certificate_eligibilities(id) on delete restrict,
  product_code text not null references public.agilecert_certificate_products(code) on delete restrict,
  currency text not null check (currency in ('NGN', 'USD')),
  pricing_window text not null check (pricing_window in ('early', 'standard', 'waived')),
  list_amount_minor bigint not null check (list_amount_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  payable_amount_minor bigint not null check (payable_amount_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'initialized', 'paid', 'waived', 'failed', 'expired', 'refunded', 'disputed', 'cancelled')),
  gateway_provider text not null default 'paystack',
  gateway_reference text,
  gateway_authorization_url text,
  gateway_access_code text,
  paid_at timestamptz,
  expires_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eligibility_id, product_code, status)
);

-- ---------------------------------------------------------------------------
-- Issued credentials, digital badges and public verification
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_credentials (
  id uuid primary key default gen_random_uuid(),
  credential_code text not null unique,
  verification_slug text not null unique,
  candidate_id uuid not null references auth.users(id) on delete restrict,
  eligibility_id uuid not null references public.agilecert_certificate_eligibilities(id) on delete restrict,
  certificate_order_id uuid not null unique references public.agilecert_certificate_orders(id) on delete restrict,
  product_code text not null references public.agilecert_certificate_products(code) on delete restrict,
  credential_title text not null,
  holder_name text not null,
  examination_title text not null,
  score numeric(5,2) not null check (score between 0 and 100),
  issue_date date not null default current_date,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked', 'expired')),
  certificate_storage_path text,
  transcript_storage_path text,
  public_profile_enabled boolean not null default false,
  linkedin_credential_name text,
  linkedin_organization_name text not null default 'AgileCert Global by IIPM',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_digital_badges (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null unique references public.agilecert_credentials(id) on delete cascade,
  badge_code text not null unique,
  badge_class text not null,
  badge_assertion jsonb not null default '{}'::jsonb,
  image_storage_path text,
  share_url text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Preparation materials and examination-payment entitlements
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_study_materials (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null,
  title text not null,
  description text,
  version text not null default '1.0',
  storage_bucket text not null default 'agilecert-study-materials',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  copyright_notice text,
  watermark_required boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (examination_id, version)
);

create table if not exists public.agilecert_study_material_entitlements (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  examination_id uuid not null,
  examination_order_id uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  grant_reason text not null default 'verified_exam_payment',
  metadata jsonb not null default '{}'::jsonb,
  unique (candidate_id, examination_id)
);

create table if not exists public.agilecert_material_download_audit (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.agilecert_study_materials(id) on delete cascade,
  entitlement_id uuid not null references public.agilecert_study_material_entitlements(id) on delete cascade,
  downloaded_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Automated post-pass communications and cross-selling jobs
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  eligibility_id uuid references public.agilecert_certificate_eligibilities(id) on delete cascade,
  certificate_order_id uuid references public.agilecert_certificate_orders(id) on delete cascade,
  job_type text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed', 'suppressed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eligibility_id, job_type, scheduled_for)
);

create index if not exists agilecert_eligibility_candidate_idx
  on public.agilecert_certificate_eligibilities(candidate_id, passed_at desc);
create index if not exists agilecert_order_candidate_idx
  on public.agilecert_certificate_orders(candidate_id, created_at desc);
create index if not exists agilecert_order_reference_idx
  on public.agilecert_certificate_orders(reference);
create index if not exists agilecert_credential_candidate_idx
  on public.agilecert_credentials(candidate_id, issued_at desc);
create index if not exists agilecert_credential_verification_idx
  on public.agilecert_credentials(verification_slug, status);
create index if not exists agilecert_material_exam_idx
  on public.agilecert_study_materials(examination_id, active);
create index if not exists agilecert_entitlement_candidate_idx
  on public.agilecert_study_material_entitlements(candidate_id, examination_id);
create index if not exists agilecert_automation_due_idx
  on public.agilecert_automation_jobs(status, scheduled_for)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Server-calculated certificate offers
-- ---------------------------------------------------------------------------

create or replace function public.agilecert_candidate_currency(p_candidate_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p.pricing_currency,
    case when upper(coalesce(p.country_code, '')) = 'NG' then 'NGN' else 'USD' end
  )
  from public.agilecert_candidate_profiles p
  where p.user_id = p_candidate_id
  union all
  select 'USD'
  where not exists (
    select 1 from public.agilecert_candidate_profiles p2 where p2.user_id = p_candidate_id
  )
  limit 1;
$$;

create or replace function public.get_my_agilecert_certificate_offers()
returns table (
  eligibility_id uuid,
  examination_id uuid,
  attempt_id uuid,
  examination_title text,
  programme_code text,
  score numeric,
  pass_mark numeric,
  passed_at timestamptz,
  early_price_expires_at timestamptz,
  product_code text,
  product_title text,
  product_description text,
  currency text,
  standard_amount_minor bigint,
  early_amount_minor bigint,
  payable_amount_minor bigint,
  is_early_price boolean,
  requires_identity_verification boolean,
  benefits jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.examination_id,
    e.attempt_id,
    e.examination_title,
    e.programme_code,
    e.score,
    e.pass_mark,
    e.passed_at,
    e.early_price_expires_at,
    p.code,
    p.title,
    p.description,
    pr.currency,
    pr.standard_amount_minor,
    pr.early_amount_minor,
    case
      when now() <= e.early_price_expires_at then pr.early_amount_minor
      else pr.standard_amount_minor
    end,
    now() <= e.early_price_expires_at,
    p.requires_identity_verification,
    p.benefits
  from public.agilecert_certificate_eligibilities e
  join public.agilecert_certificate_products p on p.active
  join public.agilecert_certificate_product_prices pr
    on pr.product_code = p.code
   and pr.active
   and pr.currency = public.agilecert_candidate_currency(e.candidate_id)
  where e.candidate_id = auth.uid()
    and e.eligibility_status = 'eligible'
    and e.integrity_status = 'cleared'
  order by e.passed_at desc, p.display_order;
$$;

create or replace function public.verify_agilecert_credential(p_credential_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'valid', true,
    'credentialCode', c.credential_code,
    'verificationSlug', c.verification_slug,
    'holderName', c.holder_name,
    'credentialTitle', c.credential_title,
    'examinationTitle', c.examination_title,
    'score', case when coalesce(p.show_score_publicly, false) then c.score else null end,
    'issueDate', c.issue_date,
    'expiresAt', c.expires_at,
    'status', c.status,
    'issuer', 'AgileCert Global by IIPM',
    'poweredBy', 'Integrated Institute of Professional Management',
    'pathway', 'Independent specialist competency examination',
    'badge', case
      when b.id is null then null
      else jsonb_build_object(
        'badgeCode', b.badge_code,
        'badgeClass', b.badge_class,
        'shareUrl', b.share_url
      )
    end
  )
  from public.agilecert_credentials c
  left join public.agilecert_candidate_profiles p on p.user_id = c.candidate_id
  left join public.agilecert_digital_badges b on b.credential_id = c.id and b.revoked_at is null
  where lower(c.credential_code) = lower(trim(p_credential_code))
     or lower(c.verification_slug) = lower(trim(p_credential_code))
  limit 1;
$$;

create or replace function public.get_my_agilecert_study_materials()
returns table (
  material_id uuid,
  examination_id uuid,
  title text,
  description text,
  version text,
  mime_type text,
  watermark_required boolean,
  entitlement_id uuid,
  granted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.examination_id,
    m.title,
    m.description,
    m.version,
    m.mime_type,
    m.watermark_required,
    e.id,
    e.granted_at
  from public.agilecert_study_material_entitlements e
  join public.agilecert_study_materials m
    on m.examination_id = e.examination_id
   and m.active
  where e.candidate_id = auth.uid()
    and e.revoked_at is null
  order by e.granted_at desc, m.title;
$$;

-- ---------------------------------------------------------------------------
-- Reminder scheduling and stop-on-purchase automation
-- ---------------------------------------------------------------------------

create or replace function public.agilecert_schedule_certificate_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agilecert_automation_jobs (
    candidate_id,
    eligibility_id,
    job_type,
    scheduled_for,
    payload
  )
  values
    (new.candidate_id, new.id, 'certificate_offer_immediate', new.passed_at,
      jsonb_build_object('stage', 'immediate', 'earlyPriceExpiresAt', new.early_price_expires_at)),
    (new.candidate_id, new.id, 'certificate_reminder_day_2', new.passed_at + interval '2 days',
      jsonb_build_object('stage', 'day_2', 'earlyPriceExpiresAt', new.early_price_expires_at)),
    (new.candidate_id, new.id, 'certificate_reminder_day_5', new.passed_at + interval '5 days',
      jsonb_build_object('stage', 'day_5', 'earlyPriceExpiresAt', new.early_price_expires_at)),
    (new.candidate_id, new.id, 'certificate_reminder_day_7', new.early_price_expires_at,
      jsonb_build_object('stage', 'final_day', 'earlyPriceExpiresAt', new.early_price_expires_at)),
    (new.candidate_id, new.id, 'certificate_standard_price_reminder', new.passed_at + interval '14 days',
      jsonb_build_object('stage', 'standard_price'))
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists agilecert_schedule_certificate_followups_trigger
  on public.agilecert_certificate_eligibilities;
create trigger agilecert_schedule_certificate_followups_trigger
after insert on public.agilecert_certificate_eligibilities
for each row execute function public.agilecert_schedule_certificate_followups();

create or replace function public.agilecert_stop_certificate_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'waived')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.agilecert_automation_jobs
    set
      status = 'cancelled',
      certificate_order_id = new.id,
      updated_at = now()
    where eligibility_id = new.eligibility_id
      and status = 'pending'
      and job_type like 'certificate_%';

    insert into public.agilecert_automation_jobs (
      candidate_id,
      eligibility_id,
      certificate_order_id,
      job_type,
      scheduled_for,
      payload
    )
    values (
      new.candidate_id,
      new.eligibility_id,
      new.id,
      'course_cross_sell',
      now() + interval '1 day',
      jsonb_build_object('source', 'certificate_purchase', 'productCode', new.product_code)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_stop_certificate_followups_trigger
  on public.agilecert_certificate_orders;
create trigger agilecert_stop_certificate_followups_trigger
after insert or update of status on public.agilecert_certificate_orders
for each row execute function public.agilecert_stop_certificate_followups();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.agilecert_platform_settings enable row level security;
alter table public.agilecert_candidate_profiles enable row level security;
alter table public.agilecert_certificate_products enable row level security;
alter table public.agilecert_certificate_product_prices enable row level security;
alter table public.agilecert_certificate_eligibilities enable row level security;
alter table public.agilecert_certificate_orders enable row level security;
alter table public.agilecert_credentials enable row level security;
alter table public.agilecert_digital_badges enable row level security;
alter table public.agilecert_study_materials enable row level security;
alter table public.agilecert_study_material_entitlements enable row level security;
alter table public.agilecert_material_download_audit enable row level security;
alter table public.agilecert_automation_jobs enable row level security;

drop policy if exists agilecert_public_platform_settings on public.agilecert_platform_settings;
create policy agilecert_public_platform_settings
  on public.agilecert_platform_settings for select
  to anon, authenticated
  using (true);

drop policy if exists agilecert_candidate_profile_select_own on public.agilecert_candidate_profiles;
create policy agilecert_candidate_profile_select_own
  on public.agilecert_candidate_profiles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists agilecert_products_public_select on public.agilecert_certificate_products;
create policy agilecert_products_public_select
  on public.agilecert_certificate_products for select
  to anon, authenticated
  using (active);

drop policy if exists agilecert_prices_public_select on public.agilecert_certificate_product_prices;
create policy agilecert_prices_public_select
  on public.agilecert_certificate_product_prices for select
  to anon, authenticated
  using (active);

drop policy if exists agilecert_eligibility_select_own on public.agilecert_certificate_eligibilities;
create policy agilecert_eligibility_select_own
  on public.agilecert_certificate_eligibilities for select
  to authenticated
  using (candidate_id = auth.uid());

drop policy if exists agilecert_orders_select_own on public.agilecert_certificate_orders;
create policy agilecert_orders_select_own
  on public.agilecert_certificate_orders for select
  to authenticated
  using (candidate_id = auth.uid());

drop policy if exists agilecert_credentials_select_own on public.agilecert_credentials;
create policy agilecert_credentials_select_own
  on public.agilecert_credentials for select
  to authenticated
  using (candidate_id = auth.uid());

drop policy if exists agilecert_badges_select_own on public.agilecert_digital_badges;
create policy agilecert_badges_select_own
  on public.agilecert_digital_badges for select
  to authenticated
  using (
    exists (
      select 1
      from public.agilecert_credentials c
      where c.id = credential_id
        and c.candidate_id = auth.uid()
    )
  );

drop policy if exists agilecert_entitlements_select_own on public.agilecert_study_material_entitlements;
create policy agilecert_entitlements_select_own
  on public.agilecert_study_material_entitlements for select
  to authenticated
  using (candidate_id = auth.uid());

drop policy if exists agilecert_download_audit_select_own on public.agilecert_material_download_audit;
create policy agilecert_download_audit_select_own
  on public.agilecert_material_download_audit for select
  to authenticated
  using (candidate_id = auth.uid());

revoke all on public.agilecert_candidate_profiles from anon, authenticated;
grant select on public.agilecert_candidate_profiles to authenticated;
grant select on public.agilecert_platform_settings to anon, authenticated;
grant select on public.agilecert_certificate_products to anon, authenticated;
grant select on public.agilecert_certificate_product_prices to anon, authenticated;
grant select on public.agilecert_certificate_eligibilities to authenticated;
grant select on public.agilecert_certificate_orders to authenticated;
grant select on public.agilecert_credentials to authenticated;
grant select on public.agilecert_digital_badges to authenticated;
grant select on public.agilecert_study_material_entitlements to authenticated;
grant select on public.agilecert_material_download_audit to authenticated;

grant execute on function public.upsert_my_agilecert_profile(
  text, text, text, text, text, text, text, text, text, text, text[], text[], boolean, boolean, boolean, boolean, boolean
) to authenticated;
grant execute on function public.get_my_agilecert_certificate_offers() to authenticated;
grant execute on function public.verify_agilecert_credential(text) to anon, authenticated;
grant execute on function public.get_my_agilecert_study_materials() to authenticated;

comment on table public.agilecert_certificate_eligibilities is
  'Trusted server-created records proving that a candidate passed and may purchase an AgileCert credential.';
comment on table public.agilecert_certificate_orders is
  'Certificate purchase orders; passing alone does not create credential ownership.';
comment on table public.agilecert_credentials is
  'Server-authorised issued credentials with lifecycle status and public verification identity.';
comment on table public.agilecert_digital_badges is
  'Verifiable digital badge assertions linked one-to-one with issued AgileCert credentials.';
comment on function public.verify_agilecert_credential(text) is
  'Public verification endpoint returning limited, non-sensitive credential evidence.';

commit;
