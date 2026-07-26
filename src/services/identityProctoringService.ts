import { supabase } from '../lib/supabase';
import type { Test } from '../types';

export type IntegrityStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  | 'deleted';

export interface IdentityProctoringPolicy {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  policyVersion: number;
  consentVersion: string;
  privacyNotice: string;
  requireExistingIdentityApproval: boolean;
  requireGovernmentId: boolean;
  requireSelfie: boolean;
  requireExamDayIdentityCheck: boolean;
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireFullscreen: boolean;
  liveEventCaptureEnabled: boolean;
  aiVisualAnalysisEnabled: boolean;
  externalKycEnabled: boolean;
  automatedFaceMatchEnabled: boolean;
  livenessEnabled: boolean;
  retainWebcamImages: boolean;
  appealWindowDays: number;
  consented: boolean;
}

export interface SensitiveIdentityRecord {
  id: string;
  documentType: string;
  documentNumberLast4: string;
  issuerCountry: string;
  issuedOn: string | null;
  expiresOn: string | null;
  documentFilename: string;
  selfieFilename: string | null;
  status: IntegrityStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  approvedUntil: string | null;
  duplicateReviewRequired: boolean;
  retentionDeleteAfter: string;
}

export interface ExamIdentityCheck {
  id: string;
  sessionId?: string | null;
  assignmentId?: string | null;
  examinationId: string;
  examinationTitle: string;
  status: string;
  candidateAttestedAt: string | null;
  selfieFilename: string | null;
  manualDocumentMatch: string | null;
  manualFaceMatch: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface ProctoringSessionSummary {
  id: string;
  sessionId: string;
  examinationId: string;
  examinationTitle: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  riskScore: number;
  riskLevel: string;
  eventCount: number;
  cameraPermission: string;
  microphonePermission?: string;
  fullscreenStatus: string;
  connectivityStatus: string;
}

export interface IntegrityIncident {
  id: string;
  examinationId: string;
  examinationTitle: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  riskScore: number;
  candidateExplanation: string | null;
  explanationSubmittedAt: string | null;
  resolutionSummary: string | null;
  createdAt: string;
}

export interface MisconductCase {
  id: string;
  incidentId: string;
  examinationId: string;
  status: string;
  resultHold: boolean;
  decision: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  suspensionUntil: string | null;
  createdAt: string;
}

export interface MisconductAppeal {
  id: string;
  misconductCaseId: string;
  grounds: string;
  supportingReference: string | null;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  decisionReason: string | null;
  replacementDecision: string | null;
}

export interface CandidateIntegrityWorkspace {
  policies: IdentityProctoringPolicy[];
  identityDocuments: SensitiveIdentityRecord[];
  identityChecks: ExamIdentityCheck[];
  proctoringSessions: ProctoringSessionSummary[];
  incidents: IntegrityIncident[];
  misconductCases: MisconductCase[];
  appeals: MisconductAppeal[];
}

export interface AdminIntegrityRecord extends SensitiveIdentityRecord {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  documentObjectPath: string;
  selfieObjectPath: string | null;
}

export interface AdminExamIdentityCheck extends ExamIdentityCheck {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  identityDocumentId: string | null;
  selfieObjectPath: string | null;
}

export interface AdminProctoringSession extends ProctoringSessionSummary {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  lowEventCount: number;
  mediumEventCount: number;
  highEventCount: number;
}

export interface AdminIntegrityIncident extends IntegrityIncident {
  proctoringSessionId: string;
  sessionId: string;
  attemptId: string | null;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  assignedTo: string | null;
  investigationNotes: string | null;
}

export interface AdminMisconductCase extends MisconductCase {
  attemptId: string | null;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  examinationTitle: string;
}

export interface AdminMisconductAppeal extends MisconductAppeal {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
}

export interface AdminIntegrityPolicy extends Omit<IdentityProctoringPolicy, 'consented'> {
  incidentThreshold: number;
  criticalThreshold: number;
  identityRetentionDays: number;
  proctorEventRetentionDays: number;
  incidentRetentionDays: number;
  active: boolean;
}

export interface AdminIntegrityConsole {
  policies: AdminIntegrityPolicy[];
  identityDocuments: AdminIntegrityRecord[];
  identityChecks: AdminExamIdentityCheck[];
  proctoringSessions: AdminProctoringSession[];
  incidents: AdminIntegrityIncident[];
  misconductCases: AdminMisconductCase[];
  appeals: AdminMisconductAppeal[];
  auditEvents: Array<Record<string, unknown>>;
  counts: {
    identityPending: number;
    identityChecksPending: number;
    highRiskSessions: number;
    openIncidents: number;
    resultHolds: number;
    appealsPending: number;
  };
}

export interface ProctoringPolicyPayload {
  policyVersion: number;
  consentVersion: string;
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireFullscreen: boolean;
  liveEventCaptureEnabled: boolean;
  aiVisualAnalysisEnabled: boolean;
  retainWebcamImages: boolean;
}

export interface OpenProctoringResult {
  id: string;
  sessionId: string;
  status: string;
  riskScore: number;
  riskLevel: string;
  startedAt: string;
  policy: ProctoringPolicyPayload;
}

const emptyWorkspace: CandidateIntegrityWorkspace = {
  policies: [],
  identityDocuments: [],
  identityChecks: [],
  proctoringSessions: [],
  incidents: [],
  misconductCases: [],
  appeals: [],
};

const emptyAdminConsole: AdminIntegrityConsole = {
  policies: [],
  identityDocuments: [],
  identityChecks: [],
  proctoringSessions: [],
  incidents: [],
  misconductCases: [],
  appeals: [],
  auditEvents: [],
  counts: {
    identityPending: 0,
    identityChecksPending: 0,
    highRiskSessions: 0,
    openIncidents: 0,
    resultHolds: 0,
    appealsPending: 0,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'evidence';
}

function fileExtension(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

async function activeUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before uploading identity evidence.');
  return data.user.id;
}

export async function uploadSensitiveIdentityFile(file: File, category: 'government-id' | 'selfie' | 'exam-day-selfie'): Promise<string> {
  const userId = await activeUserId();
  const path = `${userId}/${category}/${crypto.randomUUID()}-${safeFileName(file.name.replace(/\.[^.]+$/, ''))}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from('agilecert-sensitive-identity').upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Unable to upload private identity evidence: ${error.message}`);
  return path;
}

export async function createSensitiveIdentitySignedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from('agilecert-sensitive-identity').createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`Unable to open private identity evidence: ${error?.message || 'No URL returned.'}`);
  return data.signedUrl;
}

