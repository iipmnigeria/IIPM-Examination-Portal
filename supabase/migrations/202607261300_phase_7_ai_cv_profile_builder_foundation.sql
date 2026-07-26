begin;

-- Phase 7.1: private candidate-owned CV and professional-profile workspace.
-- AI rewriting, public publishing, recruiter access and external integrations are
-- deliberately excluded from this foundation release.

create table if not exists public.agilecert_candidate_cv_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  document_title text not null default 'Professional CV',
  target_role text,
  professional_summary text,
  contact_email text,
  contact_phone text,
  contact_location text,
  linkedin_url text,
  portfolio_url text,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  affiliations jsonb not null default '[]'::jsonb,
  references_text text,
  template_key text not null default 'professional'
    check (template_key in ('professional', 'executive', 'modern')),
  status text not null default 'draft'
    check (status in ('draft', 'ready')),
  ai_processing_consent boolean not null default false,
  ai_last_enhanced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_candidate_cv_documents_candidate_idx
  on public.agilecert_candidate_cv_documents(candidate_id);

create or replace function public.upsert_my_agilecert_candidate_cv_document(
  p_document_title text default 'Professional CV',
  p_target_role text default null,
  p_professional_summary text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_contact_location text default null,
  p_linkedin_url text default null,
  p_portfolio_url text default null,
  p_skills text[] default '{}',
  p_languages text[] default '{}',
  p_experience jsonb default '[]'::jsonb,
  p_education jsonb default '[]'::jsonb,
  p_certifications jsonb default '[]'::jsonb,
  p_projects jsonb default '[]'::jsonb,
  p_awards jsonb default '[]'::jsonb,
  p_affiliations jsonb default '[]'::jsonb,
  p_references_text text default null,
  p_template_key text default 'professional',
  p_status text default 'draft',
  p_ai_processing_consent boolean default false
)
returns public.agilecert_candidate_cv_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.agilecert_candidate_cv_documents;
  v_document_title text := coalesce(nullif(trim(p_document_title), ''), 'Professional CV');
  v_template_key text := lower(coalesce(nullif(trim(p_template_key), ''), 'professional'));
  v_status text := lower(coalesce(nullif(trim(p_status), ''), 'draft'));
  v_experience jsonb := coalesce(p_experience, '[]'::jsonb);
  v_education jsonb := coalesce(p_education, '[]'::jsonb);
  v_certifications jsonb := coalesce(p_certifications, '[]'::jsonb);
  v_projects jsonb := coalesce(p_projects, '[]'::jsonb);
  v_awards jsonb := coalesce(p_awards, '[]'::jsonb);
  v_affiliations jsonb := coalesce(p_affiliations, '[]'::jsonb);
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
    raise exception 'Only active candidate accounts may manage a CV document.';
  end if;

  if length(v_document_title) > 120 then
    raise exception 'CV document title must not exceed 120 characters.';
  end if;
  if length(coalesce(p_target_role, '')) > 180 then
    raise exception 'Target role must not exceed 180 characters.';
  end if;
  if length(coalesce(p_professional_summary, '')) > 6000 then
    raise exception 'Professional summary must not exceed 6000 characters.';
  end if;
  if length(coalesce(p_references_text, '')) > 4000 then
    raise exception 'References must not exceed 4000 characters.';
  end if;

  if v_template_key not in ('professional', 'executive', 'modern') then
    raise exception 'CV template must be professional, executive or modern.';
  end if;
  if v_status not in ('draft', 'ready') then
    raise exception 'CV status must be draft or ready.';
  end if;

  if coalesce(cardinality(p_skills), 0) > 50 then
    raise exception 'A CV may contain no more than 50 skills.';
  end if;
  if coalesce(cardinality(p_languages), 0) > 20 then
    raise exception 'A CV may contain no more than 20 languages.';
  end if;

  if jsonb_typeof(v_experience) <> 'array'
     or jsonb_typeof(v_education) <> 'array'
     or jsonb_typeof(v_certifications) <> 'array'
     or jsonb_typeof(v_projects) <> 'array'
     or jsonb_typeof(v_awards) <> 'array'
     or jsonb_typeof(v_affiliations) <> 'array' then
    raise exception 'Structured CV sections must be JSON arrays.';
  end if;

  if jsonb_array_length(v_experience) > 30
     or jsonb_array_length(v_education) > 20
     or jsonb_array_length(v_certifications) > 30
     or jsonb_array_length(v_projects) > 30
     or jsonb_array_length(v_awards) > 20
     or jsonb_array_length(v_affiliations) > 20 then
    raise exception 'One or more CV sections exceed the permitted item limit.';
  end if;

  if length(v_experience::text) > 120000
     or length(v_education::text) > 80000
     or length(v_certifications::text) > 80000
     or length(v_projects::text) > 120000
     or length(v_awards::text) > 50000
     or length(v_affiliations::text) > 50000 then
    raise exception 'One or more CV sections exceed the permitted content size.';
  end if;

  insert into public.agilecert_candidate_cv_documents (
    candidate_id,
    document_title,
    target_role,
    professional_summary,
    contact_email,
    contact_phone,
    contact_location,
    linkedin_url,
    portfolio_url,
    skills,
    languages,
    experience,
    education,
    certifications,
    projects,
    awards,
    affiliations,
    references_text,
    template_key,
    status,
    ai_processing_consent
  )
  values (
    v_user_id,
    v_document_title,
    nullif(trim(p_target_role), ''),
    nullif(trim(p_professional_summary), ''),
    nullif(trim(p_contact_email), ''),
    nullif(trim(p_contact_phone), ''),
    nullif(trim(p_contact_location), ''),
    nullif(trim(p_linkedin_url), ''),
    nullif(trim(p_portfolio_url), ''),
    coalesce(p_skills, '{}'),
    coalesce(p_languages, '{}'),
    v_experience,
    v_education,
    v_certifications,
    v_projects,
    v_awards,
    v_affiliations,
    nullif(trim(p_references_text), ''),
    v_template_key,
    v_status,
    coalesce(p_ai_processing_consent, false)
  )
  on conflict (candidate_id) do update
  set
    document_title = excluded.document_title,
    target_role = excluded.target_role,
    professional_summary = excluded.professional_summary,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    contact_location = excluded.contact_location,
    linkedin_url = excluded.linkedin_url,
    portfolio_url = excluded.portfolio_url,
    skills = excluded.skills,
    languages = excluded.languages,
    experience = excluded.experience,
    education = excluded.education,
    certifications = excluded.certifications,
    projects = excluded.projects,
    awards = excluded.awards,
    affiliations = excluded.affiliations,
    references_text = excluded.references_text,
    template_key = excluded.template_key,
    status = excluded.status,
    ai_processing_consent = excluded.ai_processing_consent,
    updated_at = now()
  returning * into v_document;

  return v_document;
