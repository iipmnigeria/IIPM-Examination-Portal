import { supabase } from '../lib/supabase';

export type CertificateApprovalMode = 'automatic' | 'manual';
export type CertificateApprovalDecision = 'approved' | 'changes_requested' | 'rejected';

export interface CertificateApprovalPolicy {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string | null;
  approvalMode: CertificateApprovalMode;
  requireCandidateRequest: boolean;
  active: boolean;
  updatedAt: string;
}

export interface CertificateTemplateRecord {
  id: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  productCode: 'achievement' | 'professional';
  templateName: string;
  version: number;
  active: boolean;
  certificateTitle: string;
  issuerName: string;
  subtitle: string;
  leftSignatoryName: string;
  leftSignatoryTitle: string;
  rightSignatoryName: string;
  rightSignatoryTitle: string;
  primaryColour: string;
  accentColour: string;
  layoutConfig: Record<string, unknown>;
  updatedAt: string;
}

export interface CertificateApprovalQueueItem {
  eligibilityId: string;
  candidateName: string;
  candidateEmail: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  integrityStatus: string;
  eligibilityStatus: string;
  approvalStatus: string;
  approvalReason: string | null;
  requestedAt: string | null;
  approvalUpdatedAt: string;
}

export interface CertificateApprovalDecisionRecord {
  id: string;
  eligibilityId: string;
  candidateName: string;
  examinationTitle: string;
  decision: CertificateApprovalDecision;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string;
}

export interface CertificateRevisionRecord {
  id: string;
  certificateId: string;
  revisionNumber: number;
  certificateNumber: string;
  verificationCode: string;
  holderName: string;
  certificateTitle: string;
  examinationTitle: string;
  status: 'superseded';
  supersededReason: string;
  supersededBy: string | null;
  supersededAt: string;
}

