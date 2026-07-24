import { supabase } from '../lib/supabase';

export type CertificateEligibilityStatus =
  | 'eligible'
  | 'requested'
  | 'issued'
  | 'blocked'
  | 'revoked';

export type CertificateIntegrityStatus = 'pending' | 'cleared' | 'flagged' | 'rejected';
export type IssuedCertificateStatus = 'active' | 'suspended' | 'revoked';

export interface IssuedCertificateRecord {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  holderName: string;
  certificateTitle: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  issueDate: string;
  issuedAt: string;
  status: IssuedCertificateStatus;
  statusChangedAt?: string | null;
  revocationReason?: string | null;
}

export interface CandidateCertificateItem {
  eligibilityId: string;
  attemptId: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  suspiciousScore: number;
  attemptStatus: string;
  integrityStatus: CertificateIntegrityStatus;
  eligibilityStatus: CertificateEligibilityStatus;
  reasonCode: string;
  completedAt: string | null;
  requestedAt: string | null;
  issuedAt: string | null;
  certificate: IssuedCertificateRecord | null;
}

export interface CandidateCertificateWorkspace {
  items: CandidateCertificateItem[];
  counts: {
    eligible: number;
    requested: number;
    issued: number;
    blocked: number;
  };
}

export interface CertificateVerificationResult {
  found: boolean;
  valid: boolean;
  status?: IssuedCertificateStatus;
  certificateNumber?: string;
  verificationCode?: string;
  holderName?: string;
  certificateTitle?: string;
  examinationTitle?: string;
  programmeCode?: string | null;
  score?: number;
  passMark?: number;
  issueDate?: string;
  issuedAt?: string;
  issuer?: string;
  poweredBy?: string;
  message: string;
}

export interface AdminCertificateEligibility {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string | null;
  attemptId: string;
  score: number;
  passMark: number;
  suspiciousScore: number;
  integrityStatus: CertificateIntegrityStatus;
  eligibilityStatus: CertificateEligibilityStatus;
  reasonCode: string;
  requestedAt: string | null;
  issuedAt: string | null;
  evaluatedAt: string;
}

export interface AdminCertificateRecord extends IssuedCertificateRecord {
  candidateId: string;
  candidateEmail: string;
}

export interface CertificatePolicyRecord {
  examinationId: string;
  examinationTitle: string;
  certificateTitle: string;
  passMarkOverride: number | null;
  examPassMark: number;
  maxSuspiciousScore: number;
  active: boolean;
  updatedAt: string;
}

export interface AdminCertificateConsole {
  eligibilities: AdminCertificateEligibility[];
  certificates: AdminCertificateRecord[];
  policies: CertificatePolicyRecord[];
  counts: {
    eligible: number;
    requested: number;
    issued: number;
    blocked: number;
    activeCertificates: number;
    restrictedCertificates: number;
  };
}

const emptyWorkspace: CandidateCertificateWorkspace = {
  items: [],
  counts: { eligible: 0, requested: 0, issued: 0, blocked: 0 },
};

const emptyAdminConsole: AdminCertificateConsole = {
  eligibilities: [],
  certificates: [],
  policies: [],
  counts: {
    eligible: 0,
    requested: 0,
    issued: 0,
    blocked: 0,
    activeCertificates: 0,
    restrictedCertificates: 0,
  },
};

export async function getMyCertificateWorkspace(): Promise<CandidateCertificateWorkspace> {
  const { data, error } = await supabase.rpc('get_my_agilecert_certificate_workspace');
  if (error) throw new Error(`Unable to load certificate eligibility: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyWorkspace;

  const payload = data as Partial<CandidateCertificateWorkspace>;
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    counts: {
      ...emptyWorkspace.counts,
      ...(payload.counts || {}),
    },
  };
}

export async function requestMyCertificate(attemptId: string): Promise<{
  eligibilityId: string;
  status: string;
  message: string;
}> {
  const { data, error } = await supabase.rpc('request_my_agilecert_certificate', {
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate request was not returned.');
  return data as { eligibilityId: string; status: string; message: string };
}

export async function verifyCertificate(code: string): Promise<CertificateVerificationResult> {
  const normalizedCode = code.trim();
  const { data, error } = await supabase.rpc('verify_agilecert_certificate', {
    p_code: normalizedCode,
  });
  if (error) throw new Error(`Certificate verification failed: ${error.message}`);
  if (!data || typeof data !== 'object') {
    return { found: false, valid: false, message: 'Certificate verification did not return a result.' };
  }
  return data as CertificateVerificationResult;
}

export async function getCertificateAdminConsole(limit = 100): Promise<AdminCertificateConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_certificate_admin_console', {
    p_limit: limit,
  });
  if (error) throw new Error(`Unable to load certificate administration: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyAdminConsole;

  const payload = data as Partial<AdminCertificateConsole>;
  return {
    eligibilities: Array.isArray(payload.eligibilities) ? payload.eligibilities : [],
    certificates: Array.isArray(payload.certificates) ? payload.certificates : [],
    policies: Array.isArray(payload.policies) ? payload.policies : [],
    counts: {
      ...emptyAdminConsole.counts,
      ...(payload.counts || {}),
    },
  };
}

export async function issueCertificate(eligibilityId: string): Promise<IssuedCertificateRecord> {
  const { data, error } = await supabase.rpc('issue_agilecert_certificate', {
    p_eligibility_id: eligibilityId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The issued certificate was not returned.');
  return data as IssuedCertificateRecord;
}

export async function setCertificateStatus(input: {
  certificateId: string;
  status: IssuedCertificateStatus;
  reason?: string;
}): Promise<{ id: string; certificateNumber: string; status: IssuedCertificateStatus }> {
  const { data, error } = await supabase.rpc('set_agilecert_certificate_status', {
    p_certificate_id: input.certificateId,
    p_status: input.status,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate status update was not returned.');
  return data as { id: string; certificateNumber: string; status: IssuedCertificateStatus };
}

export async function reconcileCertificateEligibilities(examinationId?: string | null): Promise<{
  evaluatedAttempts: number;
  reconciledAt: string;
}> {
  const { data, error } = await supabase.rpc('reconcile_agilecert_certificate_eligibilities', {
    p_examination_id: examinationId || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The reconciliation result was not returned.');
  return data as { evaluatedAttempts: number; reconciledAt: string };
}

export async function updateCertificatePolicy(input: {
  examinationId: string;
  certificateTitle: string;
  passMarkOverride?: number | null;
  maxSuspiciousScore: number;
  active: boolean;
}): Promise<CertificatePolicyRecord> {
  const { data, error } = await supabase.rpc('upsert_agilecert_certificate_policy', {
    p_examination_id: input.examinationId,
    p_certificate_title: input.certificateTitle.trim(),
    p_pass_mark_override: input.passMarkOverride ?? null,
    p_max_suspicious_score: input.maxSuspiciousScore,
    p_active: input.active,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate policy update was not returned.');
  return data as CertificatePolicyRecord;
}
