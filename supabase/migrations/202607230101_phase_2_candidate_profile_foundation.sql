begin;

-- Phase 2.1: candidate-owned profile and communication preferences only.
-- This migration intentionally excludes identity verification, study materials,
-- certificate commerce, credentials, email automation and AI adviser functions.

create table if not exists public.agilecert_candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text,
  phone text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  preferred_currency text check (preferred_currency is null or preferred_currency in ('NGN', 'USD')),
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

-- Keep the migration safe if a reviewed subset of the frozen reference schema
-- has already created the table in a non-production environment.
alter table public.agilecert_candidate_profiles
  add column if not exists legal_name text,
  add column if not exists phone text,
  add column if not exists country_code text,
  add column if not exists preferred_currency text,
  add column if not exists preferred_language text not null default 'en',
  add column if not exists timezone text,
  add column if not exists professional_headline text,
  add column if not exists employer text,
  add column if not exists industry text,
  add column if not exists education_summary text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists certification_interests text[] not null default '{}',
  add column if not exists public_profile_enabled boolean not null default false,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists certificate_email_updates boolean not null default true,
  add column if not exists course_recommendation_emails boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.agilecert_candidate_profiles
  drop constraint if exists agilecert_candidate_profiles_country_code_check;
alter table public.agilecert_candidate_profiles
  add constraint agilecert_candidate_profiles_country_code_check
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.agilecert_candidate_profiles
  drop constraint if exists agilecert_candidate_profiles_preferred_currency_check;
alter table public.agilecert_candidate_profiles
  add constraint agilecert_candidate_profiles_preferred_currency_check
  check (preferred_currency is null or preferred_currency in ('NGN', 'USD'));

create or replace function public.upsert_my_agilecert_candidate_profile(
  p_legal_name text default null,
  p_phone text default null,
  p_country_code text default null,
  p_preferred_currency text default null,
  p_preferred_language text default 'en',
  p_timezone text default null,
  p_professional_headline text default null,
  p_employer text default null,
  p_industry text default null,
  p_education_summary text default null,
  p_skills text[] default '{}',
  p_certification_interests text[] default '{}',
  p_public_profile_enabled boolean default false,
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
  v_country_code text := nullif(upper(trim(p_country_code)), '');
  v_currency text := nullif(upper(trim(p_preferred_currency)), '');
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'Only active candidate accounts may update candidate profiles.';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Country code must contain exactly two letters.';
  end if;

  if v_currency is not null and v_currency not in ('NGN', 'USD') then
    raise exception 'Preferred currency must be NGN or USD.';
  end if;

  insert into public.agilecert_candidate_profiles (
    user_id,
    legal_name,
    phone,
    country_code,
    preferred_currency,
    preferred_language,
    timezone,
    professional_headline,
    employer,
    industry,
    education_summary,
    skills,
    certification_interests,
    public_profile_enabled,
    marketing_consent,
    certificate_email_updates,
    course_recommendation_emails
  )
  values (
    v_user_id,
    nullif(trim(p_legal_name), ''),
    nullif(trim(p_phone), ''),
    v_country_code,
    v_currency,
    coalesce(nullif(trim(p_preferred_language), ''), 'en'),
    nullif(trim(p_timezone), ''),
    nullif(trim(p_professional_headline), ''),
    nullif(trim(p_employer), ''),
    nullif(trim(p_industry), ''),
    nullif(trim(p_education_summary), ''),
    coalesce(p_skills, '{}'),
    coalesce(p_certification_interests, '{}'),
    coalesce(p_public_profile_enabled, false),
    coalesce(p_marketing_consent, false),
    coalesce(p_certificate_email_updates, true),
    coalesce(p_course_recommendation_emails, true)
  )
  on conflict (user_id) do update
  set
    legal_name = excluded.legal_name,
    phone = excluded.phone,
    country_code = excluded.country_code,
    preferred_currency = excluded.preferred_currency,
    preferred_language = excluded.preferred_language,
    timezone = excluded.timezone,
    professional_headline = excluded.professional_headline,
    employer = excluded.employer,
    industry = excluded.industry,
    education_summary = excluded.education_summary,
    skills = excluded.skills,
    certification_interests = excluded.certification_interests,
    public_profile_enabled = excluded.public_profile_enabled,
    marketing_consent = excluded.marketing_consent,
    certificate_email_updates = excluded.certificate_email_updates,
    course_recommendation_emails = excluded.course_recommendation_emails,
    updated_at = now()
  returning * into v_profile;

  if v_profile.legal_name is not null then
    update public.profiles
    set full_name = v_profile.legal_name
    where id = v_user_id;
  end if;

  return v_profile;
end;
$$;

alter table public.agilecert_candidate_profiles enable row level security;

drop policy if exists agilecert_candidate_profile_select_own
  on public.agilecert_candidate_profiles;
create policy agilecert_candidate_profile_select_own
  on public.agilecert_candidate_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Candidates may not insert, update or delete rows directly. All writes pass
-- through the RPC above, which binds the operation to auth.uid() and confirms
-- an active candidate role in the existing portal profile.
revoke all on public.agilecert_candidate_profiles from anon, authenticated;
grant select on public.agilecert_candidate_profiles to authenticated;

revoke all on function public.upsert_my_agilecert_candidate_profile(
  text, text, text, text, text, text, text, text, text, text, text[], text[], boolean, boolean, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.upsert_my_agilecert_candidate_profile(
  text, text, text, text, text, text, text, text, text, text, text[], text[], boolean, boolean, boolean, boolean
) to authenticated;

comment on table public.agilecert_candidate_profiles is
  'Candidate-owned AgileCert profile and communication preferences. Direct client writes are disabled.';

comment on function public.upsert_my_agilecert_candidate_profile(
  text, text, text, text, text, text, text, text, text, text, text[], text[], boolean, boolean, boolean, boolean
) is
  'Safely creates or updates the authenticated active candidate profile using auth.uid().';

commit;