export interface CertificateAuditEvent {
  id: string;
  certificateId: string | null;
  eligibilityId: string | null;
  eventType: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CertificateCompletionConsole {
  templates: CertificateTemplateRecord[];
  approvalQueue: CertificateApprovalQueueItem[];
  decisions: CertificateApprovalDecisionRecord[];
  revisions: CertificateRevisionRecord[];
  auditEvents: CertificateAuditEvent[];
  approvalPolicies: CertificateApprovalPolicy[];
}

export interface CertificateRenderRecord {
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
  status: 'active';
  revisionNumber: number;
  productCode: 'achievement' | 'professional';
}

export interface CertificateRenderTemplate {
  id: string;
  programmeId: string;
  productCode: 'achievement' | 'professional';
  templateName: string;
  version: number;
  certificateTitle: string;
  issuerName: string;
  subtitle: string;
  leftSignatoryName: string;
  leftSignatoryTitle: string;
  rightSignatoryName: string;
  rightSignatoryTitle: string;
  primaryColour: string;
  accentColour: string;
  layoutConfig: Record<string, unknown>;
}

export interface CertificateRenderPayload {
  certificate: CertificateRenderRecord;
  template: CertificateRenderTemplate | null;
  verificationUrl: string;
}

const emptyConsole: CertificateCompletionConsole = {
  templates: [],
  approvalQueue: [],
  decisions: [],
  revisions: [],
  auditEvents: [],
  approvalPolicies: [],
};

export async function getCertificateCompletionConsole(limit = 100): Promise<CertificateCompletionConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_certificate_completion_console', {
    p_limit: limit,
  });
  if (error) throw new Error(`Unable to load certificate completion controls: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyConsole;

  const payload = data as Partial<CertificateCompletionConsole>;
  return {
    templates: Array.isArray(payload.templates) ? payload.templates : [],
    approvalQueue: Array.isArray(payload.approvalQueue) ? payload.approvalQueue : [],
    decisions: Array.isArray(payload.decisions) ? payload.decisions : [],
    revisions: Array.isArray(payload.revisions) ? payload.revisions : [],
    auditEvents: Array.isArray(payload.auditEvents) ? payload.auditEvents : [],
    approvalPolicies: Array.isArray(payload.approvalPolicies) ? payload.approvalPolicies : [],
  };
}

export async function setCertificateApprovalPolicy(input: {
  examinationId: string;
  approvalMode: CertificateApprovalMode;
  requireCandidateRequest: boolean;
}): Promise<{
  examinationId: string;
  approvalMode: CertificateApprovalMode;
  requireCandidateRequest: boolean;
  updatedAt: string;
}> {
  const { data, error } = await supabase.rpc('set_agilecert_certificate_approval_policy', {
    p_examination_id: input.examinationId,
    p_approval_mode: input.approvalMode,
    p_require_candidate_request: input.requireCandidateRequest,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The approval policy update was not returned.');
  return data as {
    examinationId: string;
    approvalMode: CertificateApprovalMode;
    requireCandidateRequest: boolean;
    updatedAt: string;
  };
}

export async function decideCertificateRequest(input: {
  eligibilityId: string;
  decision: CertificateApprovalDecision;
  reason?: string;
}): Promise<{
  eligibilityId: string;
  approvalStatus: string;
  approvalReason: string | null;
  approvalDecidedAt: string;
}> {
  const { data, error } = await supabase.rpc('decide_agilecert_certificate_request', {
    p_eligibility_id: input.eligibilityId,
    p_decision: input.decision,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The approval decision was not returned.');
  return data as {
    eligibilityId: string;
    approvalStatus: string;
    approvalReason: string | null;
    approvalDecidedAt: string;
  };
}

export async function saveCertificateTemplate(input: {
  templateId?: string | null;
  programmeId: string;
  productCode: 'achievement' | 'professional';
  templateName: string;
  certificateTitle: string;
  issuerName: string;
  subtitle: string;
  leftSignatoryName: string;
  leftSignatoryTitle: string;
  rightSignatoryName: string;
  rightSignatoryTitle: string;
  primaryColour: string;
  accentColour: string;
  layoutConfig?: Record<string, unknown>;
}): Promise<CertificateTemplateRecord> {
  const { data, error } = await supabase.rpc('upsert_agilecert_certificate_template', {
    p_template_id: input.templateId || null,
    p_programme_id: input.programmeId,
    p_product_code: input.productCode,
    p_template_name: input.templateName.trim(),
    p_certificate_title: input.certificateTitle.trim(),
    p_issuer_name: input.issuerName.trim(),
    p_subtitle: input.subtitle.trim(),
    p_left_signatory_name: input.leftSignatoryName.trim(),
    p_left_signatory_title: input.leftSignatoryTitle.trim(),
    p_right_signatory_name: input.rightSignatoryName.trim(),
    p_right_signatory_title: input.rightSignatoryTitle.trim(),
    p_primary_colour: input.primaryColour,
    p_accent_colour: input.accentColour,
    p_layout_config: input.layoutConfig || {},
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate template was not returned.');
  return data as CertificateTemplateRecord;
}

export async function correctAndReissueCertificate(input: {
  certificateId: string;
  holderName: string;
  certificateTitle: string;
  reason: string;
}): Promise<{
  id: string;
  certificateNumber: string;
  verificationCode: string;
  holderName: string;
  certificateTitle: string;
  revisionNumber: number;
  issueDate: string;
  issuedAt: string;
  status: string;
}> {
  const { data, error } = await supabase.rpc('correct_and_reissue_agilecert_certificate', {
    p_certificate_id: input.certificateId,
    p_holder_name: input.holderName.trim(),
    p_certificate_title: input.certificateTitle.trim(),
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The reissued certificate was not returned.');
  return data as {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    holderName: string;
    certificateTitle: string;
    revisionNumber: number;
    issueDate: string;
    issuedAt: string;
    status: string;
  };
}

export async function getCertificateRenderPayload(certificateId: string): Promise<CertificateRenderPayload> {
  const { data, error } = await supabase.rpc('get_my_agilecert_certificate_render_payload', {
    p_certificate_id: certificateId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate render payload was not returned.');
  return data as CertificateRenderPayload;
}
