import { supabase } from '../lib/supabase';

export type IntegrityDecision = 'insufficient_evidence' | 'clear' | 'flag_attempt' | 'invalidate_attempt';

export interface AttemptIntegrityEvent {
  id: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number | null;
  message: string;
  snapshotPath: string | null;
  source: string;
  riskWeight: number;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface AttemptIntegrityReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  decision: IntegrityDecision;
  reason: string;
  evidenceScore: number;
  eventCount: number;
  snapshotCount: number;
  createdAt: string;
}

export interface AttemptIntegrityEvidence {
  attempt: {
    id: string;
    sessionId: string;
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    examinationId: string;
    examinationTitle: string;
    academicScore: number;
    storedRiskScore: number;
    evidenceRiskScore: number;
    status: string;
    startedAt: string;
    submittedAt: string;
    reviewNotes: string | null;
    reviewedBy: string | null;
  };
  summary: {
    evidenceRiskScore: number;
    eventCount: number;
    highEventCount: number;
    visualEventCount: number;
    snapshotCount: number;
    evidenceStatus: 'no_evidence' | 'event_evidence' | 'visual_evidence' | 'partial_visual_evidence';
    legacyScoreMismatch: boolean;
  };
  events: AttemptIntegrityEvent[];
  reviews: AttemptIntegrityReview[];
}

export async function getAttemptIntegrityEvidence(attemptId: string): Promise<AttemptIntegrityEvidence> {
  const { data, error } = await supabase.rpc('get_agilecert_attempt_integrity_evidence', {
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The evidence record was not returned.');
  return data as AttemptIntegrityEvidence;
}

export async function reviewAttemptIntegrity(input: {
  attemptId: string;
  decision: IntegrityDecision;
  reason: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('review_agilecert_attempt_integrity', {
    p_attempt_id: input.attemptId,
    p_decision: input.decision,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

export async function createProctorEvidenceSignedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from('agilecert-proctor-evidence')
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'The private evidence link could not be created.');
  }
  return data.signedUrl;
}