end;
$$;

alter table public.agilecert_candidate_cv_documents enable row level security;

drop policy if exists agilecert_candidate_cv_select_own
  on public.agilecert_candidate_cv_documents;
create policy agilecert_candidate_cv_select_own
  on public.agilecert_candidate_cv_documents
  for select
  to authenticated
  using (candidate_id = auth.uid());

-- Candidates may read only their own CV row. All writes pass through the RPC,
-- which binds ownership to auth.uid() and verifies the active candidate role.
revoke all on public.agilecert_candidate_cv_documents from anon, authenticated;
grant select on public.agilecert_candidate_cv_documents to authenticated;

revoke all on function public.upsert_my_agilecert_candidate_cv_document(
  text, text, text, text, text, text, text, text, text[], text[], jsonb, jsonb,
  jsonb, jsonb, jsonb, jsonb, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.upsert_my_agilecert_candidate_cv_document(
  text, text, text, text, text, text, text, text, text[], text[], jsonb, jsonb,
  jsonb, jsonb, jsonb, jsonb, text, text, text, boolean
) to authenticated;

comment on table public.agilecert_candidate_cv_documents is
  'Private candidate-owned CV and professional-profile document. Direct client writes are disabled.';

comment on function public.upsert_my_agilecert_candidate_cv_document(
  text, text, text, text, text, text, text, text, text[], text[], jsonb, jsonb,
  jsonb, jsonb, jsonb, jsonb, text, text, text, boolean
) is
  'Creates or updates the authenticated active candidate CV document using auth.uid().';

commit;