export async function getMyIdentityProctoringWorkspace(): Promise<CandidateIntegrityWorkspace> {
  const { data, error } = await supabase.rpc('get_my_agilecert_identity_proctoring_workspace');
  if (error) throw new Error(`Unable to load identity and proctoring records: ${error.message}`);
  const payload = asRecord(data) as Partial<CandidateIntegrityWorkspace>;
  return {
    policies: Array.isArray(payload.policies) ? payload.policies : [],
    identityDocuments: Array.isArray(payload.identityDocuments) ? payload.identityDocuments : [],
    identityChecks: Array.isArray(payload.identityChecks) ? payload.identityChecks : [],
    proctoringSessions: Array.isArray(payload.proctoringSessions) ? payload.proctoringSessions : [],
    incidents: Array.isArray(payload.incidents) ? payload.incidents : [],
    misconductCases: Array.isArray(payload.misconductCases) ? payload.misconductCases : [],
    appeals: Array.isArray(payload.appeals) ? payload.appeals : [],
  };
}

export async function recordIdentityProctoringConsent(input: {
  examinationId: string;
  identityProcessingAccepted: boolean;
  proctoringProcessingAccepted: boolean;
  cameraPermissionAccepted: boolean;
  microphonePermissionAccepted: boolean;
  fullscreenMonitoringAccepted: boolean;
  automatedProcessingAccepted: boolean;
  clientFingerprint?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('record_my_agilecert_identity_proctoring_consent', {
    p_examination_id: input.examinationId,
    p_identity_processing_accepted: input.identityProcessingAccepted,
    p_proctoring_processing_accepted: input.proctoringProcessingAccepted,
    p_camera_permission_accepted: input.cameraPermissionAccepted,
    p_microphone_permission_accepted: input.microphonePermissionAccepted,
    p_fullscreen_monitoring_accepted: input.fullscreenMonitoringAccepted,
    p_automated_processing_accepted: input.automatedProcessingAccepted,
    p_client_fingerprint: input.clientFingerprint || browserFingerprint(),
  });
  if (error) throw new Error(error.message);
  return asRecord(data);
}

export async function submitSensitiveIdentity(input: {
  examinationId: string;
  documentType: string;
  documentNumber: string;
  issuerCountry: string;
  issuedOn?: string | null;
  expiresOn?: string | null;
  documentFile: File;
  selfieFile?: File | null;
}): Promise<Record<string, unknown>> {
  const documentObjectPath = await uploadSensitiveIdentityFile(input.documentFile, 'government-id');
  let selfieObjectPath: string | null = null;
  try {
    if (input.selfieFile) selfieObjectPath = await uploadSensitiveIdentityFile(input.selfieFile, 'selfie');
    const { data, error } = await supabase.rpc('submit_my_agilecert_sensitive_identity', {
      p_examination_id: input.examinationId,
      p_document_type: input.documentType,
      p_document_number: input.documentNumber,
      p_issuer_country: input.issuerCountry.trim().toUpperCase(),
      p_issued_on: input.issuedOn || null,
      p_expires_on: input.expiresOn || null,
      p_document_object_path: documentObjectPath,
      p_document_filename: input.documentFile.name,
      p_document_mime_type: input.documentFile.type,
      p_document_size_bytes: input.documentFile.size,
      p_selfie_object_path: selfieObjectPath,
      p_selfie_filename: input.selfieFile?.name || null,
      p_selfie_mime_type: input.selfieFile?.type || null,
      p_selfie_size_bytes: input.selfieFile?.size || null,
      p_attestation: true,
    });
    if (error) throw new Error(error.message);
    return asRecord(data);
  } catch (error) {
    await supabase.storage.from('agilecert-sensitive-identity').remove(
      [documentObjectPath, selfieObjectPath].filter((value): value is string => Boolean(value)),
    );
    throw error;
  }
}

export async function prepareExamIdentityCheck(input: {
  examinationId: string;
  selfieFile?: File | null;
}): Promise<Record<string, unknown>> {
  let selfieObjectPath: string | null = null;
  try {
    if (input.selfieFile) selfieObjectPath = await uploadSensitiveIdentityFile(input.selfieFile, 'exam-day-selfie');
    const { data, error } = await supabase.rpc('prepare_my_agilecert_exam_identity_check', {
      p_examination_id: input.examinationId,
      p_exam_day_selfie_object_path: selfieObjectPath,
      p_exam_day_selfie_filename: input.selfieFile?.name || null,
      p_exam_day_selfie_mime_type: input.selfieFile?.type || null,
      p_exam_day_selfie_size_bytes: input.selfieFile?.size || null,
      p_attestation: true,
    });
    if (error) throw new Error(error.message);
    return asRecord(data);
  } catch (error) {
    if (selfieObjectPath) await supabase.storage.from('agilecert-sensitive-identity').remove([selfieObjectPath]);
    throw error;
  }
}

export async function openProctoringSession(input: {
  sessionId: string;
  cameraPermission: 'not_requested' | 'granted' | 'denied' | 'unavailable';
  microphonePermission: 'not_requested' | 'granted' | 'denied' | 'unavailable';
  fullscreenStatus: 'not_requested' | 'entered' | 'exited' | 'unavailable';
}): Promise<OpenProctoringResult> {
  const { data, error } = await supabase.rpc('open_my_agilecert_proctoring_session', {
    p_session_id: input.sessionId,
    p_camera_permission: input.cameraPermission,
    p_microphone_permission: input.microphonePermission,
    p_fullscreen_status: input.fullscreenStatus,
    p_client_fingerprint: browserFingerprint(),
  });
  if (error) throw new Error(error.message);
  return asRecord(data) as unknown as OpenProctoringResult;
}

export async function getProctoredExamPayload(sessionId: string): Promise<Test> {
  const { data, error } = await supabase.rpc('get_my_agilecert_proctored_exam_payload', {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The secure examination payload was not returned.');
  return data as Test;
}

export async function recordLiveProctoringEvent(input: {
  proctoringSessionId: string;
  clientEventId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<{ accepted: boolean; riskScore: number; riskLevel: string; eventCount: number }> {
  const { data, error } = await supabase.rpc('record_my_agilecert_proctoring_event', {
    p_proctoring_session_id: input.proctoringSessionId,
    p_client_event_id: input.clientEventId,
    p_event_type: input.eventType,
    p_severity: input.severity,
    p_message: input.message,
    p_metadata: input.metadata || {},
    p_occurred_at: input.occurredAt || new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return asRecord(data) as unknown as { accepted: boolean; riskScore: number; riskLevel: string; eventCount: number };
}

export async function submitIncidentExplanation(incidentId: string, explanation: string): Promise<void> {
  const { error } = await supabase.rpc('submit_my_agilecert_incident_explanation', {
    p_incident_id: incidentId,
    p_explanation: explanation.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function submitMisconductAppeal(input: {
  misconductCaseId: string;
  grounds: string;
  supportingReference?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_my_agilecert_misconduct_appeal', {
    p_misconduct_case_id: input.misconductCaseId,
    p_grounds: input.grounds.trim(),
    p_supporting_reference: input.supportingReference?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function getIdentityProctoringAdminConsole(limit = 150): Promise<AdminIntegrityConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_identity_proctoring_admin_console', { p_limit: limit });
  if (error) throw new Error(`Unable to load identity and proctoring administration: ${error.message}`);
  const payload = asRecord(data) as Partial<AdminIntegrityConsole>;
  return {
    policies: Array.isArray(payload.policies) ? payload.policies : [],
    identityDocuments: Array.isArray(payload.identityDocuments) ? payload.identityDocuments : [],
    identityChecks: Array.isArray(payload.identityChecks) ? payload.identityChecks : [],
    proctoringSessions: Array.isArray(payload.proctoringSessions) ? payload.proctoringSessions : [],
    incidents: Array.isArray(payload.incidents) ? payload.incidents : [],
    misconductCases: Array.isArray(payload.misconductCases) ? payload.misconductCases : [],
    appeals: Array.isArray(payload.appeals) ? payload.appeals : [],
    auditEvents: Array.isArray(payload.auditEvents) ? payload.auditEvents : [],
    counts: { ...emptyAdminConsole.counts, ...(payload.counts || {}) },
  };
}

export async function updateIdentityProctoringPolicy(policy: AdminIntegrityPolicy): Promise<void> {
  const { error } = await supabase.rpc('upsert_agilecert_identity_proctoring_policy', {
    p_examination_id: policy.examinationId,
    p_consent_version: policy.consentVersion,
    p_privacy_notice: policy.privacyNotice,
    p_require_existing_identity_approval: policy.requireExistingIdentityApproval,
    p_require_government_id: policy.requireGovernmentId,
    p_require_selfie: policy.requireSelfie,
    p_require_exam_day_identity_check: policy.requireExamDayIdentityCheck,
    p_require_camera: policy.requireCamera,
    p_require_microphone_permission: policy.requireMicrophone,
    p_require_fullscreen: policy.requireFullscreen,
    p_live_event_capture_enabled: policy.liveEventCaptureEnabled,
    p_ai_visual_analysis_enabled: policy.aiVisualAnalysisEnabled,
    p_external_kyc_enabled: false,
    p_automated_face_match_enabled: false,
    p_liveness_check_enabled: false,
    p_retain_webcam_images: policy.retainWebcamImages,
    p_incident_threshold: policy.incidentThreshold,
    p_critical_threshold: policy.criticalThreshold,
    p_identity_retention_days: policy.identityRetentionDays,
    p_proctor_event_retention_days: policy.proctorEventRetentionDays,
    p_incident_retention_days: policy.incidentRetentionDays,
    p_appeal_window_days: policy.appealWindowDays,
    p_active: policy.active,
  });
  if (error) throw new Error(error.message);
}

export async function reviewSensitiveIdentity(input: {
  documentId: string;
  decision: 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'expired';
  note: string;
  approvalMonths?: number;
}): Promise<void> {
  const { error } = await supabase.rpc('review_agilecert_sensitive_identity', {
    p_document_id: input.documentId,
    p_decision: input.decision,
    p_review_note: input.note.trim(),
    p_approval_months: input.approvalMonths || 24,
  });
  if (error) throw new Error(error.message);
}

export async function reviewExamIdentityCheck(input: {
  checkId: string;
  decision: 'under_review' | 'approved' | 'changes_requested' | 'rejected' | 'expired';
  documentMatch: 'match' | 'mismatch' | 'inconclusive';
  faceMatch: 'match' | 'mismatch' | 'inconclusive' | 'not_required';
  note: string;
}): Promise<void> {
  const { error } = await supabase.rpc('review_agilecert_exam_identity_check', {
    p_check_id: input.checkId,
    p_decision: input.decision,
    p_document_match: input.documentMatch,
    p_face_match: input.faceMatch,
    p_review_note: input.note.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function decideMisconductCase(input: {
  caseId: string;
  decision: 'no_violation' | 'warning' | 'flag_attempt' | 'invalidate_attempt' | 'suspend_candidate';
  reason: string;
  suspensionUntil?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_agilecert_misconduct_case', {
    p_case_id: input.caseId,
    p_decision: input.decision,
    p_reason: input.reason.trim(),
    p_suspension_until: input.suspensionUntil || null,
  });
  if (error) throw new Error(error.message);
}

export async function decideMisconductAppeal(input: {
  appealId: string;
  outcome: 'upheld' | 'partially_upheld' | 'rejected';
  reason: string;
  replacementDecision?: 'no_violation' | 'warning' | 'flag_attempt' | 'invalidate_attempt' | 'suspend_candidate' | null;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_agilecert_misconduct_appeal', {
    p_appeal_id: input.appealId,
    p_outcome: input.outcome,
    p_reason: input.reason.trim(),
    p_replacement_decision: input.replacementDecision || null,
  });
  if (error) throw new Error(error.message);
}

export function browserFingerprint(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export { emptyWorkspace as emptyIdentityProctoringWorkspace };
