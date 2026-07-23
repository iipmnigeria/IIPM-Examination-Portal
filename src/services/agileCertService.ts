import { supabase } from '../lib/supabase';
import type {
  AgileCertCertificateProductCode,
  AgileCertCurrency,
} from '../config/agileCert';

export interface AgileCertCandidateProfile {
  user_id: string;
  legal_name: string | null;
  phone: string | null;
  profile_photo_path: string | null;
  country_code: string | null;
  timezone: string | null;
  preferred_language: string;
  professional_headline: string | null;
  employer: string | null;
  industry: string | null;
  education_summary: string | null;
  skills: string[];
  certification_interests: string[];
  public_profile_enabled: boolean;
  show_score_publicly: boolean;
  marketing_consent: boolean;
  certificate_email_updates: boolean;
  course_recommendation_emails: boolean;
  identity_verification_status:
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'rejected'
    | 'expired';
  pricing_country_code: string | null;
  pricing_currency: AgileCertCurrency | null;
  pricing_source: string | null;
  pricing_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveAgileCertCandidateProfileInput {
  legalName?: string | null;
  phone?: string | null;
  profilePhotoPath?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  preferredLanguage?: string | null;
  professionalHeadline?: string | null;
  employer?: string | null;
  industry?: string | null;
  educationSummary?: string | null;
  skills?: string[];
  certificationInterests?: string[];
  publicProfileEnabled?: boolean;
  showScorePublicly?: boolean;
  marketingConsent?: boolean;
  certificateEmailUpdates?: boolean;
  courseRecommendationEmails?: boolean;
}

export interface AgileCertCertificateOffer {
  eligibility_id: string;
  examination_id: string;
  attempt_id: string;
  examination_title: string;
  programme_code: string | null;
  score: number;
  pass_mark: number;
  passed_at: string;
  early_price_expires_at: string;
  product_code: AgileCertCertificateProductCode;
  product_title: string;
  product_description: string;
  currency: AgileCertCurrency;
  standard_amount_minor: number;
  early_amount_minor: number;
  payable_amount_minor: number;
  is_early_price: boolean;
  requires_identity_verification: boolean;
  benefits: string[];
}

export interface AgileCertCredential {
  id: string;
  credential_code: string;
  verification_slug: string;
  candidate_id: string;
  eligibility_id: string;
  certificate_order_id: string;
  product_code: AgileCertCertificateProductCode;
  credential_title: string;
  holder_name: string;
  examination_title: string;
  score: number;
  issue_date: string;
  issued_at: string;
  expires_at: string | null;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  certificate_storage_path: string | null;
  transcript_storage_path: string | null;
  public_profile_enabled: boolean;
  linkedin_credential_name: string | null;
  linkedin_organization_name: string;
  metadata: Record<string, unknown>;
}

export interface AgileCertStudyMaterial {
  material_id: string;
  examination_id: string;
  title: string;
  description: string | null;
  version: string;
  mime_type: string;
  watermark_required: boolean;
  entitlement_id: string;
  granted_at: string;
}

export interface AgileCertCredentialVerification {
  valid: boolean;
  status: string;
  credentialCode?: string;
  verificationSlug?: string;
  holderName?: string;
  credentialTitle?: string;
  examinationTitle?: string;
  score?: number | null;
  issueDate?: string;
  expiresAt?: string | null;
  issuer?: string;
  poweredBy?: string;
  pathway?: string;
  badge?: {
    badgeCode: string;
    badgeClass: string;
    shareUrl: string | null;
  } | null;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function getMyAgileCertProfile(): Promise<AgileCertCandidateProfile | null> {
  const { data, error } = await supabase
    .from('agilecert_candidate_profiles')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Unable to load your AgileCert profile: ${error.message}`);
  return (data as AgileCertCandidateProfile | null) || null;
}

export async function saveMyAgileCertProfile(
  input: SaveAgileCertCandidateProfileInput,
): Promise<AgileCertCandidateProfile> {
  const { data, error } = await supabase.rpc('upsert_my_agilecert_profile', {
    p_legal_name: input.legalName?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_profile_photo_path: input.profilePhotoPath?.trim() || null,
    p_country_code: input.countryCode?.trim().toUpperCase() || null,
    p_timezone: input.timezone?.trim() || null,
    p_preferred_language: input.preferredLanguage?.trim() || 'en',
    p_professional_headline: input.professionalHeadline?.trim() || null,
    p_employer: input.employer?.trim() || null,
    p_industry: input.industry?.trim() || null,
    p_education_summary: input.educationSummary?.trim() || null,
    p_skills: input.skills || [],
    p_certification_interests: input.certificationInterests || [],
    p_public_profile_enabled: input.publicProfileEnabled ?? false,
    p_show_score_publicly: input.showScorePublicly ?? false,
    p_marketing_consent: input.marketingConsent ?? false,
    p_certificate_email_updates: input.certificateEmailUpdates ?? true,
    p_course_recommendation_emails: input.courseRecommendationEmails ?? true,
  });

  if (error) throw new Error(`Unable to save your AgileCert profile: ${error.message}`);
  if (!data || typeof data !== 'object') {
    throw new Error('The updated AgileCert profile was not returned.');
  }

  return data as AgileCertCandidateProfile;
}

export async function getMyAgileCertCertificateOffers(): Promise<AgileCertCertificateOffer[]> {
  const { data, error } = await supabase.rpc('get_my_agilecert_certificate_offers');

  if (error) throw new Error(`Unable to load certificate options: ${error.message}`);

  return ensureArray<AgileCertCertificateOffer>(data).map((offer) => ({
    ...offer,
    score: Number(offer.score),
    pass_mark: Number(offer.pass_mark),
    standard_amount_minor: Number(offer.standard_amount_minor),
    early_amount_minor: Number(offer.early_amount_minor),
    payable_amount_minor: Number(offer.payable_amount_minor),
    benefits: ensureArray<string>(offer.benefits),
  }));
}

export async function getMyAgileCertCredentials(): Promise<AgileCertCredential[]> {
  const { data, error } = await supabase
    .from('agilecert_credentials')
    .select('*')
    .order('issued_at', { ascending: false });

  if (error) throw new Error(`Unable to load your credentials: ${error.message}`);
  return ensureArray<AgileCertCredential>(data);
}

export async function getMyAgileCertStudyMaterials(): Promise<AgileCertStudyMaterial[]> {
  const { data, error } = await supabase.rpc('get_my_agilecert_study_materials');

  if (error) throw new Error(`Unable to load preparation materials: ${error.message}`);
  return ensureArray<AgileCertStudyMaterial>(data);
}

export async function verifyAgileCertCredential(
  credentialCodeOrSlug: string,
): Promise<AgileCertCredentialVerification> {
  const cleanCode = credentialCodeOrSlug.trim();
  if (!cleanCode) {
    return { valid: false, status: 'missing_code' };
  }

  const { data, error } = await supabase.rpc('verify_agilecert_credential', {
    p_credential_code: cleanCode,
  });

  if (error) throw new Error(`Unable to verify the credential: ${error.message}`);
  if (!data || typeof data !== 'object') return { valid: false, status: 'not_found' };

  return data as AgileCertCredentialVerification;
}

export function formatAgileCertMoney(amountMinor: number, currency: AgileCertCurrency): string {
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(amountMinor / 100);
}

export function getAgileCertEarlyPriceTimeRemaining(expiresAt: string): {
  expired: boolean;
  totalMilliseconds: number;
  days: number;
  hours: number;
  minutes: number;
} {
  const totalMilliseconds = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalMinutes = Math.floor(totalMilliseconds / 60_000);

  return {
    expired: totalMilliseconds <= 0,
    totalMilliseconds,
    days: Math.floor(totalMinutes / 1_440),
    hours: Math.floor((totalMinutes % 1_440) / 60),
    minutes: totalMinutes % 60,
  };
}
