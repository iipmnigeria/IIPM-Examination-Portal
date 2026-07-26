import { supabase } from '../lib/supabase';

export type CredentialEffectiveStatus = 'active' | 'expired' | 'suspended' | 'revoked';
export type CpdStatus = 'draft' | 'submitted' | 'approved' | 'changes_requested' | 'rejected';
export type RenewalStatus = 'pending' | 'changes_requested' | 'rejected' | 'completed' | 'cancelled';
export type CredentialProductCode = 'achievement' | 'professional';

export interface CredentialPolicySummary {
  validityMonths: number | null;
  renewalWindowDays: number;
  cpdHoursRequired: number;
  shareLinkDefaultDays: number;
}

export interface BadgeAssertion {
  '@context'?: string[];
  type?: string[];
  id?: string;
  name?: string;
  issuer?: { id?: string; name?: string; type?: string[] };
  validFrom?: string;
  validUntil?: string | null;
  credentialSubject?: Record<string, unknown>;
  credentialStatus?: Record<string, unknown>;
  evidence?: Record<string, unknown>[];
  agileCert?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WalletCredential {
  credentialId: string;
  orderId?: string;
  credentialCode: string;
  badgeCode: string;
  transcriptCode: string | null;
  productCode: CredentialProductCode;
  productTitle: string;
  holderName: string;
  certificateNumber: string;
  certificateTitle: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  issueDate: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string | null;
  renewalDueAt: string | null;
  effectiveStatus: CredentialEffectiveStatus;
  valid: boolean;
  verificationUrl: string;
  issuer: string;
  poweredBy: string;
  badgeAssertion: BadgeAssertion;
  linkedinCredentialName: string;
  renewalCount: number;
  lastRenewedAt: string | null;
  renewalEligible: boolean;
  policy: CredentialPolicySummary;
}

export interface ExaminationHistoryItem {
  attemptId: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  programmeTitle: string;
  attemptStatus: string;
  score: number;
  passMark: number;
  result: 'pass' | 'not_passed';
  integrityStatus: string | null;
  completedAt: string | null;
  certificateNumber: string | null;
  credentialCode: string | null;
  credentialStatus: CredentialEffectiveStatus | null;
}

export interface CpdRecord {
  id: string;
  credentialId: string | null;
  title: string;
  provider: string;
  activityType: string;
  completedOn: string;
  hours: number;
  evidenceReference: string | null;
  status: CpdStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialRenewal {
  id: string;
  credentialId: string;
  status: RenewalStatus;
  currentExpiresAt: string;
  proposedExpiresAt: string;
  requiredCpdHours: number;
  approvedCpdHours: number;
  requestedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  completedAt: string | null;
}

export interface CredentialShareLink {
  id: string;
  credentialId: string | null;
  scope: 'credential' | 'transcript';
  shareCode: string;
  shareUrl: string;
  label: string;
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

export interface CandidateTranscript {
  id?: string;
  transcriptCode?: string;
  publicEnabled?: boolean;
  issuedAt?: string;
  updatedAt?: string;
  verificationUrl?: string;
}

export interface CredentialWallet {
  credentials: WalletCredential[];
  examinationHistory: ExaminationHistoryItem[];
  cpdRecords: CpdRecord[];
  renewals: CredentialRenewal[];
  shareLinks: CredentialShareLink[];
  transcript: CandidateTranscript;
  counts: {
    credentials: number;
    activeCredentials: number;
    examinations: number;
    approvedCpdHours: number;
    pendingRenewals: number;
    activeShareLinks: number;
  };
}

export interface PublicCredentialRecord {
  credentialCode: string;
  badgeCode: string;
  transcriptCode?: string | null;
  productCode: CredentialProductCode;
  productTitle: string;
  holderName: string;
  certificateNumber: string;
  certificateTitle: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  issueDate: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string | null;
  renewalDueAt: string | null;
  effectiveStatus: CredentialEffectiveStatus;
  valid: boolean;
  verificationUrl: string;
  issuer: string;
  poweredBy: string;
  badgeAssertion?: BadgeAssertion;
}

export interface ProfessionalRecordVerification {
  found: boolean;
  valid: boolean;
  recordType: 'credential' | 'credential_share' | 'transcript' | 'transcript_share' | 'certificate' | 'not_found';
  status?: string;
  holderName?: string;
  expiresAt?: string;
  transcriptCode?: string;
  credentials?: PublicCredentialRecord[];
  certificateNumber?: string;
  verificationCode?: string;
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

export interface AdminCredentialPolicy {
  id: string;
  programmeId: string;
  programmeCode: string;
  programmeTitle: string;
  productCode: CredentialProductCode;
  validityMonths: number | null;
  renewalWindowDays: number;
  cpdHoursRequired: number;
  shareLinkDefaultDays: number;
  active: boolean;
  updatedAt: string;
}

export interface AdminCpdRecord extends CpdRecord {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
}

export interface AdminCredentialRenewal extends CredentialRenewal {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  credentialCode: string;
}

export interface AdminCredentialRecord extends PublicCredentialRecord {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  renewalCount: number;
  lastRenewedAt: string | null;
}

export interface CredentialAuditEvent {
  id: string;
  credentialId: string | null;
  candidateId: string | null;
  actorId: string | null;
  shareLinkId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminCredentialConsole {
  policies: AdminCredentialPolicy[];
  cpdQueue: AdminCpdRecord[];
  renewals: AdminCredentialRenewal[];
  credentials: AdminCredentialRecord[];
  auditEvents: CredentialAuditEvent[];
  counts: {
    credentials: number;
    activeCredentials: number;
    expiredCredentials: number;
    submittedCpd: number;
    pendingRenewals: number;
    activeShareLinks: number;
  };
}

const emptyWallet: CredentialWallet = {
  credentials: [],
  examinationHistory: [],
  cpdRecords: [],
  renewals: [],
  shareLinks: [],
  transcript: {},
  counts: {
    credentials: 0,
    activeCredentials: 0,
    examinations: 0,
    approvedCpdHours: 0,
    pendingRenewals: 0,
    activeShareLinks: 0,
  },
};

const emptyAdminConsole: AdminCredentialConsole = {
  policies: [],
  cpdQueue: [],
  renewals: [],
  credentials: [],
  auditEvents: [],
  counts: {
    credentials: 0,
    activeCredentials: 0,
    expiredCredentials: 0,
    submittedCpd: 0,
    pendingRenewals: 0,
    activeShareLinks: 0,
  },
};

function asObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object') return fallback;
  return value as T;
}

export async function getMyCredentialWallet(): Promise<CredentialWallet> {
  const { data, error } = await supabase.rpc('get_my_agilecert_credential_wallet');
  if (error) throw new Error(`Unable to load the credential wallet: ${error.message}`);
  const payload = asObject<Partial<CredentialWallet>>(data, {});
  return {
    credentials: Array.isArray(payload.credentials) ? payload.credentials : [],
    examinationHistory: Array.isArray(payload.examinationHistory) ? payload.examinationHistory : [],
    cpdRecords: Array.isArray(payload.cpdRecords) ? payload.cpdRecords : [],
    renewals: Array.isArray(payload.renewals) ? payload.renewals : [],
    shareLinks: Array.isArray(payload.shareLinks) ? payload.shareLinks : [],
    transcript: asObject<CandidateTranscript>(payload.transcript, {}),
    counts: { ...emptyWallet.counts, ...(payload.counts || {}) },
  };
}

export async function saveMyCpdRecord(input: {
  title: string;
  provider: string;
  activityType: string;
  completedOn: string;
  hours: number;
  credentialId?: string | null;
  evidenceReference?: string | null;
  recordId?: string | null;
}): Promise<{ id: string; status: CpdStatus; message: string }> {
  const { data, error } = await supabase.rpc('save_my_agilecert_cpd_record', {
    p_title: input.title.trim(),
    p_provider: input.provider.trim(),
    p_activity_type: input.activityType,
    p_completed_on: input.completedOn,
    p_hours: input.hours,
    p_credential_id: input.credentialId || null,
    p_evidence_reference: input.evidenceReference?.trim() || null,
    p_record_id: input.recordId || null,
  });
  if (error) throw new Error(error.message);
  return asObject(data, { id: '', status: 'draft' as CpdStatus, message: 'CPD record saved.' });
}

export async function submitMyCpdRecord(recordId: string): Promise<{ id: string; status: CpdStatus; message: string }> {
  const { data, error } = await supabase.rpc('submit_my_agilecert_cpd_record', {
    p_record_id: recordId,
  });
  if (error) throw new Error(error.message);
  return asObject(data, { id: recordId, status: 'submitted' as CpdStatus, message: 'CPD record submitted.' });
}

export async function createCredentialShareLink(input: {
  scope: 'credential' | 'transcript';
  credentialId?: string | null;
  label?: string;
  validDays?: number;
}): Promise<{ id: string; scope: string; shareCode: string; shareUrl: string; expiresAt: string; message: string }> {
  const { data, error } = await supabase.rpc('create_my_agilecert_credential_share_link', {
    p_scope: input.scope,
    p_credential_id: input.credentialId || null,
    p_label: input.label?.trim() || null,
    p_valid_days: input.validDays || null,
  });
  if (error) throw new Error(error.message);
  return asObject(data, { id: '', scope: input.scope, shareCode: '', shareUrl: '', expiresAt: '', message: 'Share link created.' });
}

export async function revokeCredentialShareLink(shareLinkId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_my_agilecert_credential_share_link', {
    p_share_link_id: shareLinkId,
  });
  if (error) throw new Error(error.message);
}

export async function setTranscriptPublic(enabled: boolean): Promise<{ transcriptCode: string; publicEnabled: boolean; message: string }> {
  const { data, error } = await supabase.rpc('set_my_agilecert_transcript_public', {
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
  return asObject(data, { transcriptCode: '', publicEnabled: enabled, message: 'Transcript visibility updated.' });
}

export async function requestCredentialRenewal(credentialId: string): Promise<{ id: string; status: RenewalStatus; proposedExpiresAt: string; message: string }> {
  const { data, error } = await supabase.rpc('request_my_agilecert_credential_renewal', {
    p_credential_id: credentialId,
  });
  if (error) throw new Error(error.message);
  return asObject(data, { id: '', status: 'pending' as RenewalStatus, proposedExpiresAt: '', message: 'Renewal requested.' });
}

export async function verifyProfessionalRecord(code: string): Promise<ProfessionalRecordVerification> {
  const { data, error } = await supabase.rpc('verify_agilecert_professional_record', {
    p_code: code.trim(),
  });
  if (error) throw new Error(`Professional record verification failed: ${error.message}`);
  return asObject(data, {
    found: false,
    valid: false,
    recordType: 'not_found',
    message: 'Professional record verification did not return a result.',
  });
}

export async function getCredentialAdminConsole(limit = 150): Promise<AdminCredentialConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_credential_admin_console', {
    p_limit: limit,
  });
  if (error) throw new Error(`Unable to load credential administration: ${error.message}`);
  const payload = asObject<Partial<AdminCredentialConsole>>(data, {});
  return {
    policies: Array.isArray(payload.policies) ? payload.policies : [],
    cpdQueue: Array.isArray(payload.cpdQueue) ? payload.cpdQueue : [],
    renewals: Array.isArray(payload.renewals) ? payload.renewals : [],
    credentials: Array.isArray(payload.credentials) ? payload.credentials : [],
    auditEvents: Array.isArray(payload.auditEvents) ? payload.auditEvents : [],
    counts: { ...emptyAdminConsole.counts, ...(payload.counts || {}) },
  };
}

export async function reviewCpdRecord(input: {
  recordId: string;
  decision: 'approved' | 'changes_requested' | 'rejected';
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('review_agilecert_cpd_record', {
    p_record_id: input.recordId,
    p_decision: input.decision,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function decideCredentialRenewal(input: {
  renewalId: string;
  decision: 'approved' | 'changes_requested' | 'rejected';
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_agilecert_credential_renewal', {
    p_renewal_id: input.renewalId,
    p_decision: input.decision,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateCredentialPolicy(input: {
  programmeId: string;
  productCode: CredentialProductCode;
  validityMonths?: number | null;
  renewalWindowDays: number;
  cpdHoursRequired: number;
  shareLinkDefaultDays: number;
  active: boolean;
}): Promise<AdminCredentialPolicy> {
  const { data, error } = await supabase.rpc('upsert_agilecert_credential_policy', {
    p_programme_id: input.programmeId,
    p_product_code: input.productCode,
    p_validity_months: input.validityMonths ?? null,
    p_renewal_window_days: input.renewalWindowDays,
    p_cpd_hours_required: input.cpdHoursRequired,
    p_share_link_default_days: input.shareLinkDefaultDays,
    p_active: input.active,
  });
  if (error) throw new Error(error.message);
  return asObject(data, {} as AdminCredentialPolicy);
}
