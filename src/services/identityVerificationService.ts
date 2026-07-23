import { supabase } from '../lib/supabase';

export type AgileCertIdentityDocumentType =
  | 'passport'
  | 'national_id'
  | 'drivers_licence'
  | 'voters_card'
  | 'residence_permit'
  | 'other_government_id';

export interface AgileCertIdentityRequest {
  id: string;
  request_reference: string;
  candidate_id: string;
  document_type: AgileCertIdentityDocumentType;
  issuing_country_code: string;
  document_number_last4: string | null;
  status: 'draft' | 'submitted' | 'processing' | 'verified' | 'rejected' | 'expired' | 'cancelled';
  verification_method: string;
  provider: string | null;
  document_authenticity_score: number | null;
  identity_match_score: number | null;
  submitted_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

type SignedUpload = {
  path: string;
  token: string;
  mimeType: string;
};

interface IdentityInitialization {
  requestId: string;
  requestReference: string;
  status: string;
  uploadRequired: boolean;
  bucket?: string;
  document?: SignedUpload;
  selfie?: SignedUpload;
}

export interface IdentitySubmissionResult {
  requestId: string;
  requestReference: string;
  status: string;
  providerConfigured: boolean;
  provider?: string | null;
  documentAuthenticityScore?: number | null;
  identityMatchScore?: number | null;
  rejectionReason?: string | null;
  message: string;
}

async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  const context = error?.context;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Use the normal function error below.
      }
    }
  }

  return error?.message || fallback;
}

export async function getMyAgileCertIdentityRequest(): Promise<AgileCertIdentityRequest | null> {
  const { data, error } = await supabase.rpc('get_my_agilecert_identity_request');
  if (error) throw new Error(error.message);
  return data && typeof data === 'object' ? (data as AgileCertIdentityRequest) : null;
}

export async function submitAgileCertIdentityVerification(input: {
  documentType: AgileCertIdentityDocumentType;
  issuingCountryCode: string;
  documentNumberLast4?: string;
  documentFile: File;
  selfieFile: File;
}): Promise<IdentitySubmissionResult> {
  const { data: initializationData, error: initializationError } = await supabase.functions.invoke(
    'initialize-identity-verification',
    {
      body: {
        documentType: input.documentType,
        issuingCountryCode: input.issuingCountryCode.trim().toUpperCase(),
        documentNumberLast4: input.documentNumberLast4?.trim().toUpperCase() || null,
        documentMimeType: input.documentFile.type,
        selfieMimeType: input.selfieFile.type,
      },
    },
  );

  if (initializationError) {
    throw new Error(
      await functionErrorMessage(initializationError, 'Identity verification could not be initialized.'),
    );
  }
  if (!initializationData || typeof initializationData !== 'object') {
    throw new Error('Identity-verification upload details were not returned.');
  }

  const initialization = initializationData as IdentityInitialization;
  if (!initialization.uploadRequired) {
    return {
      requestId: initialization.requestId,
      requestReference: initialization.requestReference,
      status: initialization.status,
      providerConfigured: false,
      message: 'An identity-verification request is already in progress.',
    };
  }
  if (!initialization.bucket || !initialization.document || !initialization.selfie) {
    throw new Error('Secure identity upload tokens are incomplete.');
  }

  const bucket = supabase.storage.from(initialization.bucket);
  const [documentUpload, selfieUpload] = await Promise.all([
    bucket.uploadToSignedUrl(
      initialization.document.path,
      initialization.document.token,
      input.documentFile,
      {
        contentType: input.documentFile.type,
        cacheControl: '3600',
      },
    ),
    bucket.uploadToSignedUrl(
      initialization.selfie.path,
      initialization.selfie.token,
      input.selfieFile,
      {
        contentType: input.selfieFile.type,
        cacheControl: '3600',
      },
    ),
  ]);

  if (documentUpload.error) throw new Error(documentUpload.error.message);
  if (selfieUpload.error) throw new Error(selfieUpload.error.message);

  const { data: submissionData, error: submissionError } = await supabase.functions.invoke(
    'submit-identity-verification',
    {
      body: {
        requestId: initialization.requestId,
        documentPath: initialization.document.path,
        selfiePath: initialization.selfie.path,
      },
    },
  );

  if (submissionError) {
    throw new Error(
      await functionErrorMessage(submissionError, 'Identity documents could not be submitted.'),
    );
  }
  if (!submissionData || typeof submissionData !== 'object') {
    throw new Error('The identity-verification result was not returned.');
  }

  window.dispatchEvent(new Event('agilecert-identity-refresh'));
  window.dispatchEvent(new Event('agilecert-offers-refresh'));
  return submissionData as IdentitySubmissionResult;
}
