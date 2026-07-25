import { supabase } from '../lib/supabase';

export type IdentityAssuranceStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type IdentityEvidenceCategory =
  | 'professional_membership'
  | 'employer_confirmation'
  | 'educational_credential'
  | 'institutional_identity'
  | 'other_professional_evidence';

export type IdentityAffiliationType =
  | 'professional_body'
  | 'employer'
  | 'educational_institution'
  | 'training_provider'
  | 'other';

export interface CandidateIdentityProfile {
  legalName: string | null;
  phone: string | null;
  countryCode: string | null;
  professionalHeadline: string | null;
  employer: string | null;
}

export interface IdentityAssuranceSubmission {
  id: string;
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
  status: IdentityAssuranceStatus;
  legalNameSnapshot: string;
  phoneSnapshot: string;
  countryCodeSnapshot: string;
  affiliationType: IdentityAffiliationType;
  affiliationName: string;
  affiliationReference: string | null;
  evidenceCategory: IdentityEvidenceCategory;
  evidenceObjectPath?: string;
  evidenceFilename: string;
  evidenceMimeType?: string;
  evidenceSizeBytes?: number;
  candidateNotes: string | null;
  submittedAt: string | null;
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  reviewedBy?: string | null;
  reviewNote: string | null;
  approvalExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateIdentityAssuranceWorkspace {
  profile: CandidateIdentityProfile;
  verification: IdentityAssuranceSubmission | null;
  professionalCheckoutUnlocked: boolean;
  allowedEvidenceCategories: IdentityEvidenceCategory[];
  prohibitedEvidenceNotice: string;
}

export interface IdentityAssuranceAudit {
  id: string;
  verificationId: string | null;
  actorId: string | null;
  candidateId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminIdentityAssuranceConsole {
  submissions: IdentityAssuranceSubmission[];
  audits: IdentityAssuranceAudit[];
  counts: {
    submitted: number;
    underReview: number;
    changesRequested: number;
    approved: number;
    rejected: number;
  };
  adminId?: string;
}

const emptyCandidateWorkspace: CandidateIdentityAssuranceWorkspace = {
  profile: {
    legalName: null,
    phone: null,
    countryCode: null,
    professionalHeadline: null,
    employer: null,
  },
  verification: null,
  professionalCheckoutUnlocked: false,
  allowedEvidenceCategories: [
    'professional_membership',
    'employer_confirmation',
    'educational_credential',
    'institutional_identity',
    'other_professional_evidence',
  ],
  prohibitedEvidenceNotice:
    'Do not upload passports, national identity cards, driving licences, voter cards, selfies or biometric material.',
};

const emptyAdminConsole: AdminIdentityAssuranceConsole = {
  submissions: [],
  audits: [],
  counts: {
    submitted: 0,
    underReview: 0,
    changesRequested: 0,
    approved: 0,
    rejected: 0,
  },
};

export async function getMyIdentityAssurance(): Promise<CandidateIdentityAssuranceWorkspace> {
  const { data, error } = await supabase.rpc('get_my_agilecert_identity_assurance');
  if (error) throw new Error(`Unable to load identity assurance: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyCandidateWorkspace;

  const payload = data as Partial<CandidateIdentityAssuranceWorkspace>;
  return {
    profile: { ...emptyCandidateWorkspace.profile, ...(payload.profile || {}) },
    verification: payload.verification || null,
    professionalCheckoutUnlocked: payload.professionalCheckoutUnlocked === true,
    allowedEvidenceCategories: Array.isArray(payload.allowedEvidenceCategories)
      ? payload.allowedEvidenceCategories
      : emptyCandidateWorkspace.allowedEvidenceCategories,
    prohibitedEvidenceNotice:
      payload.prohibitedEvidenceNotice || emptyCandidateWorkspace.prohibitedEvidenceNotice,
  };
}

export async function uploadIdentityEvidence(file: File): Promise<{
  objectPath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error('Evidence must be a PDF, JPG or PNG file.');
  }
  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw new Error('Evidence must not exceed 10 MB.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Sign in before uploading identity evidence.');

  const safeName = file.name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120) || 'identity-evidence';
  const objectPath = `${userData.user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from('agilecert-identity-evidence')
    .upload(objectPath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(`Unable to upload private evidence: ${error.message}`);

  return {
    objectPath,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function submitMyIdentityAssurance(input: {
  affiliationType: IdentityAffiliationType;
  affiliationName: string;
  affiliationReference?: string;
  evidenceCategory: IdentityEvidenceCategory;
  evidenceObjectPath: string;
  evidenceFilename: string;
  evidenceMimeType: string;
  evidenceSizeBytes: number;
  candidateNotes?: string;
  attestation: boolean;
}): Promise<{ id: string; status: IdentityAssuranceStatus; submittedAt: string }> {
  const { data, error } = await supabase.rpc('submit_my_agilecert_identity_assurance', {
    p_affiliation_type: input.affiliationType,
    p_affiliation_name: input.affiliationName.trim(),
    p_affiliation_reference: input.affiliationReference?.trim() || null,
    p_evidence_category: input.evidenceCategory,
    p_evidence_object_path: input.evidenceObjectPath,
    p_evidence_filename: input.evidenceFilename,
    p_evidence_mime_type: input.evidenceMimeType,
    p_evidence_size_bytes: input.evidenceSizeBytes,
    p_candidate_notes: input.candidateNotes?.trim() || null,
    p_attestation: input.attestation,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The identity-assurance submission was not returned.');
  return data as { id: string; status: IdentityAssuranceStatus; submittedAt: string };
}

export async function withdrawMyIdentityAssurance(reason?: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_my_agilecert_identity_assurance', {
    p_reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function getIdentityAssuranceAdminConsole(
  status?: IdentityAssuranceStatus | '',
  limit = 100,
): Promise<AdminIdentityAssuranceConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_identity_assurance_admin_console', {
    p_status: status || null,
    p_limit: limit,
  });
  if (error) throw new Error(`Unable to load identity-assurance administration: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyAdminConsole;

  const payload = data as Partial<AdminIdentityAssuranceConsole>;
  return {
    submissions: Array.isArray(payload.submissions) ? payload.submissions : [],
    audits: Array.isArray(payload.audits) ? payload.audits : [],
    counts: { ...emptyAdminConsole.counts, ...(payload.counts || {}) },
    adminId: payload.adminId,
  };
}

export async function reviewIdentityAssurance(input: {
  verificationId: string;
  decision: 'under_review' | 'changes_requested' | 'approved' | 'rejected';
  reviewNote: string;
}): Promise<IdentityAssuranceSubmission> {
  const { data, error } = await supabase.rpc('review_agilecert_identity_assurance', {
    p_verification_id: input.verificationId,
    p_decision: input.decision,
    p_review_note: input.reviewNote.trim(),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The identity-assurance decision was not returned.');
  return data as IdentityAssuranceSubmission;
}

export async function createIdentityEvidenceSignedUrl(objectPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('agilecert-identity-evidence')
    .createSignedUrl(objectPath, 300);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to create a private evidence link.');
  }
  return data.signedUrl;
}
