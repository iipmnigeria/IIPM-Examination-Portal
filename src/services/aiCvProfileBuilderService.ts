import { supabase } from '../lib/supabase';

export type CandidateCvTemplateKey = 'professional' | 'executive' | 'modern';
export type CandidateCvStatus = 'draft' | 'ready';

export interface CandidateCvExperience {
  id: string;
  role: string;
  organisation: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  highlights: string[];
}

export interface CandidateCvEducation {
  id: string;
  qualification: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  details: string;
}

export interface CandidateCvCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  credentialId: string;
  credentialUrl: string;
}

export interface CandidateCvProject {
  id: string;
  title: string;
  role: string;
  year: string;
  description: string;
  outcomes: string[];
}

export interface CandidateCvAward {
  id: string;
  title: string;
  issuer: string;
  year: string;
  description: string;
}

export interface CandidateCvAffiliation {
  id: string;
  organisation: string;
  membership: string;
  since: string;
}

export interface CandidateCvDocument {
  id: string;
  candidate_id: string;
  document_title: string;
  target_role: string | null;
  professional_summary: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  skills: string[];
  languages: string[];
  experience: CandidateCvExperience[];
  education: CandidateCvEducation[];
  certifications: CandidateCvCertification[];
  projects: CandidateCvProject[];
  awards: CandidateCvAward[];
  affiliations: CandidateCvAffiliation[];
  references_text: string | null;
  template_key: CandidateCvTemplateKey;
  status: CandidateCvStatus;
  ai_processing_consent: boolean;
  ai_last_enhanced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveCandidateCvDocumentInput {
  documentTitle: string;
  targetRole?: string;
  professionalSummary?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLocation?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  skills?: string[];
  languages?: string[];
  experience?: CandidateCvExperience[];
  education?: CandidateCvEducation[];
  certifications?: CandidateCvCertification[];
  projects?: CandidateCvProject[];
  awards?: CandidateCvAward[];
  affiliations?: CandidateCvAffiliation[];
  referencesText?: string;
  templateKey?: CandidateCvTemplateKey;
  status?: CandidateCvStatus;
  aiProcessingConsent?: boolean;
}

const documentColumns = [
  'id',
  'candidate_id',
  'document_title',
  'target_role',
  'professional_summary',
  'contact_email',
  'contact_phone',
  'contact_location',
  'linkedin_url',
  'portfolio_url',
  'skills',
  'languages',
  'experience',
  'education',
  'certifications',
  'projects',
  'awards',
  'affiliations',
  'references_text',
  'template_key',
  'status',
  'ai_processing_consent',
  'ai_last_enhanced_at',
  'created_at',
  'updated_at',
].join(', ');

function objectArray<T extends object>(value: unknown): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
}

function normaliseDocument(value: CandidateCvDocument): CandidateCvDocument {
  return {
    ...value,
    skills: stringArray(value.skills),
    languages: stringArray(value.languages),
    experience: objectArray<CandidateCvExperience>(value.experience),
    education: objectArray<CandidateCvEducation>(value.education),
    certifications: objectArray<CandidateCvCertification>(value.certifications),
    projects: objectArray<CandidateCvProject>(value.projects),
    awards: objectArray<CandidateCvAward>(value.awards),
    affiliations: objectArray<CandidateCvAffiliation>(value.affiliations),
  };
}

function cleanList(values: string[] | undefined, limit: number): string[] {
  return Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function cleanOptionalUrl(value: string | undefined, field: string): string | null {
  const clean = value?.trim() || '';
  if (!clean) return null;

  try {
    const url = new URL(clean);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.');
    return url.toString();
  } catch {
    throw new Error(`${field} must be a complete http or https URL.`);
  }
}

function validateEmail(value: string | undefined): string | null {
  const clean = value?.trim() || '';
  if (!clean) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error('Enter a valid CV contact email address.');
  }
  return clean;
}

export async function getMyCandidateCvDocument(): Promise<CandidateCvDocument | null> {
  const { data, error } = await supabase
    .from('agilecert_candidate_cv_documents')
    .select(documentColumns)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load your CV workspace: ${error.message}`);
  }

  return data ? normaliseDocument(data as unknown as CandidateCvDocument) : null;
}

export async function saveMyCandidateCvDocument(
  input: SaveCandidateCvDocumentInput,
): Promise<CandidateCvDocument> {
  const documentTitle = input.documentTitle.trim() || 'Professional CV';
  if (documentTitle.length > 120) throw new Error('CV document title must not exceed 120 characters.');
  if ((input.targetRole || '').trim().length > 180) throw new Error('Target role must not exceed 180 characters.');
  if ((input.professionalSummary || '').trim().length > 6000) {
    throw new Error('Professional summary must not exceed 6000 characters.');
  }

  const { data, error } = await supabase.rpc('upsert_my_agilecert_candidate_cv_document', {
    p_document_title: documentTitle,
    p_target_role: input.targetRole?.trim() || null,
    p_professional_summary: input.professionalSummary?.trim() || null,
    p_contact_email: validateEmail(input.contactEmail),
    p_contact_phone: input.contactPhone?.trim() || null,
    p_contact_location: input.contactLocation?.trim() || null,
    p_linkedin_url: cleanOptionalUrl(input.linkedinUrl, 'LinkedIn URL'),
    p_portfolio_url: cleanOptionalUrl(input.portfolioUrl, 'Portfolio URL'),
    p_skills: cleanList(input.skills, 50),
    p_languages: cleanList(input.languages, 20),
    p_experience: input.experience || [],
    p_education: input.education || [],
    p_certifications: input.certifications || [],
    p_projects: input.projects || [],
    p_awards: input.awards || [],
    p_affiliations: input.affiliations || [],
    p_references_text: input.referencesText?.trim() || null,
    p_template_key: input.templateKey || 'professional',
    p_status: input.status || 'draft',
    p_ai_processing_consent: input.aiProcessingConsent ?? false,
  });

  if (error) throw new Error(`Unable to save your CV workspace: ${error.message}`);
  if (!data || typeof data !== 'object') {
    throw new Error('The saved CV document was not returned by the server.');
  }

  return normaliseDocument(data as unknown as CandidateCvDocument);
}
