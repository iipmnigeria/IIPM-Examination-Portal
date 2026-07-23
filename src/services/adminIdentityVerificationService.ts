import { supabase } from '../lib/supabase';

export interface AgileCertIdentityReviewQueueItem {
  id: string;
  request_reference: string;
  candidate_id: string;
  candidate_email: string;
  legal_name: string | null;
  document_type: string;
  issuing_country_code: string;
  document_number_last4: string | null;
  status: string;
  verification_method: string;
  provider: string | null;
  document_authenticity_score: number | null;
  identity_match_score: number | null;
  submitted_at: string | null;
  created_at: string;
  rejection_reason: string | null;
}

export interface AgileCertIdentityReviewFiles {
  requestId: string;
  requestReference: string;
  status: string;
  expiresIn: number;
  documentUrl: string;
  selfieUrl: string;
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

export async function listAgileCertIdentityReviewQueue(
  status = 'submitted',
  limit = 50,
): Promise<AgileCertIdentityReviewQueueItem[]> {
  const { data, error } = await supabase.rpc('list_agilecert_identity_review_queue', {
    p_status: status || null,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as AgileCertIdentityReviewQueueItem[]) : [];
}

export async function getAgileCertIdentityReviewFiles(
  requestId: string,
): Promise<AgileCertIdentityReviewFiles> {
  const { data, error } = await supabase.functions.invoke('get-identity-review-files', {
    body: { requestId },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The secure identity-review files could not be opened.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Identity-review file links were not returned.');
  }

  return data as AgileCertIdentityReviewFiles;
}

export async function reviewAgileCertIdentityRequest(input: {
  requestId: string;
  decision: 'verified' | 'rejected' | 'processing' | 'expired';
  rejectionReason?: string;
  expiresAt?: string | null;
  documentAuthenticityScore?: number | null;
  identityMatchScore?: number | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('review_agilecert_identity_request', {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_rejection_reason: input.rejectionReason?.trim() || null,
    p_expires_at: input.expiresAt || null,
    p_provider: null,
    p_provider_reference: null,
    p_document_authenticity_score: input.documentAuthenticityScore ?? null,
    p_identity_match_score: input.identityMatchScore ?? null,
    p_provider_payload: {
      reviewSource: 'agilecert_staff_console',
      reviewedAt: new Date().toISOString(),
    },
  });

  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}
