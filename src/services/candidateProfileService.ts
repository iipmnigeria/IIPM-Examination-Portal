import { supabase } from '../lib/supabase';

export type CandidatePreferredCurrency = 'NGN' | 'USD';

export interface CandidateProfile {
  user_id: string;
  legal_name: string | null;
  phone: string | null;
  country_code: string | null;
  preferred_currency: CandidatePreferredCurrency | null;
  preferred_language: string;
  timezone: string | null;
  professional_headline: string | null;
  employer: string | null;
  industry: string | null;
  education_summary: string | null;
  skills: string[];
  certification_interests: string[];
  public_profile_enabled: boolean;
  marketing_consent: boolean;
  certificate_email_updates: boolean;
  course_recommendation_emails: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveCandidateProfileInput {
  legalName: string;
  phone?: string;
  countryCode?: string;
  preferredCurrency?: CandidatePreferredCurrency | '';
  preferredLanguage?: string;
  timezone?: string;
  professionalHeadline?: string;
  employer?: string;
  industry?: string;
  educationSummary?: string;
  skills?: string[];
  certificationInterests?: string[];
  publicProfileEnabled?: boolean;
  marketingConsent?: boolean;
  certificateEmailUpdates?: boolean;
  courseRecommendationEmails?: boolean;
}

function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normaliseProfile(value: CandidateProfile): CandidateProfile {
  return {
    ...value,
    skills: ensureStringArray(value.skills),
    certification_interests: ensureStringArray(value.certification_interests),
  };
}

export async function getMyCandidateProfile(): Promise<CandidateProfile | null> {
  const { data, error } = await supabase
    .from('agilecert_candidate_profiles')
    .select(
      'user_id, legal_name, phone, country_code, preferred_currency, preferred_language, timezone, professional_headline, employer, industry, education_summary, skills, certification_interests, public_profile_enabled, marketing_consent, certificate_email_updates, course_recommendation_emails, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load your candidate profile: ${error.message}`);
  }

  return data ? normaliseProfile(data as CandidateProfile) : null;
}

export async function getAuthenticatedCandidateEmail(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Unable to load the authenticated account: ${error.message}`);
  return data.user?.email || '';
}

export async function saveMyCandidateProfile(
  input: SaveCandidateProfileInput,
): Promise<CandidateProfile> {
  const legalName = input.legalName.trim();
  const countryCode = input.countryCode?.trim().toUpperCase() || '';

  if (legalName.length < 3) {
    throw new Error('Enter your full legal name as it should appear on examination records.');
  }

  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error('Country code must contain two letters, for example NG, GH, GB, US or CA.');
  }

  const { data, error } = await supabase.rpc('upsert_my_agilecert_candidate_profile', {
    p_legal_name: legalName,
    p_phone: input.phone?.trim() || null,
    p_country_code: countryCode || null,
    p_preferred_currency: input.preferredCurrency || null,
    p_preferred_language: input.preferredLanguage?.trim() || 'en',
    p_timezone: input.timezone?.trim() || null,
    p_professional_headline: input.professionalHeadline?.trim() || null,
    p_employer: input.employer?.trim() || null,
    p_industry: input.industry?.trim() || null,
    p_education_summary: input.educationSummary?.trim() || null,
    p_skills: input.skills || [],
    p_certification_interests: input.certificationInterests || [],
    p_public_profile_enabled: input.publicProfileEnabled ?? false,
    p_marketing_consent: input.marketingConsent ?? false,
    p_certificate_email_updates: input.certificateEmailUpdates ?? true,
    p_course_recommendation_emails: input.courseRecommendationEmails ?? true,
  });

  if (error) throw new Error(`Unable to save your candidate profile: ${error.message}`);
  if (!data || typeof data !== 'object') {
    throw new Error('The saved candidate profile was not returned by the server.');
  }

  return normaliseProfile(data as CandidateProfile);
}
