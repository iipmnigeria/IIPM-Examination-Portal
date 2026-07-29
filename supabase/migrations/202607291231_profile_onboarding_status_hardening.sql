begin;

create or replace function public.get_my_agilecert_onboarding_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.agilecert_candidate_profiles%rowtype;
  v_complete boolean;
  v_missing text[] := '{}';
  v_required_missing integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select * into v_profile
  from public.agilecert_candidate_profiles
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'complete', false,
      'profileExists', false,
      'profileUpdateRequired', true,
      'completionPercent', 0,
      'missingFields', jsonb_build_array(
        'legalName', 'phone', 'countryCode', 'preferredCurrency', 'timezone',
        'privacyAcceptance', 'termsAcceptance', 'examinationPolicyAcceptance'
      ),
      'onboardingVersion', '2026-07'
    );
  end if;

  if length(trim(coalesce(v_profile.legal_name, ''))) < 3 then v_missing := array_append(v_missing, 'legalName'); v_required_missing := v_required_missing + 1; end if;
  if length(trim(coalesce(v_profile.phone, ''))) < 7 then v_missing := array_append(v_missing, 'phone'); v_required_missing := v_required_missing + 1; end if;
  if coalesce(v_profile.country_code, '') !~ '^[A-Z]{2}$' then v_missing := array_append(v_missing, 'countryCode'); v_required_missing := v_required_missing + 1; end if;
  if coalesce(v_profile.preferred_currency, '') not in ('NGN', 'USD') then v_missing := array_append(v_missing, 'preferredCurrency'); v_required_missing := v_required_missing + 1; end if;
  if length(trim(coalesce(v_profile.timezone, ''))) < 3 then v_missing := array_append(v_missing, 'timezone'); v_required_missing := v_required_missing + 1; end if;
  if v_profile.privacy_accepted_at is null then v_missing := array_append(v_missing, 'privacyAcceptance'); v_required_missing := v_required_missing + 1; end if;
  if v_profile.terms_accepted_at is null then v_missing := array_append(v_missing, 'termsAcceptance'); v_required_missing := v_required_missing + 1; end if;
  if v_profile.examination_policy_accepted_at is null then v_missing := array_append(v_missing, 'examinationPolicyAcceptance'); v_required_missing := v_required_missing + 1; end if;
  if v_profile.profile_update_required then v_missing := array_append(v_missing, 'administratorRequiredUpdate'); end if;

  v_complete := public.agilecert_candidate_profile_is_complete(v_user_id);

  return jsonb_build_object(
    'complete', v_complete,
    'profileExists', true,
    'profileUpdateRequired', v_profile.profile_update_required,
    'completionPercent', greatest(0, least(100, round(((8 - least(v_required_missing, 8))::numeric / 8) * 100))),
    'missingFields', to_jsonb(v_missing),
    'onboardingCompletedAt', v_profile.onboarding_completed_at,
    'onboardingVersion', coalesce(v_profile.onboarding_version, '2026-07')
  );
end;
$$;

revoke all on function public.get_my_agilecert_onboarding_status() from public, anon, authenticated;
grant execute on function public.get_my_agilecert_onboarding_status() to authenticated;

commit;
